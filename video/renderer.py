"""
video/renderer.py — Parametric, audio-reactive video renderer.

Pipeline
--------
1. Analyse ``03_song.mp3`` with **librosa** to extract per-frame RMS
   energy and sub-bass (20 – 150 Hz) energy.
2. Pre-compute smoothed amplitude arrays for fast frame processing.
3. Use **OpenCV** inside a **MoviePy** ``fl`` transformer to:
   - Apply background screen-shake on sub-bass hits.
   - Draw audio-reactive waveform bars matching ``render_spec``.
4. Export 16:9 and centre-cropped 9:16 videos using AMD ``h264_amf``
   GPU encoding with automatic fallback to ``libx264``.
"""

from __future__ import annotations

import subprocess
import json
from pathlib import Path
from typing import Any

import cv2
import librosa
import numpy as np
from moviepy import AudioFileClip, ImageClip, VideoClip
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
SMOOTH_WINDOW = 3  # frames for rolling average


# ── Audio analysis ─────────────────────────────────────────────────────────────

def _analyse_audio(
    audio_path: Path, fps: int = TARGET_FPS
) -> tuple[np.ndarray, np.ndarray, float, int]:
    """
    Return (rms_per_frame, subbass_per_frame, duration, n_frames).

    ``rms_per_frame``     — overall RMS energy per video frame.
    ``subbass_per_frame`` — RMS of the 20 – 150 Hz band per frame.
    """
    console.print("[dim]Analysing audio…[/dim]")
    y, sr = librosa.load(str(audio_path), sr=22050, mono=True)
    duration: float = librosa.get_duration(y=y, sr=sr)
    n_frames = int(np.ceil(duration * fps))
    hop = max(1, len(y) // n_frames)

    # Overall RMS
    rms = librosa.feature.rms(y=y, frame_length=hop * 2, hop_length=hop)[0]

    # Sub-bass band (20–150 Hz) via STFT bandpass
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    mask = (freqs >= 20) & (freqs <= 150)
    subbass = np.mean(S[mask, :], axis=0)

    # Align lengths
    min_len = min(len(rms), len(subbass), n_frames)
    rms = rms[:min_len]
    subbass = subbass[:min_len]

    # Normalise to 0–1
    rms = rms / (rms.max() + 1e-8)
    subbass = subbass / (subbass.max() + 1e-8)

    # Smooth
    kernel = np.ones(SMOOTH_WINDOW) / SMOOTH_WINDOW
    rms = np.convolve(rms, kernel, mode="same")
    subbass = np.convolve(subbass, kernel, mode="same")

    return rms, subbass, duration, min_len


# ── Drawing helpers ────────────────────────────────────────────────────────────

def _hex_to_bgr(hex_color: str) -> tuple[int, int, int]:
    """Convert ``#RRGGBB`` → OpenCV BGR tuple."""
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return (b, g, r)


def _draw_waveform(
    frame: np.ndarray,
    amplitude: float,
    spec: dict[str, Any],
) -> np.ndarray:
    """Draw audio-reactive bars onto *frame* (modified in-place)."""
    h, w = frame.shape[:2]
    wf = spec.get("waveform", {})
    style = wf.get("style", "rounded_bars")
    position = wf.get("position", "bottom")
    primary = _hex_to_bgr(wf.get("primary_color", "#00FFAA"))
    secondary = _hex_to_bgr(wf.get("secondary_color", "#FF00FF"))
    bar_count = int(wf.get("bar_count", 48))

    # Geometry
    gap = 2
    total_bar_width = w // bar_count
    bar_w = max(total_bar_width - gap, 2)
    max_bar_h = int(h * 0.35)

    # Y anchor
    if position == "center":
        base_y = h // 2 + max_bar_h // 2
    else:  # bottom
        base_y = h - 20

    # Pseudo-random per-bar variation seeded by index (deterministic shimmer)
    rng = np.random.RandomState(42)
    bar_offsets = rng.uniform(0.5, 1.0, size=bar_count)

    for i in range(bar_count):
        bar_amp = float(np.clip(amplitude * bar_offsets[i], 0, 1))
        bar_h = int(bar_amp * max_bar_h)
        if bar_h < 2:
            bar_h = 2

        x1 = i * total_bar_width + gap // 2
        x2 = x1 + bar_w
        y1 = base_y - bar_h
        y2 = base_y

        # Gradient: bottom → primary, top → secondary
        blend = bar_amp
        color = tuple(
            int(primary[c] * (1 - blend) + secondary[c] * blend) for c in range(3)
        )

        if style == "equalizer":
            # Segmented blocks
            seg_h = max(bar_h // 6, 3)
            segments = max(bar_h // (seg_h + 1), 1)
            for s in range(segments):
                sy1 = y2 - (s + 1) * (seg_h + 1)
                sy2 = sy1 + seg_h
                cv2.rectangle(frame, (x1, sy1), (x2, sy2), color, -1)
        else:
            # Rounded bars
            radius = min(bar_w // 2, 6)
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
    """Translate *frame* randomly if sub-bass exceeds threshold."""
    if intensity_px <= 0 or subbass < 0.55:
        return frame

    dx = rng.randint(-intensity_px, intensity_px + 1)
    dy = rng.randint(-intensity_px, intensity_px + 1)
    M = np.float32([[1, 0, dx], [0, 1, dy]])
    return cv2.warpAffine(
        frame, M, (frame.shape[1], frame.shape[0]), borderMode=cv2.BORDER_REFLECT
    )


def _apply_pulse(frame: np.ndarray, rms: float) -> np.ndarray:
    """Briefly brighten the frame proportional to RMS energy."""
    if rms < 0.4:
        return frame
    boost = 1.0 + 0.15 * rms
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

    codec_args: dict[str, Any]
    if encoder == "h264_amf":
        codec_args = {"codec": "h264_amf", "bitrate": "6M"}
    else:
        codec_args = {"codec": "libx264", "preset": "fast", "bitrate": "6M"}

    # Use ffmpeg directly for the crop — much faster than re-decoding in Python
    crop_w, crop_h = WIDTH_9x16, HEIGHT_9x16
    x_offset = (WIDTH_16x9 - crop_w) // 2
    y_offset = 0  # top-aligned to keep waveform region

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

def render(project_dir: Path) -> tuple[Path, Path]:
    """
    Full render pipeline.

    Reads ``01_styles.json``, ``03_background.png``, and ``03_song.mp3``
    from *project_dir*.  Writes ``04_video_16x9.mp4`` and
    ``04_video_9x16.mp4``.

    Returns paths to the two output files.
    """
    # ── Load inputs ────────────────────────────────────────────────────────
    styles = json.loads(
        (project_dir / "01_styles.json").read_text(encoding="utf-8")
    )
    render_spec = styles.get("render_spec", {})
    motion = render_spec.get("motion_effects", {})

    bg_img = Image.open(project_dir / "03_background.png").convert("RGB")
    bg_img = bg_img.resize((WIDTH_16x9, HEIGHT_16x9), Image.LANCZOS)
    bg_array = np.array(bg_img)[..., ::-1]  # RGB → BGR for OpenCV

    audio_path = project_dir / "03_song.mp3"

    # ── Audio analysis ─────────────────────────────────────────────────────
    rms, subbass, duration, n_frames = _analyse_audio(audio_path, TARGET_FPS)

    # ── Motion settings ────────────────────────────────────────────────────
    do_shake = motion.get("bass_shake", False)
    shake_px = int(motion.get("shake_intensity_px", 0))
    do_pulse = motion.get("background_pulse", False)
    shake_rng = np.random.RandomState(0)

    encoder = _detect_encoder()
    out_16x9 = project_dir / "04_video_16x9.mp4"
    out_9x16 = project_dir / "04_video_9x16.mp4"

    # ── Build frame generator ──────────────────────────────────────────────
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

        # Pulse
        if do_pulse:
            frame = _apply_pulse(frame, float(rms[idx]))

        # Shake
        if do_shake:
            frame = _apply_shake(frame, float(subbass[idx]), shake_px, shake_rng)

        # Waveform overlay
        frame = _draw_waveform(frame, float(rms[idx]), render_spec)

        # BGR → RGB for MoviePy
        frame = frame[..., ::-1]

        # Update progress
        if task_id is not None:
            progress.update(task_id, completed=idx + 1)

        return frame

    # ── Write 16:9 video ───────────────────────────────────────────────────
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

    # ── Crop → 9:16 ───────────────────────────────────────────────────────
    _centre_crop_9x16(out_16x9, out_9x16, encoder)
    console.print(f"[green]✔[/green]  Saved [bold]{out_9x16.name}[/bold]")

    # Cleanup
    audio_clip.close()
    video_clip.close()

    return out_16x9, out_9x16

