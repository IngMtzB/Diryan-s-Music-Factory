"""Every waveform style in the CLI menu has an example image in docs/image/examples."""

from __future__ import annotations

import pytest
from PIL import Image

from video.styles import WAVEFORM_STYLES, example_path


def test_style_values_are_unique() -> None:
    values = [v for v, _ in WAVEFORM_STYLES]
    assert len(values) == len(set(values))


@pytest.mark.parametrize("style", [v for v, _ in WAVEFORM_STYLES])
def test_every_style_has_an_example_image(style: str) -> None:
    path = example_path(style)
    assert path.exists(), (
        f"Missing example for '{style}'. Run: python scripts/generate_style_examples.py"
    )
    with Image.open(path) as img:
        w, h = img.size
    assert abs(w / h - 16 / 9) < 0.01


def test_example_generator_draws_every_style(tmp_path, monkeypatch) -> None:
    """The generator script renders each style through the real renderer."""
    import scripts.generate_style_examples as gen

    monkeypatch.setattr(gen, "example_path", lambda s: tmp_path / f"{s}.jpg")
    background = gen.synthetic_background()
    amps = gen.synthetic_spectrum()
    for style, _ in WAVEFORM_STYLES:
        out = gen.render_example(style, background, amps, gen.DEFAULT_PALETTE)
        assert out.exists() and out.stat().st_size > 0
