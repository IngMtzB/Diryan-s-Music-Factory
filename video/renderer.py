"""
video/renderer.py — Parametric, audio-reactive video renderer with multi-band FFT analysis.

Pipeline
--------
1. Analyse ``03_song.mp3`` with **librosa**:
   - Extract multi-band frequency spectrum (Bass, Mids, Treble).
   - Fast transient attack with smooth exponential decay.
   - Extract sub-bass (20 – 150 Hz) for camera screen shake.
   - Extract overall RMS for beat brightness pulse.
2. Render frame-by-frame with **OpenCV** inside a **MoviePy** transformer:
   - Bass camera shake & beat pulse.
   - Frequency-reactive equalizer / spectrum bars (mirrored or linear).
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
    # Nyquist limit for sr=22050 is 11025 Hz. Setting fmax to 10000 Hz ensures
    # all mel filter channels have full coverage without empty/dead filters at the high end.
    mel_basis = librosa.filters.mel(
        sr=sr, n_fft=n_fft, n_mels=bar_count, fmin=35, fmax=10000
    )
    power_spec = S[:, :min_len] ** 2
    mel_spec = np.dot(mel_basis, power_spec)  # (bar_count, time)

    # Convert to dB
    mel_db = librosa.power_to_db(mel_spec, ref=np.max)

    # Equalize frequency sensitivity: progressive treble boost (+12 dB at top band)
    # so high-hats, percussions, and guitar harmonics bounce visibly
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


# ── Drawing helpers ────────────────────────────────────────────────────────────

def _draw_waveform(
    frame: np.ndarray,
    amplitudes: np.ndarray,
    spec: dict[str, Any],
) -> np.ndarray:
    """
    Draw audio-reactive waveform onto *frame* based on dynamic frequency bands.
    Supported styles (inspired by studio visualizer archetypes):
    - rounded_mirror: Capsule pills with smooth fading water reflection (Image 1 style)
    - dot_matrix: Circular halftone LED stadium dot matrix with glowing peaks (Image 2 style)
    - neon_ladder: Floating horizontal neon blocks with glossy floor reflection (Image 4 style)
    - center_symmetrical: Double-sided soundwave centered on baseline (Image 5 style)
    - flowing_ribbons: Multi-harmonic glowing sine wave ribbons (Image 3 style)
    - sharp_spikes: Razor-sharp geometric polygon spikes (Image 3 style)
    - mirrored_bars: Classic center-out symmetrical spectrum (Trap / Cinematic style)
    - frequency_bars: Classic left-to-right (Bass → Mid → Treble)
    - equalizer: Retro segmented digital LED blocks
    - none: Skip drawing
    """
    wf = spec.get("waveform", {})
    style = wf.get("style", "rounded_mirror")
    if style in ("none", "clean", "off"):
        return frame

    h, w = frame.shape[:2]
    position = wf.get("position", "bottom")
    n_bars = len(amplitudes)

    # Multi-color palette extraction
    palette_hex = wf.get("palette_colors")
    if not palette_hex or not isinstance(palette_hex, list):
        p1 = wf.get("primary_color", "#00E5FF")
        p2 = wf.get("secondary_color", "#FF2A55")
        palette_hex = [p1, p2]
    palette_bgr = [hex_to_bgr(c) for c in palette_hex]

    color_mode = wf.get("color_mode", "auto")
    if color_mode == "auto":
        color_mode = "vertical" if style in ("dot_matrix", "neon_ladder", "equalizer") else "horizontal"

    # Reorder amplitudes for center-out symmetrical styles
    if style in ("mirrored_bars", "center_symmetrical"):
        half = n_bars // 2
        pairs = np.maximum(amplitudes[0::2], amplitudes[1::2])[:half]
        left_amps = pairs[::-1]
        right_amps = pairs
        display_amps = np.concatenate([left_amps, right_amps])[:n_bars]
    else:
        display_amps = amplitudes

    # Geometry setup
    gap = max(2, w // (n_bars * 6))
    total_bar_width = w // n_bars
    bar_w = max(total_bar_width - gap, 2)
    max_bar_h = int(h * 0.28)

    # Base Y positioning (leave headroom for reflection if style features reflection)
    has_reflection = style in ("rounded_mirror", "neon_ladder", "dot_matrix")
    if position == "center":
        base_y = h // 2
    elif has_reflection:
        base_y = h - 140
    else:
        base_y = h - 35

    # ── Style: Flowing Ribbons (Image 3 style) ─────────────────────────────
    if style in ("flowing_ribbons", "neon_glow_line"):
        ribbon_specs = [
            (1.0, 0.0, palette_bgr[0], float(np.mean(display_amps[: len(display_amps) // 3]))),
            (2.2, 1.4, palette_bgr[len(palette_bgr) // 2], float(np.mean(display_amps[len(display_amps) // 3 : 2 * len(display_amps) // 3]))),
            (3.8, 2.8, palette_bgr[-1], float(np.mean(display_amps[2 * len(display_amps) // 3 :]))),
        ]
        for freq_m, phase, r_col, energy in ribbon_specs:
            pts = []
            cur_h = int(max_bar_h * (0.2 + 0.8 * energy))
            for px in range(0, w + 10, 8):
                norm_x = px / float(w)
                envelope = np.sin(norm_x * np.pi)  # pin at edges
                py = int(base_y - np.sin(norm_x * np.pi * 3.5 * freq_m + phase) * cur_h * envelope)
                pts.append((px, py))
            if len(pts) >= 2:
                pts_arr = np.array(pts, dtype=np.int32).reshape((-1, 1, 2))
                cv2.polylines(frame, [pts_arr], False, r_col, thickness=6, lineType=cv2.LINE_AA)
                cv2.polylines(frame, [pts_arr], False, (255, 255, 255), thickness=2, lineType=cv2.LINE_AA)
        return frame

    # ── Horizon line for reflection styles ─────────────────────────────────
    if has_reflection:
        cv2.line(frame, (gap, base_y), (w - gap, base_y), (50, 45, 60), 1, cv2.LINE_AA)

    # ── Style: Sharp Spikes (Image 3 style) ────────────────────────────────
    if style == "sharp_spikes":
        for i in range(n_bars):
            bar_amp = float(np.clip(display_amps[i], 0.03, 1.0))
            bar_h = max(int(bar_amp * max_bar_h), 6)
            x1 = i * total_bar_width + gap // 2
            x2 = x1 + bar_w
            x_mid = (x1 + x2) // 2
            col = interpolate_palette(palette_bgr, i / max(n_bars - 1, 1))

            # Main upward spike
            pts_up = np.array([[x1, base_y], [x_mid, base_y - bar_h], [x2, base_y]], dtype=np.int32)
            cv2.fillPoly(frame, [pts_up], col, lineType=cv2.LINE_AA)

            # Mirrored downward spike
            down_h = int(bar_h * 0.45)
            pts_down = np.array([[x1, base_y], [x_mid, min(base_y + down_h, h - 2)], [x2, base_y]], dtype=np.int32)
            dim_col = tuple(int(c * 0.55) for c in col)
            cv2.fillPoly(frame, [pts_down], dim_col, lineType=cv2.LINE_AA)
        return frame

    # ── Style: Center Symmetrical (Image 5 style) ──────────────────────────
    if style == "center_symmetrical":
        cv2.line(frame, (gap, base_y), (w - gap, base_y), (70, 70, 85), 1, cv2.LINE_AA)
        for i in range(n_bars):
            bar_amp = float(np.clip(display_amps[i], 0.03, 1.0))
            half_h = max(int(bar_amp * max_bar_h // 2), 4)
            x1 = i * total_bar_width + gap // 2
            x2 = x1 + bar_w
            y1 = max(base_y - half_h, 8)
            y2 = min(base_y + half_h, h - 8)
            radius = min(bar_w // 2, 6)

            col = interpolate_palette(palette_bgr, i / max(n_bars - 1, 1))

            if y2 - radius > y1 + radius:
                cv2.rectangle(frame, (x1, y1 + radius), (x2, y2 - radius), col, -1)
                cv2.ellipse(frame, (x1 + bar_w // 2, y1 + radius), (bar_w // 2, radius), 0, 180, 360, col, -1)
                cv2.ellipse(frame, (x1 + bar_w // 2, y2 - radius), (bar_w // 2, radius), 0, 0, 180, col, -1)
            else:
                cv2.rectangle(frame, (x1, y1), (x2, y2), col, -1)
        return frame

    # ── Style: Dot Matrix (Image 2 style) ──────────────────────────────────
    if style == "dot_matrix":
        max_dots = 20
        dot_r = max(3, bar_w // 2 - 2)
        step_y = dot_r * 2 + 5

        for i in range(n_bars):
            bar_amp = float(np.clip(display_amps[i], 0.04, 1.0))
            active_dots = max(1, int(bar_amp * max_dots))
            cx = i * total_bar_width + total_bar_width // 2

            # Faint background column mesh
            for d in range(active_dots, min(active_dots + 4, max_dots)):
                cy = base_y - d * step_y
                if cy > 10:
                    cv2.circle(frame, (cx, cy), dot_r, (28, 22, 38), -1, cv2.LINE_AA)

            # Active glowing dots
            for d in range(active_dots):
                cy = base_y - d * step_y
                if cy < 10:
                    break
                blend = (d / max(max_dots - 1, 1)) if color_mode == "vertical" else (i / max(n_bars - 1, 1))
                dot_col = interpolate_palette(palette_bgr, blend)

                if d == active_dots - 1:
                    # Peak dot spark & halo
                    cv2.circle(frame, (cx, cy), dot_r + 3, dot_col, 2, cv2.LINE_AA)
                    cv2.circle(frame, (cx, cy), dot_r, dot_col, -1, cv2.LINE_AA)
                    cv2.circle(frame, (cx, cy), max(2, dot_r - 2), (255, 255, 255), -1, cv2.LINE_AA)
                else:
                    cv2.circle(frame, (cx, cy), dot_r, dot_col, -1, cv2.LINE_AA)

            # Floor reflection dots
            for d in range(min(active_dots, 5)):
                cy_ref = base_y + (d + 1) * step_y
                if cy_ref < h - 4:
                    blend = (d / max(max_dots - 1, 1)) if color_mode == "vertical" else (i / max(n_bars - 1, 1))
                    ref_col = interpolate_palette(palette_bgr, blend)
                    dim_col = tuple(int(c * 0.28 * (1.0 - d / 5.0)) for c in ref_col)
                    cv2.circle(frame, (cx, cy_ref), dot_r, dim_col, -1, cv2.LINE_AA)
        return frame

    # ── Styles: Rounded Mirror, Neon Ladder, Equalizer, Mirrored/Frequency Bars ──
    for i in range(n_bars):
        bar_amp = float(np.clip(display_amps[i], 0.02, 1.0))
        bar_h = max(int(bar_amp * max_bar_h), 5)
        x1 = i * total_bar_width + gap // 2
        x2 = x1 + bar_w
        y1 = base_y - bar_h
        y2 = base_y

        horiz_col = interpolate_palette(palette_bgr, i / max(n_bars - 1, 1))

        if style == "rounded_mirror":
            # Image 1 style: Capsule pill with water reflection
            radius = min(bar_w // 2, 7)
            col = horiz_col
            cv2.rectangle(frame, (x1, y1 + radius), (x2, y2), col, -1)
            cv2.ellipse(frame, (x1 + bar_w // 2, y1 + radius), (bar_w // 2, radius), 0, 180, 360, col, -1)

            # Reflection fading downward
            ref_h = int(bar_h * 0.65)
            if ref_h > 2 and base_y + ref_h <= h:
                alpha = np.linspace(0.38, 0.02, ref_h)[:, None, None]
                orig = frame[base_y : base_y + ref_h, x1:x2].astype(np.float32)
                frame[base_y : base_y + ref_h, x1:x2] = (
                    orig * (1.0 - alpha) + np.array(col, dtype=np.float32) * alpha
                ).astype(np.uint8)

        elif style == "neon_ladder":
            # Image 4 style: Segmented neon blocks with glossy floor reflection
            seg_h, seg_gap = 6, 3
            segments = max(bar_h // (seg_h + seg_gap), 1)
            for s in range(segments):
                sy2 = base_y - s * (seg_h + seg_gap)
                sy1 = max(sy2 - seg_h, 0)
                blend = (s / max(segments, 1)) if color_mode == "vertical" else (i / max(n_bars - 1, 1))
                seg_col = interpolate_palette(palette_bgr, blend)

                if s == segments - 1:
                    cv2.rectangle(frame, (x1 - 1, sy1 - 1), (x2 + 1, sy2 + 1), seg_col, 1)
                    cv2.rectangle(frame, (x1, sy1), (x2, sy2), (255, 255, 255), -1)
                else:
                    cv2.rectangle(frame, (x1, sy1), (x2, sy2), seg_col, -1)

            # Glossy floor reflection
            ref_segs = min(segments, 10)
            for s in range(ref_segs):
                ry1 = base_y + s * (seg_h + seg_gap) + 3
                ry2 = min(ry1 + seg_h, h)
                if ry2 <= ry1 or ry1 >= h:
                    break
                blend = (s / max(segments, 1)) if color_mode == "vertical" else (i / max(n_bars - 1, 1))
                seg_col = interpolate_palette(palette_bgr, blend)
                alpha = 0.32 * (1.0 - s / float(ref_segs))
                orig = frame[ry1:ry2, x1:x2].astype(np.float32)
                frame[ry1:ry2, x1:x2] = (
                    orig * (1.0 - alpha) + np.array(seg_col, dtype=np.float32) * alpha
                ).astype(np.uint8)

        elif style == "equalizer":
            # Classic studio LED blocks
            seg_h, seg_gap = 5, 2
            segments = max(bar_h // (seg_h + seg_gap), 1)
            for s in range(segments):
                sy2 = base_y - s * (seg_h + seg_gap)
                sy1 = max(sy2 - seg_h, 0)
                blend = (s / max(segments, 1)) if color_mode == "vertical" else (i / max(n_bars - 1, 1))
                seg_col = interpolate_palette(palette_bgr, blend)
                cv2.rectangle(frame, (x1, sy1), (x2, sy2), seg_col, -1)

        else:
            # Solid rounded bars (mirrored_bars or frequency_bars)
            radius = min(bar_w // 2, 5)
            col = horiz_col if color_mode == "horizontal" else interpolate_palette(palette_bgr, bar_amp)
            cv2.rectangle(frame, (x1, y1 + radius), (x2, y2), col, -1)
            cv2.ellipse(frame, (x1 + bar_w // 2, y1 + radius), (bar_w // 2, radius), 0, 180, 360, col, -1)

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

    # Scale shake proportionally with subbass impact
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

def _centre_crop_9x16(input_path: Path, output_path: Path, encoder: str) -> None:
    """Crop the 16:9 video to 9:16 (portrait) centred."""
    console.print("[dim]Cropping 9:16 vertical version…[/dim]")

    ffmpeg_exe = _get_ffmpeg_exe()

    # In 16:9 (1920x1080), a 9:16 crop box has height 1080 and width 1080*(9/16) = 607.5 -> 608.
    # We crop the central 608x1080 window and scale up to target 1080x1920.
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


# ── Main render entry point ───────────────────────────────────────────────────

def render(
    project_dir: Path, custom_render_spec: dict[str, Any] | None = None
) -> tuple[Path, Path]:
    """
    Full render pipeline.

    Reads ``01_styles.json``, ``03_background.png``, and ``03_song.mp3``
    from *project_dir*. Writes ``04_video_16x9.mp4`` and ``04_video_9x16.mp4``.
    Uses *custom_render_spec* if provided to customize visualizer style & motion.
    """
    styles_file = project_dir / "01_styles.json"
    if styles_file.exists():
        styles = json.loads(styles_file.read_text(encoding="utf-8"))
    else:
        styles = {}

    render_spec = custom_render_spec or styles.get("render_spec", {})
    motion = render_spec.get("motion_effects", {})
    wf_spec = render_spec.get("waveform", {})
    bar_count = int(wf_spec.get("bar_count", 48))

    bg_path = project_dir / "03_background.png"
    bg_img = Image.open(bg_path).convert("RGB")
    bg_img = bg_img.resize((WIDTH_16x9, HEIGHT_16x9), Image.LANCZOS)
    bg_array = np.array(bg_img)[..., ::-1]  # RGB → BGR for OpenCV

    audio_path = project_dir / "03_song.mp3"

    # Multi-band frequency analysis
    rms, subbass, freq_bands, duration, n_frames = _analyse_audio(
        audio_path, TARGET_FPS, bar_count=bar_count
    )

    do_shake = motion.get("bass_shake", True)
    shake_px = int(motion.get("shake_intensity_px", 6))
    do_pulse = motion.get("background_pulse", True)
    shake_rng = np.random.RandomState(42)

    encoder = _detect_encoder()
    out_16x9 = project_dir / "04_video_16x9.mp4"
    out_9x16 = project_dir / "04_video_9x16.mp4"

    console.print(f"[bold]Rendering {n_frames} frames @ {TARGET_FPS} fps…[/bold]")

    progress = Progress(
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TimeRemainingColumn(),
        console=console,
    )

    task_id = None

    def make_frame(t: float) -> np.ndarray:
        """Generate a single BGR frame, then convert to RGB for MoviePy."""
        nonlocal task_id
        idx = min(int(t * TARGET_FPS), n_frames - 1, len(rms) - 1)

        frame = bg_array.copy()

        # Pulse brightness on beat
        if do_pulse:
            frame = _apply_pulse(frame, float(rms[idx]))

        # Bass camera shake on kick/808 hits
        if do_shake:
            frame = _apply_shake(frame, float(subbass[idx]), shake_px, shake_rng)

        # Dynamic multi-band frequency waveform
        current_amplitudes = freq_bands[idx]
        frame = _draw_waveform(frame, current_amplitudes, render_spec)

        # BGR → RGB for MoviePy
        frame = frame[..., ::-1]

        if task_id is not None:
            progress.update(task_id, completed=idx + 1)

        return frame

    # Write 16:9 video
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

    console.print(f"[green]✔[/green]  Saved [bold]{out_16x9.name}[/bold]")

    # Crop to 9:16
    _centre_crop_9x16(out_16x9, out_9x16, encoder)
    console.print(f"[green]✔[/green]  Saved [bold]{out_9x16.name}[/bold]")

    audio_clip.close()
    video_clip.close()

    return out_16x9, out_9x16
