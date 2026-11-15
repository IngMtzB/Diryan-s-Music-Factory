"""
video/styles.py — Single source of truth for standardized parametric waveform styles.

Every preset defines both its metadata (`id`, `name`, `desc`, `engine`) and its
normalized visual parameters (`params`) so that the Web Preview Canvas
(`WaveformPreviewCanvas.jsx`) and the Python OpenCV Video Renderer
(`video/renderer.py`) produce 100% identical visual output.

Each built-in style also has an example screenshot at ``docs/image/examples/<value>.jpg``
(regenerate them with ``python scripts/generate_style_examples.py``).
"""

from __future__ import annotations

import copy
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent
EXAMPLES_DIR = ROOT_DIR / "docs" / "image" / "examples"

# (value, menu label) — order is the order shown in the CLI menu.
WAVEFORM_STYLES: list[tuple[str, str]] = [
    ("rounded_mirror", "✨ Capsule Bars with Water Reflection (Image 1 style — Clean & Modern)"),
    ("dot_matrix", "🟣 Halftone LED Dot Matrix (Image 2 style — Stadium Concert Grid)"),
    ("neon_ladder", "🎛️ Neon Segmented Ladder with Floor Reflection (Image 4 style — 3D Cyber Club)"),
    ("center_symmetrical", "⚡ Double-Sided Center Soundwave (Image 5 style — Stem Waveform)"),
    ("flowing_ribbons", "〰️ Glowing Sine Wave Ribbons (Image 3 style — Fluid Multi-Harmonics)"),
    ("particle_waves", "🌌 Glowing 3D Particle Waves (Docs style — Fluid Particle Field)"),
    ("sharp_spikes", "📐 Cyber Polygon Spikes (Image 3 style — Razor-sharp EDM Trap)"),
    ("mirrored_bars", "📊 Classic Mirrored Spectrum (Solid rounded bars — Bass in Center)"),
    ("frequency_bars", "📈 Classic Frequency Bars (Solid rounded bars — Left to Right)"),
    ("none", "🚫 Clean (No waveform — Camera shake & beat pulse only)"),
]

# Default gradient direction the menu pre-selects for each style.
HORIZONTAL_DEFAULT_STYLES = ("rounded_mirror", "center_symmetrical", "sharp_spikes", "particle_waves")

# Standardized Parametric Waveform Presets (1:1 ground truth matching WaveformPreviewCanvas.jsx)
DEFAULT_WAVEFORM_PRESETS: list[dict[str, Any]] = [
    {
        "id": "rounded_mirror",
        "name": "CAPSULE BARS & REFLECTION",
        "desc": "Barras cápsula con reflejo de agua [Limpio y moderno]",
        "engine": "rounded_mirror",
        "isBuiltin": True,
        "params": {
            "engine": "rounded_mirror",
            "bar_count": 48,
            "base_y_ratio": round(1.0 - 130.0 / 720.0, 4),  # 0.8194 (h - 130 at 720p)
            "max_height_ratio": 0.26,
            "symmetry": "none",
            "gap_divisor": 5.0,
            "roundness": 4.0,
            "reflection_enabled": True,
            "reflection_scale": 0.55,
            "reflection_opacity": 0.28,
            "reflection_gap": 6.0,
            "glow_blur": 8.0,
            "ribbon_count": 4,
            "wave_speed": 1.2,
            "fill_opacity": 0.082,
            "line_width": 2.5,
            "grid_cols": 28,
            "grid_rows": 14,
            "default_color_mode": "horizontal",
        },
    },
    {
        "id": "dot_matrix",
        "name": "LED DOT MATRIX",
        "desc": "Matriz de puntos LED tipo concierto y festival rave",
        "engine": "dot_matrix",
        "isBuiltin": True,
        "params": {
            "engine": "dot_matrix",
            "bar_count": 48,
            "base_y_ratio": round(1.0 - 110.0 / 720.0, 4),  # 0.8472 (h - 110 at 720p)
            "max_height_ratio": 0.28,
            "symmetry": "none",
            "gap_divisor": 5.0,
            "roundness": 4.0,
            "reflection_enabled": False,
            "reflection_scale": 0.35,
            "reflection_opacity": 0.20,
            "reflection_gap": 8.0,
            "glow_blur": 6.0,
            "ribbon_count": 4,
            "wave_speed": 1.2,
            "fill_opacity": 0.082,
            "line_width": 2.5,
            "grid_cols": 48,
            "grid_rows": 14,
            "default_color_mode": "vertical",
        },
    },
    {
        "id": "neon_ladder",
        "name": "NEON LADDER",
        "desc": "Escalera segmentada con brillo neon volumétrico 3D",
        "engine": "neon_ladder",
        "isBuiltin": True,
        "params": {
            "engine": "neon_ladder",
            "bar_count": 48,
            "base_y_ratio": round(1.0 - 120.0 / 720.0, 4),  # 0.8333 (h - 120 at 720p)
            "max_height_ratio": 0.28,
            "symmetry": "none",
            "gap_divisor": 5.0,
            "roundness": 2.0,
            "reflection_enabled": True,
            "reflection_scale": 0.35,
            "reflection_opacity": 0.15,
            "reflection_gap": 8.0,
            "glow_blur": 6.0,
            "ribbon_count": 4,
            "wave_speed": 1.2,
            "fill_opacity": 0.082,
            "line_width": 2.5,
            "grid_cols": 36,
            "grid_rows": 12,
            "default_color_mode": "vertical",
        },
    },
    {
        "id": "center_symmetrical",
        "name": "CENTER SOUNDWAVE",
        "desc": "Onda simétrica central de doble cara con gradiente dinámico",
        "engine": "center_symmetrical",
        "isBuiltin": True,
        "params": {
            "engine": "center_symmetrical",
            "bar_count": 48,
            "base_y_ratio": 0.58,
            "max_height_ratio": 0.22,
            "symmetry": "center",
            "gap_divisor": 5.0,
            "roundness": 4.0,
            "reflection_enabled": False,
            "reflection_scale": 0.40,
            "reflection_opacity": 0.20,
            "reflection_gap": 6.0,
            "glow_blur": 4.0,
            "ribbon_count": 4,
            "wave_speed": 1.2,
            "fill_opacity": 0.082,
            "line_width": 2.5,
            "grid_cols": 28,
            "grid_rows": 12,
            "default_color_mode": "horizontal",
        },
    },
    {
        "id": "flowing_ribbons",
        "name": "SINE WAVE RIBBONS",
        "desc": "Listones fluidos continuos de ondas senoidales suaves",
        "engine": "flowing_ribbons",
        "isBuiltin": True,
        "params": {
            "engine": "flowing_ribbons",
            "bar_count": 48,
            "base_y_ratio": 0.68,
            "max_height_ratio": 0.18,
            "symmetry": "none",
            "gap_divisor": 5.0,
            "roundness": 4.0,
            "reflection_enabled": False,
            "reflection_scale": 0.40,
            "reflection_opacity": 0.20,
            "reflection_gap": 6.0,
            "glow_blur": 12.0,
            "ribbon_count": 4,
            "wave_speed": 1.2,
            "fill_opacity": 0.082,
            "line_width": 2.5,
            "grid_cols": 28,
            "grid_rows": 12,
            "default_color_mode": "vertical",
        },
    },
    {
        "id": "particle_waves",
        "name": "3D PARTICLE WAVES",
        "desc": "Campo ondulatorio 3D limpio reactivo a frecuencias",
        "engine": "particle_waves",
        "isBuiltin": True,
        "params": {
            "engine": "particle_waves",
            "bar_count": 48,
            "base_y_ratio": 0.62,
            "max_height_ratio": 0.18,
            "symmetry": "none",
            "gap_divisor": 5.0,
            "roundness": 4.0,
            "reflection_enabled": False,
            "reflection_scale": 0.40,
            "reflection_opacity": 0.20,
            "reflection_gap": 6.0,
            "glow_blur": 8.0,
            "ribbon_count": 4,
            "wave_speed": 3.0,
            "fill_opacity": 0.082,
            "line_width": 2.5,
            "grid_cols": 28,
            "grid_rows": 12,
            "default_color_mode": "horizontal",
        },
    },
    {
        "id": "sharp_spikes",
        "name": "CYBER SPIKES",
        "desc": "Picos poligonales afilados estilo EDM Trap",
        "engine": "sharp_spikes",
        "isBuiltin": True,
        "params": {
            "engine": "sharp_spikes",
            "bar_count": 48,
            "base_y_ratio": round(1.0 - 100.0 / 720.0, 4),  # 0.8611 (h - 100 at 720p)
            "max_height_ratio": 0.28,
            "symmetry": "none",
            "gap_divisor": 5.0,
            "roundness": 0.0,
            "reflection_enabled": True,
            "reflection_scale": 0.40,
            "reflection_opacity": 0.20,
            "reflection_gap": 4.0,
            "glow_blur": 4.0,
            "ribbon_count": 4,
            "wave_speed": 1.2,
            "fill_opacity": 0.082,
            "line_width": 1.0,
            "grid_cols": 28,
            "grid_rows": 12,
            "default_color_mode": "horizontal",
        },
    },
    {
        "id": "mirrored_bars",
        "name": "MIRRORED SPECTRUM",
        "desc": "Barras sólidas clásicas con bajos centrados",
        "engine": "bars",
        "isBuiltin": True,
        "params": {
            "engine": "bars",
            "bar_count": 48,
            "base_y_ratio": round(1.0 - 70.0 / 720.0, 4),  # 0.9028 (h - 70 at 720p)
            "max_height_ratio": 0.28,
            "symmetry": "center",
            "gap_divisor": 5.0,
            "roundness": 4.0,
            "reflection_enabled": False,
            "reflection_scale": 0.45,
            "reflection_opacity": 0.25,
            "reflection_gap": 6.0,
            "glow_blur": 0.0,
            "ribbon_count": 4,
            "wave_speed": 1.2,
            "fill_opacity": 0.082,
            "line_width": 2.5,
            "grid_cols": 28,
            "grid_rows": 12,
            "default_color_mode": "vertical",
        },
    },
    {
        "id": "frequency_bars",
        "name": "FREQUENCY BARS",
        "desc": "Barras de frecuencia clásicas de izquierda a derecha",
        "engine": "bars",
        "isBuiltin": True,
        "params": {
            "engine": "bars",
            "bar_count": 48,
            "base_y_ratio": round(1.0 - 70.0 / 720.0, 4),  # 0.9028 (h - 70 at 720p)
            "max_height_ratio": 0.28,
            "symmetry": "none",
            "gap_divisor": 5.0,
            "roundness": 4.0,
            "reflection_enabled": False,
            "reflection_scale": 0.45,
            "reflection_opacity": 0.25,
            "reflection_gap": 6.0,
            "glow_blur": 0.0,
            "ribbon_count": 4,
            "wave_speed": 1.2,
            "fill_opacity": 0.082,
            "line_width": 2.5,
            "grid_cols": 28,
            "grid_rows": 12,
            "default_color_mode": "vertical",
        },
    },
    {
        "id": "none",
        "name": "CLEAN // NO WAVEFORM",
        "desc": "Sin onda — Solo movimiento de cámara y pulso rítmico",
        "engine": "none",
        "isBuiltin": True,
        "params": {
            "engine": "none",
            "bar_count": 48,
            "base_y_ratio": 0.85,
            "max_height_ratio": 0.25,
            "symmetry": "none",
            "gap_divisor": 5.0,
            "roundness": 4.0,
            "reflection_enabled": False,
            "reflection_scale": 0.45,
            "reflection_opacity": 0.25,
            "reflection_gap": 6.0,
            "glow_blur": 0.0,
            "ribbon_count": 4,
            "wave_speed": 1.2,
            "fill_opacity": 0.082,
            "line_width": 2.5,
            "grid_cols": 28,
            "grid_rows": 12,
            "default_color_mode": "horizontal",
        },
    },
]


def get_default_waveform_presets() -> list[dict[str, Any]]:
    """Return a deep copy of the factory waveform presets."""
    return copy.deepcopy(DEFAULT_WAVEFORM_PRESETS)


def resolve_waveform_params(
    style_id: str,
    custom_params: dict[str, Any] | None = None,
    catalog_presets: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Resolve the complete standardized parameter dictionary for a waveform style.
    Priority:
    1. Preset matching `style_id` in `catalog_presets` (from .studio_catalog.json)
    2. Preset matching `style_id` in `DEFAULT_WAVEFORM_PRESETS`
    3. Overrides inside `custom_params`
    """
    base_preset = None
    if catalog_presets:
        for p in catalog_presets:
            if p.get("id") == style_id:
                base_preset = p
                break

    if base_preset is None:
        for p in DEFAULT_WAVEFORM_PRESETS:
            if p["id"] == style_id:
                base_preset = p
                break

    if base_preset is None:
        base_preset = DEFAULT_WAVEFORM_PRESETS[0]

    merged = copy.deepcopy(base_preset.get("params", DEFAULT_WAVEFORM_PRESETS[0]["params"]))
    if base_preset.get("engine"):
        merged["engine"] = base_preset["engine"]

    if custom_params and isinstance(custom_params, dict):
        for k, v in custom_params.items():
            if v is not None:
                merged[k] = v

    return merged


def default_color_mode(style: str) -> str:
    return "horizontal" if style in HORIZONTAL_DEFAULT_STYLES else "vertical"


def example_path(style: str) -> Path:
    """Path of the example screenshot for *style*."""
    return EXAMPLES_DIR / f"{style}.jpg"
