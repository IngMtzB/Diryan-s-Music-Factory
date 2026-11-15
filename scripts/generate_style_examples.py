#!/usr/bin/env python3
"""
scripts/generate_style_examples.py — Render one still frame per waveform style
into ``docs/image/examples/<style>.jpg``.

Uses the real renderer (``video.renderer._draw_waveform``), so the examples
always match what the video pipeline draws.

Usage
-----
    # Synthetic background + synthetic spectrum (no project needed)
    python scripts/generate_style_examples.py

    # Real background art + the loudest frame of a project's song
    python scripts/generate_style_examples.py --project projects/tokens_en_ascenso
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

from video.renderer import (  # noqa: E402
    HEIGHT_16x9,
    TARGET_FPS,
    WIDTH_16x9,
    _analyse_audio,
    _draw_waveform,
    extract_palette_from_image,
)
from video.styles import (  # noqa: E402
    EXAMPLES_DIR,
    WAVEFORM_STYLES,
    default_color_mode,
    example_path,
)

BAR_COUNT = 48
DEFAULT_PALETTE = ["#00F0FF", "#B000FF", "#FF007F"]  # Synthwave Neon preset
OUTPUT_WIDTH = 1280  # downscaled JPEG keeps the repo light


def synthetic_background() -> np.ndarray:
    """Dark night-sky gradient with a faint horizon glow (BGR)."""
    h, w = HEIGHT_16x9, WIDTH_16x9
    y = np.linspace(0.0, 1.0, h)[:, None]
    x = np.linspace(-1.0, 1.0, w)[None, :]
    glow = np.exp(-((y - 0.62) ** 2) / 0.01) * np.exp(-(x ** 2) / 0.6)
    r = 18 + 70 * glow + 20 * (1 - y)
    g = 10 + 25 * glow + 8 * (1 - y)
    b = 38 + 90 * glow + 45 * (1 - y)
    rgb = np.stack([np.broadcast_to(c, (h, w)) for c in (r, g, b)], axis=-1)
    return np.clip(rgb, 0, 255).astype(np.uint8)[..., ::-1].copy()


def synthetic_spectrum(n: int = BAR_COUNT) -> np.ndarray:
    """Plausible music spectrum: strong bass, mid bump, rolling-off treble."""
    rng = np.random.RandomState(7)
    pos = np.linspace(0.0, 1.0, n)
    shape = 0.9 * np.exp(-pos / 0.18) + 0.55 * np.exp(-((pos - 0.45) ** 2) / 0.02) + 0.25
    return np.clip(shape + rng.uniform(-0.12, 0.12, n), 0.05, 1.0)


def project_inputs(project_dir: Path) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Background, loudest-frame spectrum and auto palette from a real project."""
    bg_path = project_dir / "03_background.png"
    img = Image.open(bg_path).convert("RGB").resize((WIDTH_16x9, HEIGHT_16x9), Image.LANCZOS)
    background = np.array(img)[..., ::-1].copy()

    amps = synthetic_spectrum()
    audio = project_dir / "03_song.mp3"
    if audio.exists():
        _, _, bands, _, _ = _analyse_audio(audio, TARGET_FPS, bar_count=BAR_COUNT)
        # Most "shapely" frame: loud but with strong contrast between bands,
        # so each style's form is clearly visible.
        score = bands.mean(axis=1) * bands.std(axis=1)
        amps = bands[int(np.argmax(score))]

    c1, c2 = extract_palette_from_image(bg_path)
    return background, amps, [c1, c2]


def render_example(
    style: str, background: np.ndarray, amps: np.ndarray, palette: list[str]
) -> Path:
    spec = {
        "waveform": {
            "style": style,
            "position": "bottom",
            "primary_color": palette[0],
            "secondary_color": palette[-1],
            "palette_colors": palette,
            "color_mode": default_color_mode(style),
            "bar_count": BAR_COUNT,
        }
    }
    frame = _draw_waveform(background.copy(), amps, spec, t=1.0)
    img = Image.fromarray(np.ascontiguousarray(frame[..., ::-1]))
    img = img.resize((OUTPUT_WIDTH, OUTPUT_WIDTH * HEIGHT_16x9 // WIDTH_16x9), Image.LANCZOS)
    out = example_path(style)
    img.save(out, "JPEG", quality=85, optimize=True)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--project", type=Path, help="project folder to take background + audio from")
    parser.add_argument(
        "--palette",
        help="comma-separated hex colors, or 'auto' to sample the project background "
             "(default: Synthwave Neon preset)",
    )
    args = parser.parse_args()

    if args.project:
        background, amps, auto_palette = project_inputs(args.project)
    else:
        background, amps = synthetic_background(), synthetic_spectrum()
        auto_palette = DEFAULT_PALETTE

    palette = DEFAULT_PALETTE
    if args.palette == "auto":
        palette = auto_palette
    elif args.palette:
        palette = [c.strip() for c in args.palette.split(",") if c.strip()]

    EXAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    for style, _label in WAVEFORM_STYLES:
        out = render_example(style, background, amps, palette)
        print(f"[ok] {style:20s} -> {out.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
