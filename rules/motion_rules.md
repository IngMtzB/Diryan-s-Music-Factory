# Motion & Audio-Reactivity Rules

## Audio-Reactive Effects

### 1. Bass Shake (`bass_shake`)
- Triggered when **sub-bass energy** (20 – 150 Hz) exceeds a dynamic threshold.
- The entire background image shifts randomly within a pixel radius.
- `shake_intensity_px`: Integer pixel radius (recommended `3` – `12`).
- Set to `0` to disable.

### 2. Background Pulse (`background_pulse`)
- On each beat, the background image brightness briefly increases by 5 – 15 %.
- Decay time: one frame (instant snap-back for punchy feel).
- Works best with darker backgrounds.

## Camera Shake Intensity Guide

| Genre           | Recommended `shake_intensity_px` |
|-----------------|----------------------------------|
| Lo-fi / Chill   | `0` – `3`                       |
| R&B / Soul      | `3` – `5`                       |
| Pop             | `4` – `7`                       |
| Hip-Hop / Trap  | `6` – `10`                      |
| EDM / Dubstep   | `8` – `12`                      |

## Frame Rate
All renders target **30 fps** to balance quality and file size.

## Smoothing
- Amplitude values are smoothed with a **3-frame rolling average** to prevent
  flicker while preserving transient response.

