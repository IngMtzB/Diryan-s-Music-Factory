# 🎶 Diryan's Factory Music

**AI-Driven Music Video Generator with Audio-Reactive Visual Overlays**

[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue?logo=python&logoColor=white)](https://python.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Powered by Gemini](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev)
[![Powered by Claude](https://img.shields.io/badge/AI-Claude%203.5%20Sonnet-blueviolet)](https://anthropic.com)

</div>

---

## What Is This?

**Diryan's Factory Music** is a local Python CLI application that turns a single song idea into a fully rendered music video. You describe a concept and genre — the app writes the lyrics, generates a matching background image, waits for you to drop an MP3, then renders a 16:9 landscape and 9:16 portrait video with audio-reactive waveforms and beat-synced visual effects.

Everything runs locally. No subscription. Just your API keys.

---

## Feature Highlights

| Feature | Detail |
|---|---|
| 🎛️ Dual AI Provider | Gemini (all-in-one) or Anthropic + OpenAI |
| 📝 AI Lyrics | Full song with verse/chorus/bridge structure |
| 🖼️ AI Background | Imagen 3 or DALL-E 3 — genre-matched 16:9 art |
| 🌊 Audio-Reactive Waveform | `rounded_bars` or `equalizer`, positioned & coloured by the AI |
| 🔊 Bass Shake | Screen shake triggered on sub-bass (20–150 Hz) hits |
| 💡 Background Pulse | Beat-synced brightness pulse |
| ⚡ GPU Encoding | AMD `h264_amf` auto-detected; falls back to `libx264` |
| 📱 Dual Format Output | 1920×1080 landscape + 1080×1920 portrait (centre-cropped) |

---

## Prerequisites

Before you begin, install these system-level tools:

### 1. Python 3.11 or higher

Download from [python.org](https://python.org/downloads). Verify:

```powershell
python --version
```

### 2. FFmpeg

FFmpeg must be on your system `PATH`. The renderer uses it for video encoding.

**Windows (recommended via Chocolatey):**
```powershell
choco install ffmpeg
```

**Or download manually:** https://ffmpeg.org/download.html → add the `bin/` folder to your `PATH`.

Verify:
```powershell
ffmpeg -version
```

### 3. GPU Driver (optional, for hardware encoding)

If you have an **AMD GPU**, install the latest [AMD Software / Adrenalin drivers](https://www.amd.com/en/support) to unlock `h264_amf` GPU encoding. The app falls back to CPU encoding automatically if the driver isn't found.

---

## Installation

```powershell
# 1 — Navigate into the project folder
cd "c:\Users\t18\Documents\personal\Diryan's music factory\Diryans_factory_music"

# 2 — Create an isolated virtual environment
python -m venv .venv

# 3 — Activate it
Set-ExecutionPolicy Unrestricted -Scope Process
.\.venv\Scripts\Activate.ps1

# 4 — Install all Python dependencies
pip install -r requirements.txt
```

---

## API Keys

The app manages keys for you — you only need to have them ready.

| Provider Mode | Keys Required |
|---|---|
| **Gemini** (default) | `GEMINI_API_KEY` |
| **Anthropic** | `ANTHROPIC_API_KEY` + `OPENAI_API_KEY` |

When a key is missing, the CLI will securely prompt you to paste it (input is masked). Keys are saved to `.env` and reused on future runs. You can also create a `.env` file manually:

```dotenv
# .env  — place this in Diryans_factory_music/
GEMINI_API_KEY=your_key_here

# Anthropic mode only:
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
```

---

## Running the App

```powershell
# Make sure your venv is active first
.\.venv\Scripts\Activate.ps1

python main.py
```

---

## Quick-Start Workflow

```
1. Select provider   →  Gemini (default) or Anthropic
2. Enter keys        →  if not in .env, prompted securely
3. Describe song     →  concept + genre
4. AI generates      →  lyrics, render spec, background image
5. Drop audio        →  copy your 03_song.mp3 into the project folder
6. Video renders     →  04_video_16x9.mp4 + 04_video_9x16.mp4
```

> See **[docs/usage.md](docs/usage.md)** for the full interactive walkthrough.  
> See **[docs/flows.md](docs/flows.md)** for architecture and pipeline flow diagrams.

---

## Project Structure

```
Diryans_factory_music/
├── main.py                    ← CLI entrypoint  (start here)
├── config.py                  ← .env + API key management
├── requirements.txt           ← Python dependencies
├── .env                       ← Your API keys (auto-created, git-ignored)
│
├── rules/                     ← AI rulebooks injected into every prompt
│   ├── visual_rules.md        ← Waveform styles, colours, composition
│   ├── motion_rules.md        ← Bass shake, pulse, intensity guide
│   └── lyrics_rules.md        ← Song structure, writing rules
│
├── services/
│   ├── api_client.py          ← GeminiProvider / AnthropicProvider
│   ├── prompt_engine.py       ← Rule loader + LLM spec requester
│   └── project_manager.py     ← Workspace creation + audio polling
│
├── video/
│   └── renderer.py            ← librosa + OpenCV + MoviePy pipeline
│
├── docs/                      ← Manuals (you are here)
│   ├── usage.md
│   └── flows.md
│
└── projects/                  ← Generated project folders live here
    └── <song_slug>/
        ├── 01_styles.json
        ├── 02_lyrics.txt
        ├── 03_background.png
        ├── 03_song.mp3        ← you drop this in
        ├── 04_video_16x9.mp4
        └── 04_video_9x16.mp4
```

---

## Documentation Index

| Document | Contents |
|---|---|
| [docs/usage.md](docs/usage.md) | Step-by-step CLI walkthrough, project output explanation, tips & troubleshooting |
| [docs/flows.md](docs/flows.md) | Architecture overview, provider decision flow, audio-render pipeline, data flow diagrams |

---

## Troubleshooting

**`ModuleNotFoundError`** — Make sure your venv is active and `pip install -r requirements.txt` completed without errors.

**`ffmpeg not found`** — Ensure FFmpeg is installed and on your PATH. Test with `ffmpeg -version`.

**`Imagen 3 returned no images`** — Verify your `GEMINI_API_KEY` has Imagen 3 access enabled in Google AI Studio.

**`PermissionError` on `.env`** — Run your terminal as a standard (non-admin) user; the app writes `.env` in the project folder.

**Render is slow** — Without an AMD GPU, encoding falls back to CPU (`libx264`). This is normal. A 3-minute video typically takes 2–5 minutes on CPU.

---

## License

MIT — see [LICENSE](LICENSE) for details.