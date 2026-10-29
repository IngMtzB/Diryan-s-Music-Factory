# Visual Composition Rules

## Waveform Styles
Select **one** style per video:

| Style           | Description                                                        |
|-----------------|--------------------------------------------------------------------|
| `rounded_bars`  | Smoothly rounded vertical bars that react to frequency bins.       |
| `equalizer`     | Classic segmented equalizer columns with stepped amplitude levels. |

## Waveform Position
Place the waveform in one of these regions:

- `bottom` — Lower 20 % of the frame. Best for landscape/portrait backgrounds.
- `center` — Vertically centered. Best for abstract or dark backgrounds.

## Color Palettes
Provide **two** hex colours:

- `primary_color` — Dominant waveform fill (e.g., `#00FFAA`).
- `secondary_color` — Gradient tip / glow accent (e.g., `#FF00FF`).

Choose colours that **contrast** the background image while matching the musical genre:
- Lo-fi / Chill → pastel, muted tones
- Trap / Hip-Hop → neon, high-saturation
- Electronic / EDM → cyan + magenta complementary
- R&B / Soul → warm golds and deep purples

## Bar Count
- Minimum: `20`
- Maximum: `80`
- Default: `48`

More bars = more visual detail. Fewer bars = bolder, simpler look.

## Lower-Third Composition Space
When generating the `image_prompt` for the background image, always instruct the
image model to keep the **lower 25 %** of the frame as a darker, less detailed
region (gradient fade, ground plane, mist, etc.) so the waveform overlay remains
legible.

## Aspect Ratios
- Primary output: **16:9** (1920 × 1080)
- Secondary output: **9:16** (1080 × 1920) — centre-cropped from the 16:9 master.

