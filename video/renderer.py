"""
video/renderer.py — Standardized, parametric, audio-reactive video renderer with 1:1 Web Preview parity.

Pipeline
--------
1. Analyse ``03_song.mp3`` with **librosa**:
   - Extract multi-band frequency spectrum (Bass, Mids, Treble).
   - Fast transient attack with smooth exponential decay.
   - Extract sub-bass (20 – 150 Hz) for camera screen shake.
   - Extract overall RMS for beat brightness pulse.
2. Render frame-by-frame with **OpenCV** inside a **MoviePy** transformer:
   - Radial vignette, bass camera shake & beat pulse matching ``WaveformPreviewCanvas.jsx``.
   - Parametric waveform engine supporting all built-in and user-created wave presets 1:1.
3. Export 16:9 and centre-cropped 9:16 videos with GPU (AMF) or CPU (libx264) fallback.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

import cv2
import librosa
import numpy as np
from moviepy import AudioFileClip, VideoClip
from PIL import Image
from rich.console import Console
from rich.progress import (
    BarColumn,
    MofNCompleteColumn,
    Progress,
    TextColumn,
    TimeRemainingColumn,
)

from video.styles import resolve_waveform_params

console = Console()

# ── Constants ──────────────────────────────────────────────────────────────────

TARGET_FPS = 30
WIDTH_16x9 = 1920
HEIGHT_16x9 = 1080
WIDTH_9x16 = 1080
HEIGHT_9x16 = 1920


# ── Color Palette Extraction ───────────────────────────────────────────────────

def extract_palette_from_image(image_path: Path) -> tuple[str, str]:
    """
    Extract two dominant vibrant colors from the background art using k-means,
    ensuring the waveform colors harmonize with the image.
    """
    try:
        img = Image.open(image_path).convert("RGB")
        small = img.resize((150, 150), Image.NEAREST)
        arr = np.array(small)
        hsv = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)
        sat = hsv[..., 1]
        val = hsv[..., 2]
        mask = (sat > 50) & (val > 60)

        if np.sum(mask) > 150:
            pixels = np.float32(arr[mask])
            criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
            _, _, centers = cv2.kmeans(
                pixels, 2, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS
            )
            c1 = tuple(int(np.clip(c, 0, 255)) for c in centers[0])
            c2 = tuple(int(np.clip(c, 0, 255)) for c in centers[1])
            hex1 = f"#{c1[0]:02X}{c1[1]:02X}{c1[2]:02X}"
            hex2 = f"#{c2[0]:02X}{c2[1]:02X}{c2[2]:02X}"
            return hex1, hex2
    except Exception:
        pass
    return "#00E5FF", "#FF2A55"


def hex_to_bgr(hex_color: str) -> tuple[int, int, int]:
    """Convert ``#RRGGBB`` → OpenCV BGR tuple."""
    h = hex_color.lstrip("#")
    if len(h) < 6:
        return (255, 229, 0)
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return (b, g, r)


def interpolate_palette(colors: list[tuple[int, int, int]], pos: float) -> tuple[int, int, int]:
    """Interpolate smoothly across a list of BGR colors at normalized position pos [0.0 .. 1.0]."""
    if not colors:
        return (255, 255, 255)
    if len(colors) == 1:
        return colors[0]
    p = max(0.0, min(1.0, float(pos)))
    scaled = p * (len(colors) - 1)
    idx = int(scaled)
    if idx >= len(colors) - 1:
        return colors[-1]
    frac = scaled - idx
    c1, c2 = colors[idx], colors[idx + 1]
    return (
        int(c1[0] * (1.0 - frac) + c2[0] * frac),
        int(c1[1] * (1.0 - frac) + c2[1] * frac),
        int(c1[2] * (1.0 - frac) + c2[2] * frac),
    )


# ── Multi-band Audio Analysis ──────────────────────────────────────────────────

def _analyse_audio(
    audio_path: Path, fps: int = TARGET_FPS, bar_count: int = 48
) -> tuple[np.ndarray, np.ndarray, np.ndarray, float, int]:
    """
    Decompose audio into:
    - rms: overall RMS energy per frame.
    - subbass: sub-bass band (20-150 Hz) for camera shake.
    - freq_bands: 2D array (n_frames, bar_count) of normalized frequency energies
      (Sub-bass → Bass → Low-Mids → High-Mids → Treble) with fast attack and
      exponential decay falloff.
    """
    console.print("[dim]Analysing audio frequency spectrum (Bass, Mids, Treble)…[/dim]")
    y, sr = librosa.load(str(audio_path), sr=22050, mono=True)
    duration: float = librosa.get_duration(y=y, sr=sr)
    n_frames = int(np.ceil(duration * fps))
    hop = max(1, len(y) // n_frames)

    # 1 ── Overall RMS
    rms = librosa.feature.rms(y=y, frame_length=hop * 2, hop_length=hop)[0]

    # 2 ── Sub-bass band (20–150 Hz) for camera shake
    n_fft = 2048
    S = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=hop))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
    subbass_mask = (freqs >= 20) & (freqs <= 150)
    subbass = np.mean(S[subbass_mask, :], axis=0) if np.any(subbass_mask) else rms

    # Align lengths
    min_len = min(len(rms), len(subbass), n_frames)
    rms = rms[:min_len] / (rms.max() + 1e-8)
    subbass = subbass[:min_len] / (subbass.max() + 1e-8)

    # 3 ── Mel Filterbank Spectrum for dynamic multi-band motion
    mel_basis = librosa.filters.mel(
        sr=sr, n_fft=n_fft, n_mels=bar_count, fmin=35, fmax=10000
    )
    power_spec = S[:, :min_len] ** 2
    mel_spec = np.dot(mel_basis, power_spec)  # (bar_count, time)

    # Convert to dB
    mel_db = librosa.power_to_db(mel_spec, ref=np.max)

    # Equalize frequency sensitivity: progressive treble boost (+12 dB at top band)
    treble_tilt = np.linspace(0.0, 12.0, bar_count)[:, None]
    mel_db = mel_db + treble_tilt

    # Normalize between 0.0 and 1.0 with a -45dB floor
    mel_norm = np.clip((mel_db + 45.0) / 45.0, 0.0, 1.0)
    raw_bands = mel_norm.T  # (time, bar_count)

    # Apply fast transient attack & smooth exponential decay (peak-meter physics)
    freq_bands = np.zeros_like(raw_bands)
    freq_bands[0] = raw_bands[0]
    decay = 0.82
    for i in range(1, len(raw_bands)):
        curr = raw_bands[i]
        prev = freq_bands[i - 1]
        freq_bands[i] = np.where(curr > prev, curr * 0.75 + prev * 0.25, prev * decay)

    return rms, subbass, freq_bands, duration, min_len


# ── Canvas-Parity Geometry & Gradient Helpers ──────────────────────────────────

def _apply_radial_vignette(img_bgr: np.ndarray) -> np.ndarray:
    """
    Apply the exact radial vignette from ``WaveformPreviewCanvas.jsx``:
    inner radius = 0.25 * w (alpha 0), outer radius = 0.70 * w (alpha 0.65 black).
    """
    h, w = img_bgr.shape[:2]
    cx, cy = w * 0.5, h * 0.5
    r_inner = w * 0.25
    r_outer = w * 0.70

    yy, xx = np.ogrid[:h, :w]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    t = np.clip((dist - r_inner) / max(1.0, r_outer - r_inner), 0.0, 1.0)
    alpha = (t * 0.65).astype(np.float32)[..., None]
    return (img_bgr.astype(np.float32) * (1.0 - alpha)).astype(np.uint8)


def _build_gradient_map(
    w: int,
    h: int,
    color_mode: str,
    c1_bgr: tuple[int, int, int],
    c2_bgr: tuple[int, int, int],
    palette_bgr: list[tuple[int, int, int]],
) -> np.ndarray:
    """
    Precompute a 2D (h, w, 3) BGR gradient image matching HTML5 Canvas ``wfGradient``
    in ``WaveformPreviewCanvas.jsx``:
    - vertical: (0, h) [c1] → (0, h * 0.45) [c2]
    - horizontal: (w * 0.1, 0) → (w * 0.9, 0) across palette_bgr or [c1, c2]
    """
    grad = np.zeros((h, w, 3), dtype=np.uint8)
    if color_mode == "vertical":
        y_coords = np.arange(h, dtype=np.float32)
        y_start = float(h)
        y_end = float(h) * 0.45
        t = np.clip((y_start - y_coords) / max(1.0, y_start - y_end), 0.0, 1.0)
        for ch in range(3):
            col_line = (c1_bgr[ch] * (1.0 - t) + c2_bgr[ch] * t).astype(np.uint8)
            grad[:, :, ch] = col_line[:, None]
    else:
        x_coords = np.arange(w, dtype=np.float32)
        x_start = float(w) * 0.10
        x_end = float(w) * 0.90
        t = np.clip((x_coords - x_start) / max(1.0, x_end - x_start), 0.0, 1.0)
        colors = palette_bgr if len(palette_bgr) > 2 else [c1_bgr, c2_bgr]
        n_seg = len(colors) - 1
        scaled = t * n_seg
        idx = np.minimum(scaled.astype(np.int32), n_seg - 1)
        frac = scaled - idx
        c_arr = np.array(colors, dtype=np.float32)
        row_bgr = (c_arr[idx] * (1.0 - frac[:, None]) + c_arr[idx + 1] * frac[:, None]).astype(np.uint8)
        grad[:, :, :] = row_bgr[None, :, :]
    return grad


def _draw_round_rect_mask(
    mask: np.ndarray,
    x: int,
    y: int,
    w: int,
    h: int,
    r: int,
    val: int = 255,
) -> None:
    """Draw an anti-aliased rounded rectangle matching HTML5 ``ctx.roundRect(x, y, w, h, r)``."""
    if w <= 0 or h <= 0:
        return
    img_h, img_w = mask.shape[:2]
    x1 = max(0, int(x))
    y1 = max(0, int(y))
    x2 = min(img_w, int(x + w))
    y2 = min(img_h, int(y + h))
    if x2 <= x1 or y2 <= y1:
        return

    bw = x2 - x1
    bh = y2 - y1
    rad = max(0, min(int(r), bw // 2, bh // 2))

    if rad <= 1:
        cv2.rectangle(mask, (x1, y1), (x2 - 1, y2 - 1), val, -1, lineType=cv2.LINE_AA)
        return

    # Inner cross rectangles
    cv2.rectangle(mask, (x1 + rad, y1), (x2 - rad - 1, y2 - 1), val, -1)
    cv2.rectangle(mask, (x1, y1 + rad), (x2 - 1, y2 - rad - 1), val, -1)

    # 4 rounded corners
    cv2.circle(mask, (x1 + rad, y1 + rad), rad, val, -1, lineType=cv2.LINE_AA)
    cv2.circle(mask, (x2 - rad - 1, y1 + rad), rad, val, -1, lineType=cv2.LINE_AA)
    cv2.circle(mask, (x1 + rad, y2 - rad - 1), rad, val, -1, lineType=cv2.LINE_AA)
    cv2.circle(mask, (x2 - rad - 1, y2 - rad - 1), rad, val, -1, lineType=cv2.LINE_AA)


def _composite_gradient_mask(
    frame: np.ndarray,
    mask: np.ndarray,
    grad_map: np.ndarray,
    shadow_blur_px: int = 0,
) -> None:
    """Composite ``grad_map`` onto ``frame`` using ``mask`` (0..255), with optional drop shadow."""
    active_rows = np.where(np.any(mask > 0, axis=1))[0]
    if len(active_rows) == 0:
        return

    pad = max(4, shadow_blur_px * 2)
    y_min = max(0, int(active_rows[0]) - pad)
    y_max = min(frame.shape[0], int(active_rows[-1]) + pad + 1)

    roi_frame = frame[y_min:y_max].astype(np.float32)
    roi_mask = mask[y_min:y_max]
    roi_grad = grad_map[y_min:y_max].astype(np.float32)

    if shadow_blur_px > 0:
        k = shadow_blur_px if shadow_blur_px % 2 == 1 else shadow_blur_px + 1
        k = max(3, k)
        shadow_alpha = cv2.GaussianBlur(roi_mask, (k, k), sigmaX=shadow_blur_px * 0.5)
        s_a = (shadow_alpha.astype(np.float32) / 255.0)[..., None] * 0.40
        roi_frame = roi_frame * (1.0 - s_a)

    alpha = (roi_mask.astype(np.float32) / 255.0)[..., None]
    blended = roi_frame * (1.0 - alpha) + roi_grad * alpha
    frame[y_min:y_max] = np.clip(blended, 0, 255).astype(np.uint8)


def _reorder_center_symmetry(amplitudes: np.ndarray) -> np.ndarray:
    """
    Exact match of ``WaveformPreviewCanvas.jsx`` center-out reordering:
    left half = amplitudes[half - 1 ... 0]
    right half = amplitudes[0 ... half - 1]
    """
    n = len(amplitudes)
    half = n // 2
    if half <= 0:
        return amplitudes
    left = amplitudes[:half][::-1]
    right = amplitudes[:half]
    res = np.concatenate([left, right])
    if len(res) < n:
        res = np.pad(res, (0, n - len(res)), mode="edge")
    return res[:n]


def _load_catalog_waveforms() -> list[dict[str, Any]] | None:
    """Attempt to read user-customized waveform presets from .studio_catalog.json."""
    try:
        from config import PROJECTS_DIR
        cat_file = PROJECTS_DIR / ".studio_catalog.json"
        if cat_file.exists():
            data = json.loads(cat_file.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("waveform_presets"), list):
                return data["waveform_presets"]
    except Exception:
        pass
    return None


def _draw_waveform(
    frame: np.ndarray,
    amplitudes: np.ndarray,
    spec: dict[str, Any],
    t: float = 0.0,
    grad_map: np.ndarray | None = None,
    catalog_presets: list[dict[str, Any]] | None = None,
) -> np.ndarray:
    """
    Draw audio-reactive waveform onto *frame* with 100% 1:1 visual parity to
    ``frontend/src/components/WaveformPreviewCanvas.jsx``.
    Supports both built-in styles and user-created/modified parametric waveforms.
    """
    wf = spec.get("waveform", {})
    style_id = wf.get("style", "rounded_mirror")
    if style_id in ("none", "clean", "off"):
        return frame

    # Resolve full standardized parameters (merging catalog + custom params in spec)
    custom_params = wf.get("params") if isinstance(wf.get("params"), dict) else None
    params = resolve_waveform_params(style_id, custom_params=custom_params, catalog_presets=catalog_presets)

    engine = wf.get("engine") or params.get("engine") or style_id
    if engine in ("none", "clean", "off"):
        return frame

    h, w = frame.shape[:2]
    scale = h / 720.0  # Preview canvas is 1280x720; scale ensures 1:1 proportions at 1080p

    # Colors
    p1_hex = wf.get("primary_color", "#00E5FF")
    p2_hex = wf.get("secondary_color", "#FF2A55")
    c1_bgr = hex_to_bgr(p1_hex)
    c2_bgr = hex_to_bgr(p2_hex)

    palette_hex = wf.get("palette_colors")
    if not palette_hex or not isinstance(palette_hex, list):
        palette_hex = [p1_hex, p2_hex]
    palette_bgr = [hex_to_bgr(c) for c in palette_hex]

    color_mode = wf.get("color_mode", "auto")
    if color_mode == "auto":
        color_mode = params.get("default_color_mode", "horizontal")

    if grad_map is None:
        grad_map = _build_gradient_map(w, h, color_mode, c1_bgr, c2_bgr, palette_bgr)

    # Symmetry reordering
    symmetry = params.get("symmetry", "center" if engine in ("center_symmetrical", "mirrored_bars") else "none")
    if symmetry == "center" or style_id in ("center_symmetrical", "mirrored_bars"):
        display_amps = _reorder_center_symmetry(amplitudes)
    else:
        display_amps = amplitudes

    n = len(display_amps)
    if n == 0:
        return frame

    # Common parametric values
    base_y_ratio = float(params.get("base_y_ratio", 0.82))
    if wf.get("position") == "center" and "base_y_ratio" not in (custom_params or {}):
        base_y_ratio = 0.50
    base_y = int(round(h * base_y_ratio))

    max_h_ratio = float(params.get("max_height_ratio", 0.26))
    max_bar_h = h * max_h_ratio
    gap_div = max(1.5, float(params.get("gap_divisor", 5.0)))
    roundness = float(params.get("roundness", 4.0))
    ref_enabled = bool(params.get("reflection_enabled", engine in ("rounded_mirror", "sharp_spikes", "neon_ladder")))
    ref_scale = float(params.get("reflection_scale", 0.55))
    ref_opacity = float(params.get("reflection_opacity", 0.28))
    ref_gap = int(round(float(params.get("reflection_gap", 6.0)) * scale))
    glow_blur = int(round(float(params.get("glow_blur", 8.0)) * scale))

    # ── 1. Engine: flowing_ribbons (Sine Wave Ribbons) ─────────────────────
    if engine in ("flowing_ribbons", "neon_glow_line"):
        ribbon_count = max(1, int(params.get("ribbon_count", 4)))
        wave_speed = float(params.get("wave_speed", 1.2))
        fill_opacity = float(params.get("fill_opacity", 0.082))
        line_w = max(1, int(round(float(params.get("line_width", 2.5)) * scale)))

        ribbon_colors = [c1_bgr if r % 2 == 0 else c2_bgr for r in range(ribbon_count)]
        if len(palette_bgr) >= ribbon_count:
            ribbon_colors = palette_bgr[:ribbon_count]

        step_x = max(2, int(round(15 * (w / 1280.0))))

        for ribbon in range(ribbon_count):
            phase_offset = ribbon * 1.5
            speed = wave_speed + ribbon * 0.35
            ribbon_amp = (h * max_h_ratio) / (ribbon * 0.3 + 1.0)
            col = ribbon_colors[ribbon]

            pts = [(0, base_y)]
            for x in range(0, w + step_x, step_x):
                cur_x = min(x, w)
                idx = min(n - 1, int((cur_x / float(w)) * n))
                energy = float(display_amps[idx])
                y = (
                    base_y
                    + np.sin((cur_x / float(w)) * 8.0 + t * speed + phase_offset) * ribbon_amp * energy
                    + np.cos((cur_x / float(w)) * 14.0 + t * 2.0) * (ribbon_amp * 0.25)
                )
                pts.append((int(cur_x), int(round(y))))

            if fill_opacity > 0.005:
                poly_pts = pts + [(w, h), (0, h)]
                poly_arr = np.array(poly_pts, dtype=np.int32)
                fill_layer = np.zeros_like(frame)
                cv2.fillPoly(fill_layer, [poly_arr], col, lineType=cv2.LINE_AA)
                cv2.addWeighted(fill_layer, fill_opacity, frame, 1.0, 0.0, dst=frame)

            stroke_layer = np.zeros_like(frame)
            pts_arr = np.array(pts, dtype=np.int32).reshape((-1, 1, 2))
            cv2.polylines(stroke_layer, [pts_arr], False, col, thickness=line_w, lineType=cv2.LINE_AA)

            if glow_blur > 0:
                blur_k = glow_blur if glow_blur % 2 == 1 else glow_blur + 1
                blur_k = max(3, blur_k)
                glow = cv2.GaussianBlur(stroke_layer, (0, 0), sigmaX=blur_k * 0.6, sigmaY=blur_k * 0.6)
                cv2.add(frame, glow, dst=frame)
            cv2.add(frame, stroke_layer, dst=frame)

        return frame

    # ── 2. Engine: particle_waves (3D Undulating Particle Grid — 1:1 with Preview) ──
    if engine in ("particle_waves", "particle_wave"):
        cols = max(8, int(params.get("grid_cols", 28)))
        rows = max(4, int(params.get("grid_rows", 12)))
        wave_speed = float(params.get("wave_speed", 3.0))
        wave_amp = (max_h_ratio / 0.18) * 45.0 * scale
        row_step = 14.0 * scale

        overlay = np.zeros_like(frame, dtype=np.float32)
        alpha_acc = np.zeros((h, w, 1), dtype=np.float32)
        glow_layer = np.zeros_like(frame)

        for r in range(rows):
            depth = r / float(rows)
            y_pos = base_y + r * row_step
            alpha = float(np.clip(0.2 + depth * 0.7, 0.05, 1.0))
            col = c1_bgr if depth > 0.5 else c2_bgr

            for c in range(cols):
                x_pos = (c / float(max(1, cols - 1))) * (w * 0.9) + w * 0.05
                amp_idx = min(n - 1, int((c / float(cols)) * n))
                amp = float(display_amps[amp_idx])

                wave = np.sin(c * 0.5 + t * wave_speed + r * 0.4) * (amp * wave_amp)
                radius = max(2, int(round(max(1.5, (1.8 + depth * 3.5) * (amp * 1.2)) * scale)))
                cx, cy = int(round(x_pos)), int(round(y_pos - wave))

                if 0 <= cx < w and 0 <= cy < h:
                    # Draw onto glow layer and alpha-weighted particle layer
                    glow_col = tuple(int(ch * alpha * 0.7) for ch in c1_bgr)
                    cv2.circle(glow_layer, (cx, cy), radius + int(round(2 * scale)), glow_col, -1, lineType=cv2.LINE_AA)

                    dot_col = tuple(float(ch) * alpha for ch in col)
                    cv2.circle(overlay, (cx, cy), radius, dot_col, -1, lineType=cv2.LINE_AA)
                    cv2.circle(alpha_acc, (cx, cy), radius, (alpha,), -1, lineType=cv2.LINE_AA)

        if glow_blur > 0:
            gk = glow_blur if glow_blur % 2 == 1 else glow_blur + 1
            gk = max(3, gk)
            glow_blurred = cv2.GaussianBlur(glow_layer, (0, 0), sigmaX=gk * 0.5, sigmaY=gk * 0.5)
            cv2.add(frame, glow_blurred, dst=frame)

        a_clamped = np.clip(alpha_acc, 0.0, 1.0)
        frame[:] = np.clip(frame.astype(np.float32) * (1.0 - a_clamped) + overlay, 0, 255).astype(np.uint8)
        return frame

    # ── 3. Engine: sharp_spikes (Cyber Polygon Spikes) ─────────────────────
    if engine == "sharp_spikes":
        total_bar_w = w / float(n)
        mask = np.zeros((h, w), dtype=np.uint8)
        stroke_layer = np.zeros((h, w), dtype=np.uint8)

        for i in range(n):
            x1 = int(round(i * total_bar_w))
            x2 = int(round((i + 1) * total_bar_w))
            x_mid = int(round((x1 + x2) * 0.5))
            bar_h = max(int(round(6 * scale)), int(round(float(display_amps[i]) * max_bar_h)))

            pts_up = np.array([[x1, base_y], [x_mid, base_y - bar_h], [x2, base_y]], dtype=np.int32)
            cv2.fillPoly(mask, [pts_up], 255, lineType=cv2.LINE_AA)
            cv2.polylines(stroke_layer, [pts_up], True, 255, thickness=max(1, int(round(1 * scale))), lineType=cv2.LINE_AA)

            if ref_enabled:
                ref_y = base_y + ref_gap
                down_h = max(2, int(round(bar_h * ref_scale)))
                pts_down = np.array([[x1, ref_y], [x_mid, min(h - 1, ref_y + down_h)], [x2, ref_y]], dtype=np.int32)
                cv2.fillPoly(mask, [pts_down], int(round(255 * ref_opacity)), lineType=cv2.LINE_AA)

        _composite_gradient_mask(frame, mask, grad_map, shadow_blur_px=0)

        # Subtle white/20% border stroke matching preview
        st_rows = np.where(np.any(stroke_layer > 0, axis=1))[0]
        if len(st_rows) > 0:
            ym1, ym2 = int(st_rows[0]), int(st_rows[-1]) + 1
            st_a = (stroke_layer[ym1:ym2].astype(np.float32) / 255.0)[..., None] * 0.20
            frame[ym1:ym2] = np.clip(frame[ym1:ym2].astype(np.float32) * (1.0 - st_a) + 255.0 * st_a, 0, 255).astype(np.uint8)
        return frame

    # ── 4. Engine: dot_matrix (Halftone LED Dot Matrix — 1:1 with Preview) ─
    if engine == "dot_matrix":
        cols = n
        rows = max(4, int(params.get("grid_rows", 14)))
        dot_spacing = w / float(cols)
        dot_radius = max(int(round(2 * scale)), int(round(dot_spacing * 0.32)))
        step_y = dot_radius * 2 + int(round(4 * scale))

        active_layer = np.zeros_like(frame)
        active_mask = np.zeros((h, w), dtype=np.uint8)
        inactive_mask = np.zeros((h, w), dtype=np.uint8)
        glow_layer = np.zeros_like(frame)

        for i in range(cols):
            cx = int(round(i * dot_spacing + dot_spacing * 0.5))
            active_rows = int(np.floor(float(display_amps[i]) * rows))

            for r in range(rows):
                cy = int(round(base_y - r * step_y))
                if cy - dot_radius < 0 or cy + dot_radius >= h:
                    continue
                is_active = r <= active_rows
                if is_active:
                    col = c2_bgr if r > rows * 0.6 else c1_bgr
                    cv2.circle(active_layer, (cx, cy), dot_radius, col, -1, lineType=cv2.LINE_AA)
                    cv2.circle(active_mask, (cx, cy), dot_radius, int(round(255 * 0.95)), -1, lineType=cv2.LINE_AA)
                    cv2.circle(glow_layer, (cx, cy), dot_radius, tuple(int(c * 0.55) for c in c1_bgr), -1, lineType=cv2.LINE_AA)
                else:
                    cv2.circle(inactive_mask, (cx, cy), dot_radius, 255, -1, lineType=cv2.LINE_AA)

            if ref_enabled:
                ref_rows = min(active_rows + 1, 4)
                for r in range(ref_rows):
                    cy_ref = int(round(base_y + ref_gap + (r + 1) * step_y))
                    if cy_ref + dot_radius < h:
                        cv2.circle(active_layer, (cx, cy_ref), dot_radius, c1_bgr, -1, lineType=cv2.LINE_AA)
                        cv2.circle(active_mask, (cx, cy_ref), dot_radius, int(round(255 * ref_opacity * (1.0 - r / 5.0))), -1, lineType=cv2.LINE_AA)

        # Inactive faint white dots (rgba(255,255,255,0.08) * 0.5 = 0.04)
        in_rows = np.where(np.any(inactive_mask > 0, axis=1))[0]
        if len(in_rows) > 0:
            y1, y2 = int(in_rows[0]), int(in_rows[-1]) + 1
            in_a = (inactive_mask[y1:y2].astype(np.float32) / 255.0)[..., None] * 0.04
            frame[y1:y2] = np.clip(frame[y1:y2].astype(np.float32) * (1.0 - in_a) + 255.0 * in_a, 0, 255).astype(np.uint8)

        # Glow + Active LED dots
        if glow_blur > 0:
            gk = glow_blur if glow_blur % 2 == 1 else glow_blur + 1
            gk = max(3, gk)
            glow_blurred = cv2.GaussianBlur(glow_layer, (0, 0), sigmaX=gk * 0.5, sigmaY=gk * 0.5)
            cv2.add(frame, glow_blurred, dst=frame)

        ac_rows = np.where(np.any(active_mask > 0, axis=1))[0]
        if len(ac_rows) > 0:
            y1, y2 = int(ac_rows[0]), int(ac_rows[-1]) + 1
            ac_a = (active_mask[y1:y2].astype(np.float32) / 255.0)[..., None]
            frame[y1:y2] = np.clip(
                frame[y1:y2].astype(np.float32) * (1.0 - ac_a) + active_layer[y1:y2].astype(np.float32) * ac_a,
                0,
                255,
            ).astype(np.uint8)

        return frame

    # ── 5. Engine: neon_ladder (Neon Segmented Ladder — 1:1 with Preview) ──
    if engine in ("neon_ladder", "equalizer"):
        cols = max(8, int(np.floor(n * 0.75)))
        r_blocks = max(4, int(params.get("grid_rows", 12)))
        block_w = max(int(round(3 * scale)), int(round((w / float(cols)) * 0.7)))
        block_h = max(2, int(round(4 * scale)))
        gap_y = max(1, int(round(3 * scale)))
        radius = max(1, int(round(roundness * scale)))

        mask = np.zeros((h, w), dtype=np.uint8)

        for i in range(cols):
            x = int(round(i * (w / float(cols)) + 4 * scale))
            amp_val = float(display_amps[min(i, n - 1)])
            active_blocks = int(np.floor(amp_val * r_blocks))

            for b in range(active_blocks):
                y = int(round(base_y - b * (block_h + gap_y)))
                _draw_round_rect_mask(mask, x, y, block_w, block_h, radius, 255)

                if ref_enabled and b < 4:
                    ry = int(round(base_y + ref_gap + b * (block_h + gap_y)))
                    _draw_round_rect_mask(mask, x, ry, block_w, block_h, radius, int(round(255 * ref_opacity)))

        _composite_gradient_mask(frame, mask, grad_map, shadow_blur_px=0)
        return frame

    # ── 6. Engine: center_symmetrical (Double-Sided Center Soundwave) ──────
    if engine == "center_symmetrical":
        gap = max(int(round(2 * scale)), int(w // (n * gap_div)))
        total_bar_w = int(w // n)
        bar_w = max(int(round(2 * scale)), total_bar_w - gap)
        radius = min(bar_w // 2, int(round(roundness * scale)))

        mask = np.zeros((h, w), dtype=np.uint8)
        for i in range(n):
            x = int(round(i * total_bar_w + gap * 0.5))
            bar_h = max(int(round(4 * scale)), int(round(float(display_amps[i]) * max_bar_h)))
            _draw_round_rect_mask(mask, x, base_y - bar_h, bar_w, bar_h * 2, radius, 255)

            if ref_enabled:
                reflect_h = max(2, int(round(bar_h * ref_scale)))
                _draw_round_rect_mask(
                    mask, x, base_y + bar_h + ref_gap, bar_w, reflect_h, radius, int(round(255 * ref_opacity))
                )

        _composite_gradient_mask(frame, mask, grad_map, shadow_blur_px=0)
        return frame

    # ── 7. Engine: rounded_mirror & bars (mirrored_bars / frequency_bars) ──
    min_gap_px = 3 if engine == "rounded_mirror" else 2
    gap = max(int(round(min_gap_px * scale)), int(w // (n * gap_div)))
    total_bar_w = int(w // n)
    bar_w = max(int(round(2 * scale)), total_bar_w - gap)
    radius = min(bar_w // 2, int(round(roundness * scale)))

    mask = np.zeros((h, w), dtype=np.uint8)

    for i in range(n):
        x = int(round(i * total_bar_w + gap * 0.5))
        bar_h = max(int(round(4 * scale)), int(round(float(display_amps[i]) * max_bar_h)))

        # Main capsule / bar
        _draw_round_rect_mask(mask, x, base_y - bar_h, bar_w, bar_h, radius, 255)

        # Water floor reflection
        if ref_enabled:
            reflect_h = max(2, int(round(bar_h * ref_scale)))
            _draw_round_rect_mask(
                mask,
                x,
                base_y + ref_gap,
                bar_w,
                reflect_h,
                radius,
                int(round(255 * ref_opacity)),
            )

    shadow_px = glow_blur if engine == "rounded_mirror" else 0
    _composite_gradient_mask(frame, mask, grad_map, shadow_blur_px=shadow_px)
    return frame


def _apply_shake(
    frame: np.ndarray,
    subbass: float,
    intensity_px: int,
    rng: np.random.RandomState,
) -> np.ndarray:
    """Translate *frame* randomly if sub-bass exceeds trigger threshold."""
    if intensity_px <= 0 or subbass < 0.52:
        return frame

    scale = (subbass - 0.52) / 0.48
    curr_intensity = max(1, int(intensity_px * scale))
    dx = rng.randint(-curr_intensity, curr_intensity + 1)
    dy = rng.randint(-curr_intensity, curr_intensity + 1)
    M = np.float32([[1, 0, dx], [0, 1, dy]])
    return cv2.warpAffine(
        frame, M, (frame.shape[1], frame.shape[0]), borderMode=cv2.BORDER_REFLECT
    )


def _apply_pulse(frame: np.ndarray, rms: float) -> np.ndarray:
    """Briefly brighten the frame on heavy energy hits."""
    if rms < 0.55:
        return frame
    boost = 1.0 + 0.12 * (rms - 0.55) / 0.45
    return np.clip(frame.astype(np.float32) * boost, 0, 255).astype(np.uint8)


# ── FFmpeg binary locator ─────────────────────────────────────────────────────

def _get_ffmpeg_exe() -> str:
    """Return path to ffmpeg binary from PATH or imageio_ffmpeg fallback."""
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    return "ffmpeg"


# ── Encoder detection ─────────────────────────────────────────────────────────

def _detect_encoder() -> str:
    """Return ``h264_amf`` if available, else ``libx264``."""
    ffmpeg_exe = _get_ffmpeg_exe()
    try:
        result = subprocess.run(
            [ffmpeg_exe, "-hide_banner", "-encoders"],
            capture_output=True, text=True, timeout=10,
        )
        if "h264_amf" in result.stdout:
            console.print("[green]✔ AMD h264_amf encoder detected — GPU accelerated![/green]")
            return "h264_amf"
    except Exception:
        pass
    console.print("[yellow]⚠ h264_amf not found — falling back to libx264 (CPU).[/yellow]")
    return "libx264"


# ── Centre-crop helper ────────────────────────────────────────────────────────

def centre_crop_9x16(input_path: Path, output_path: Path, encoder: str | None = None) -> None:
    """Crop the 16:9 video to 9:16 (portrait) centred."""
    console.print("[dim]Cropping 9:16 vertical version…[/dim]")

    ffmpeg_exe = _get_ffmpeg_exe()
    if encoder is None:
        encoder = _detect_encoder()

    crop_w = int(HEIGHT_16x9 * 9 / 16)
    if crop_w % 2 != 0:
        crop_w += 1
    crop_h = HEIGHT_16x9
    x_offset = (WIDTH_16x9 - crop_w) // 2
    y_offset = 0

    filter_spec = f"crop={crop_w}:{crop_h}:{x_offset}:{y_offset},scale={WIDTH_9x16}:{HEIGHT_9x16}"

    cmd = [
        ffmpeg_exe, "-y",
        "-i", str(input_path),
        "-vf", filter_spec,
        "-c:v", encoder,
    ]
    if encoder == "h264_amf":
        cmd.extend(["-quality", "speed"])
    elif encoder == "libx264":
        cmd.extend(["-preset", "fast"])

    cmd.extend([
        "-b:v", "6M",
        "-c:a", "aac", "-b:a", "192k",
        str(output_path),
    ])
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if res.returncode != 0:
        raise RuntimeError(
            f"FFmpeg vertical crop failed (exit code {res.returncode}):\n{res.stderr}"
        )


_centre_crop_9x16 = centre_crop_9x16


# ── File Finder Helpers ────────────────────────────────────────────────────────

def find_project_audio(project_dir: Path) -> Path | None:
    """Locate the active audio file in project_dir (03_song.mp3 or any *.mp3/*.wav/*.m4a)."""
    p = Path(project_dir)
    default_p = p / "03_song.mp3"
    if default_p.exists() and default_p.stat().st_size > 0:
        return default_p
    for ext in ("*.mp3", "*.wav", "*.m4a"):
        for f in p.glob(ext):
            if f.is_file() and f.stat().st_size > 0:
                return f
    return None


def find_project_video_16x9(project_dir: Path) -> Path | None:
    """Locate the 16:9 video in project_dir."""
    p = Path(project_dir)
    default_p = p / "04_video_16x9.mp4"
    if default_p.exists() and default_p.stat().st_size > 0:
        return default_p
    for f in p.glob("*16x9*.mp4"):
        if f.is_file() and f.stat().st_size > 0:
            return f
    return None


def find_project_video_9x16(project_dir: Path) -> Path | None:
    """Locate the 9:16 video in project_dir."""
    p = Path(project_dir)
    default_p = p / "04_video_9x16.mp4"
    if default_p.exists() and default_p.stat().st_size > 0:
        return default_p
    for f in p.glob("*9x16*.mp4"):
        if f.is_file() and f.stat().st_size > 0:
            return f
    return None


# ── Main render entry point ───────────────────────────────────────────────────

def render(
    project_dir: Path,
    custom_render_spec: dict[str, Any] | None = None,
    audio_path: Path | None = None,
    output_16x9_path: Path | None = None,
    output_9x16_path: Path | None = None,
    render_16x9: bool = True,
    render_9x16: bool = True,
    progress_callback: Any | None = None,
) -> tuple[Path | None, Path | None]:
    """
    Full render pipeline.

    Reads ``01_styles.json``, ``03_background.png``, and the project audio
    from *project_dir*.
    Generates 16:9 and optionally crops 9:16 vertical video.
    Supports real-time progress callbacks for web studio status updates.
    """
    project_dir = Path(project_dir)
    styles_file = project_dir / "01_styles.json"
    if styles_file.exists():
        styles = json.loads(styles_file.read_text(encoding="utf-8"))
    else:
        styles = {}

    render_spec = custom_render_spec or styles.get("render_spec", {})
    motion = render_spec.get("motion_effects", {})
    wf_spec = render_spec.get("waveform", {})

    catalog_presets = _load_catalog_waveforms()
    style_id = wf_spec.get("style", "rounded_mirror")
    custom_params = wf_spec.get("params") if isinstance(wf_spec.get("params"), dict) else None
    resolved_params = resolve_waveform_params(style_id, custom_params=custom_params, catalog_presets=catalog_presets)

    bar_count = int(wf_spec.get("bar_count") or resolved_params.get("bar_count") or 48)
    bar_count = max(12, min(128, bar_count))

    bg_path = project_dir / "03_background.png"
    if not bg_path.exists():
        for ext in ("*.png", "*.jpg", "*.jpeg"):
            for f in project_dir.glob(ext):
                if "background" in f.name.lower():
                    bg_path = f
                    break
            if bg_path.exists():
                break

    if not bg_path.exists():
        raise FileNotFoundError(f"No background image found in {project_dir}")

    # Scale image to cover 1920x1080 center-cropped (matching preview object-cover)
    bg_img = Image.open(bg_path).convert("RGB")
    iw, ih = bg_img.size
    ratio = max(WIDTH_16x9 / float(iw), HEIGHT_16x9 / float(ih))
    new_w, new_h = int(round(iw * ratio)), int(round(ih * ratio))
    bg_resized = bg_img.resize((new_w, new_h), Image.LANCZOS)
    left = max(0, (new_w - WIDTH_16x9) // 2)
    top = max(0, (new_h - HEIGHT_16x9) // 2)
    bg_cropped = bg_resized.crop((left, top, left + WIDTH_16x9, top + HEIGHT_16x9))
    bg_array = np.array(bg_cropped)[..., ::-1]  # RGB → BGR for OpenCV

    # Pre-apply radial vignette matching WaveformPreviewCanvas.jsx
    bg_array = _apply_radial_vignette(bg_array)

    # Pre-build 2D gradient LUT for this render
    p1_hex = wf_spec.get("primary_color", "#00E5FF")
    p2_hex = wf_spec.get("secondary_color", "#FF2A55")
    c1_bgr = hex_to_bgr(p1_hex)
    c2_bgr = hex_to_bgr(p2_hex)
    pal_hex = wf_spec.get("palette_colors")
    if not pal_hex or not isinstance(pal_hex, list):
        pal_hex = [p1_hex, p2_hex]
    pal_bgr = [hex_to_bgr(c) for c in pal_hex]
    color_mode = wf_spec.get("color_mode", "auto")
    if color_mode == "auto":
        color_mode = resolved_params.get("default_color_mode", "horizontal")
    grad_map = _build_gradient_map(WIDTH_16x9, HEIGHT_16x9, color_mode, c1_bgr, c2_bgr, pal_bgr)

    if audio_path is None:
        audio_path = find_project_audio(project_dir)
    if audio_path is None or not audio_path.exists():
        raise FileNotFoundError(f"No audio file found in {project_dir}")

    # Output paths
    out_16x9 = output_16x9_path or (project_dir / "04_video_16x9.mp4")
    out_9x16 = output_9x16_path or (project_dir / "04_video_9x16.mp4")

    # Multi-band frequency analysis
    if progress_callback:
        progress_callback(2.0, 0, 100, TARGET_FPS, "Analizando frecuencias de audio...")

    rms, subbass, freq_bands, duration, n_frames = _analyse_audio(
        audio_path, TARGET_FPS, bar_count=bar_count
    )

    do_shake = motion.get("bass_shake", True)
    shake_px = int(motion.get("shake_intensity_px", 6))
    do_pulse = motion.get("background_pulse", True)
    shake_rng = np.random.RandomState(42)

    encoder = _detect_encoder()

    console.print(f"[bold]Rendering {n_frames} frames @ {TARGET_FPS} fps…[/bold]")

    progress = Progress(
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TimeRemainingColumn(),
        console=console,
    )

    task_id = None
    last_reported_pct = -1.0

    def make_frame(t: float) -> np.ndarray:
        """Generate a single BGR frame, then convert to RGB for MoviePy."""
        nonlocal task_id, last_reported_pct
        idx = min(int(t * TARGET_FPS), n_frames - 1, len(rms) - 1)

        frame = bg_array.copy()

        # Pulse brightness on beat
        if do_pulse:
            frame = _apply_pulse(frame, float(rms[idx]))

        # Bass camera shake on kick/808 hits
        if do_shake:
            frame = _apply_shake(frame, float(subbass[idx]), shake_px, shake_rng)

        # Dynamic multi-band frequency waveform (1:1 with preview)
        current_amplitudes = freq_bands[idx]
        frame = _draw_waveform(
            frame,
            current_amplitudes,
            render_spec,
            t=t,
            grad_map=grad_map,
            catalog_presets=catalog_presets,
        )

        # BGR → RGB for MoviePy
        frame = frame[..., ::-1]

        if task_id is not None:
            progress.update(task_id, completed=idx + 1)

        if progress_callback is not None:
            pct = round((idx + 1) / n_frames * 90.0, 1)  # 0 to 90%
            if pct != last_reported_pct:
                last_reported_pct = pct
                progress_callback(pct, idx + 1, n_frames, TARGET_FPS, f"Renderizando 16:9 ({idx + 1}/{n_frames})")

        return frame

    final_16x9 = None
    final_9x16 = None

    if render_16x9:
        codec_args: dict[str, Any]
        if encoder == "h264_amf":
            codec_args = {"codec": "h264_amf", "preset": "speed", "bitrate": "8M"}
        else:
            codec_args = {"codec": "libx264", "preset": "fast", "bitrate": "8M"}

        audio_clip = AudioFileClip(str(audio_path))
        video_clip = VideoClip(make_frame, duration=duration).with_fps(TARGET_FPS)
        video_clip = video_clip.with_audio(audio_clip)

        with progress:
            task_id = progress.add_task("Rendering 16:9", total=n_frames)
            video_clip.write_videofile(
                str(out_16x9),
                fps=TARGET_FPS,
                audio_codec="aac",
                audio_bitrate="192k",
                logger=None,
                **codec_args,
            )

        audio_clip.close()
        video_clip.close()
        console.print(f"[green]✔[/green]  Saved [bold]{out_16x9.name}[/bold]")
        final_16x9 = out_16x9

    # Crop to 9:16 if requested
    if render_9x16:
        source_16x9 = final_16x9 or out_16x9
        if not source_16x9.exists():
            source_16x9 = find_project_video_16x9(project_dir)
        if source_16x9 and source_16x9.exists():
            if progress_callback:
                progress_callback(95.0, n_frames, n_frames, TARGET_FPS, "Generando recorte vertical 9:16…")
            centre_crop_9x16(source_16x9, out_9x16, encoder)
            console.print(f"[green]✔[/green]  Saved [bold]{out_9x16.name}[/bold]")
            final_9x16 = out_9x16

    if progress_callback:
        progress_callback(100.0, n_frames, n_frames, TARGET_FPS, "¡Renderizado completado con éxito!")

    return final_16x9, final_9x16
