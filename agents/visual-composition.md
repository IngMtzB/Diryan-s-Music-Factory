# Visual Composition & Image Generation Rules

> **Agent Instruction**: This rulebook defines the strict requirements for generating visual prompts and background images (`03_background.png`) for Diryan's Music Factory.

---

## 1. 16:9 Widescreen to 9:16 Vertical Crop Safety

All background images are generated in **16:9** aspect ratio (1920 × 1080 or closest model equivalent), but they **MUST BE DESIGNED TO LOOK STUNNING WHEN CROPPED TO 9:16 VERTICAL FORMAT** (1080 × 1920 for TikTok, Instagram Reels, and YouTube Shorts).

### Core Rules:
1. **Centered Safe Zone**:
   - Keep all primary characters, focal subjects, action, and key visual storytelling strictly centered within the central 9:16 vertical column (the central 33%–50% horizontal span of the 16:9 frame).
   - Never place essential narrative elements or main characters at the extreme left or right edges where they will be cut off during vertical cropping.
2. **Balanced Side Wings**:
   - The left and right thirds of the 16:9 image should feature complementary environmental details, lighting, ambiance, or background texture that enriches the widescreen experience without being critical for vertical viewing.
3. **Prompt Formulation**:
   - Whenever crafting an `image_prompt`, you MUST explicitly demand:
     *"Wide 16:9 cinematic composition with all primary subjects and action centered in the central 9:16 safe zone, ensuring the image looks complete and stunning both in 16:9 widescreen and when center-cropped to 9:16 vertical video format."*

---

## 2. Lower 25% Clearance for Waveforms

Audio waveforms and visualizers render across the lower portion of the screen.
- The lower 25% of the frame must remain darker, uncluttered, and low-contrast (e.g., ground plane, mist, dark floor, shadow gradient, subtle floor reflection).
- Avoid high-frequency bright details, text, faces, or essential focal points in the lower 25%.

---

## 3. Style and Tone Consistency

- **Theme**: Cyberpunk, dark tech office, dramatic Mexican regional / futuristic neo-western aesthetic, neon terminals, glowing code, server racks, server rooms at 3 AM.
- **Lighting**: High-contrast cinematic lighting, volumetric neon glows, deep moody shadows.
- **Strictly No Text**: The image model must never generate readable letters, watermarks, or logos directly onto the image raster.

