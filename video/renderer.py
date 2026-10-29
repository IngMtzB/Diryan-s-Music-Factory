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
        sr=sr, n_fft=n_fft, n_mels=bar_count, fmin=35, fmax=14000
    )
    power_spec = S[:, :min_len] ** 2
    mel_spec = np.dot(mel_basis, power_spec)  # (bar_count, time)

    # Convert to dB
    mel_db = librosa.power_to_db(mel_spec, ref=np.max)

    # Equalize frequency sensitivity: slight boost for higher frequencies so hats & vocals pop
    treble_tilt = np.linspace(0.0, 10.0, bar_count)[:, None]
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
    Supported styles:
    - mirrored_bars: Center-out symmetrical spectrum (trap / cinematic channel style)
    - frequency_bars: Left-to-right (Bass → Mid → Treble)
    - equalizer: Segmented digital LED blocks
    - neon_glow_line: Glowing fluid wave curve
    - none: Skip drawing
    """
    wf = spec.get("waveform", {})
    style = wf.get("style", "mirrored_bars")
    if style in ("none", "clean", "off"):
        return frame

    h, w = frame.shape[:2]
    position = wf.get("position", "bottom")
    primary = hex_to_bgr(wf.get("primary_color", "#00E5FF"))
    secondary = hex_to_bgr(wf.get("secondary_color", "#FF2A55"))
    n_bars = len(amplitudes)

    # Reorder amplitudes for mirrored style: Bass in center, Treble on outside
    if style == "mirrored_bars":
        half = n_bars // 2
        # Left half: treble (far left) down to bass (center)
        left_amps = amplitudes[half::-1]
        # Right half: bass (center) up to treble (far right)
        right_amps = amplitudes[:half]
        display_amps = np.concatenate([left_amps, right_amps])[:n_bars]
    else:
        display_amps = amplitudes

    # Geometry setup
    gap = max(2, w // (n_bars * 6))
    total_bar_width = w // n_bars
    bar_w = max(total_bar_width - gap, 2)
    max_bar_h = int(h * 0.28)

    if position == "center":
        base_y = h // 2
    else:  # bottom
        base_y = h - 25

    # ── Style: Neon Glow Line ──────────────────────────────────────────────
    if style == "neon_glow_line":
        points = []
        for i in range(n_bars):
            amp = float(display_amps[i])
            px = int(i * total_bar_width + total_bar_width // 2)
            py = int(base_y - amp * max_bar_h)
            points.append((px, py))

        if len(points) >= 2:
            pts_arr = np.array(points, dtype=np.int32).reshape((-1, 1, 2))
            # Outer glow
            cv2.polylines(frame, [pts_arr], False, secondary, thickness=6, lineType=cv2.LINE_AA)
            # Inner core
            cv2.polylines(frame, [pts_arr], False, primary, thickness=2, lineType=cv2.LINE_AA)
        return frame

    # ── Style: Segmented Equalizer or Rounded Bars ─────────────────────────
    for i in range(n_bars):
        bar_amp = float(np.clip(display_amps[i], 0.02, 1.0))
        bar_h = max(int(bar_amp * max_bar_h), 4)

        x1 = i * total_bar_width + gap // 2
        x2 = x1 + bar_w
        y1 = base_y - bar_h
        y2 = base_y

        # Dynamic gradient blend
        blend = float(np.clip(bar_amp, 0.0, 1.0))
        color = tuple(
            int(primary[c] * (1.0 - blend) + secondary[c] * blend) for c in range(3)
        )

        if style == "equalizer":
            # Segmented LED blocks
            seg_h = 5
            seg_gap = 2
            segments = max(bar_h // (seg_h + seg_gap), 1)
            for s in range(segments):
                sy2 = base_y - s * (seg_h + seg_gap)
                sy1 = max(sy2 - seg_h, 0)
                # Gradient by segment height
                seg_blend = s / max(segments, 1)
                seg_col = tuple(
                    int(primary[c] * (1.0 - seg_blend) + secondary[c] * seg_blend)
                    for c in range(3)
                )
                cv2.rectangle(frame, (x1, sy1), (x2, sy2), seg_col, -1)
        else:
            # Rounded / Sleek bars with smooth top cap
            radius = min(bar_w // 2, 5)
            cv2.rectangle(frame, (x1, y1 + radius), (x2, y2), color, -1)
            cv2.ellipse(
                frame,
                (x1 + bar_w // 2, y1 + radius),
                (bar_w // 2, radius),
                0, 180, 360, color, -1,
            )

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


# ── Encoder detection ─────────────────────────────────────────────────────────

def _detect_encoder() -> str:
    """Return ``h264_amf`` if available, else ``libx264``."""
    try:
        result = subprocess.run(
            ["ffmpeg", "-hide_banner", "-encoders"],
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

    crop_w, crop_h = WIDTH_9x16, HEIGHT_9x16
    x_offset = (WIDTH_16x9 - crop_w) // 2
    y_offset = 0

    cmd = [
        "ffmpeg", "-y",
        "-i", str(input_path),
        "-vf", f"crop={crop_w}:{crop_h}:{x_offset}:{y_offset}",
        "-c:v", encoder,
        "-b:v", "6M",
        "-c:a", "aac", "-b:a", "192k",
        str(output_path),
    ]
    subprocess.run(cmd, capture_output=True, timeout=600)


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
        codec_args = {"codec": "h264_amf", "bitrate": "8M"}
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
