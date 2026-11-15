# Waveform Audio Visualizers & Video Rendering Rules

> **Agent Instruction**: This rulebook defines the visualizer waveform algorithms, rendering parameters, and visual fidelity standards for Diryan's Music Factory video generation.

---

## 1. Single Source of Truth: Preview Canvas

The visualizer behavior rendered in the frontend (`frontend/src/components/WaveformPreviewCanvas.jsx`) is the **absolute ground truth** for visual design and movement.
- Videos rendered via `video/renderer.py` must match what the user sees in the web preview canvas.
- Never introduce extraneous visual elements in the video renderer (such as floating random orbs, erratic shapes, or mismatched geometry) that are absent from the preview canvas.

---

## 2. Style-Specific Implementations

### A. 3D Particle Waves (`particle_waves`)
- **Visual Look**: 3D sweeping particle wave mesh ribbons undulating dynamically across depth layers with responsive frequency heights.
- **Firefly Prohibition**: Floating glowing orbs / scattered firefly dots (`_BOKEH_ORBS`) are **STRICTLY PROHIBITED**. The particle wave must only render clean, cohesive ribbon mesh waves without random drifting particles across the screen.

### B. Sine Wave Ribbons (`flowing_ribbons`)
- **Visual Look**: 4 fluid traveling sine wave ribbons with harmonic depth, glowing outlines, and a subtle translucent body fill (~8% opacity) connecting down to the bottom of the screen.
- **Mathematical Curves**:
  - `y = base_y + sin((x / w) * 8.0 + t * speed + phase_offset) * ribbon_amp * energy + cos((x / w) * 14.0 + t * 2.0) * (ribbon_amp * 0.25)`
  - 4 ribbons with staggered speeds and phase offsets (`ribbon * 1.5`).
  - Outline with 2.5px thickness and soft Gaussian shadow blur (~12px).
- **Fidelity**: Must match `drawFlowingRibbons` from `WaveformPreviewCanvas.jsx` 1:1.

---

## 3. Aspect Ratio & Video Formats

- Standard landscape: `1920 × 1080` (16:9).
- Vertical format: `1080 × 1920` (9:16) centre-cropped.
- When rendering waveforms in vertical format, positions and bar widths adapt cleanly to the vertical viewport.

