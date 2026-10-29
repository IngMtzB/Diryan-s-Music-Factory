# 🗺️ Architecture & Flow Diagrams

Technical reference for **Diryan's Factory Music** — how all the pieces fit together.

---

## 1. High-Level Architecture

```mermaid
flowchart TD
    CLI["🖥️ main.py\nCLI Entrypoint"]
    CFG["⚙️ config.py\n.env + Key Validation"]
    PE["🧠 prompt_engine.py\nRule Loader + Prompt Builder"]
    AC["🔌 api_client.py\nProvider Orchestrator"]
    PM["📁 project_manager.py\nWorkspace + Audio Poll"]
    RD["🎬 renderer.py\nVideo Pipeline"]

    RMD["📄 rules/\nvisual_rules.md\nmotion_rules.md\nlyrics_rules.md"]

    GEM["✨ Gemini 2.5 Flash\n+ Imagen 3"]
    ANT["🤖 Claude 3.5 Sonnet\n+ DALL-E 3"]

    LIB["🎵 librosa\nAudio Analysis"]
    OCV["👁️ OpenCV\nFrame Drawing"]
    MVP["🎞️ MoviePy\nVideo Assembly"]
    FFM["⚡ ffmpeg\nh264_amf / libx264"]

    CLI --> CFG
    CLI --> PE
    CLI --> AC
    CLI --> PM
    CLI --> RD

    PE --> RMD
    PE --> AC

    AC -->|Gemini mode| GEM
    AC -->|Anthropic mode| ANT

    RD --> LIB
    RD --> OCV
    RD --> MVP
    MVP --> FFM
```

---

## 2. Provider Decision Flow

```mermaid
flowchart TD
    START(["▶ Launch main.py"])
    SEL{"Select Provider"}
    GEM_PATH["Gemini Path"]
    ANT_PATH["Anthropic Path"]

    CHK_G{"GEMINI_API_KEY\nin .env?"}
    CHK_A{"ANTHROPIC_API_KEY\n+ OPENAI_API_KEY\nin .env?"}

    PROMPT_G["🔑 Prompt user\nfor GEMINI_API_KEY"]
    PROMPT_A["🔑 Prompt user\nfor missing key(s)"]

    SAVE["💾 Save key(s) to .env"]
    REFUSE{"User cancelled\nor blank input?"}
    EXIT(["❌ Exit with\nerror panel"])

    GEMINI_CLIENT["GeminiProvider\ngemini-2.5-flash\n+ imagen-3.0-generate-002"]
    ANTHRO_CLIENT["AnthropicProvider\nclaude-3-5-sonnet-20241022\n+ dall-e-3"]

    READY(["✅ Proceed to\nSpec Generation"])

    START --> SEL
    SEL -->|Gemini| GEM_PATH
    SEL -->|Anthropic| ANT_PATH

    GEM_PATH --> CHK_G
    CHK_G -->|Present| GEMINI_CLIENT
    CHK_G -->|Missing| PROMPT_G
    PROMPT_G --> REFUSE
    REFUSE -->|Yes| EXIT
    REFUSE -->|No| SAVE
    SAVE --> GEMINI_CLIENT
    GEMINI_CLIENT --> READY

    ANT_PATH --> CHK_A
    CHK_A -->|Both present| ANTHRO_CLIENT
    CHK_A -->|Any missing| PROMPT_A
    PROMPT_A --> REFUSE
    ANTHRO_CLIENT --> READY
```

---

## 3. AI Generation Pipeline

```mermaid
sequenceDiagram
    actor User
    participant CLI as main.py
    participant PE as prompt_engine.py
    participant Rules as rules/*.md
    participant AC as api_client.py
    participant LLM as Text Model
    participant IMG as Image Model
    participant PM as project_manager.py

    User->>CLI: Concept + Style
    CLI->>PE: request_spec(concept, style)
    PE->>Rules: glob("*.md") — read all rulebooks
    Rules-->>PE: visual + motion + lyrics rules
    PE->>PE: build_system_prompt()
    PE->>AC: generate_spec(system_prompt, user_prompt)
    AC->>LLM: POST (JSON mode)
    LLM-->>AC: Raw JSON response
    AC->>AC: _parse_json() — strip fences, validate
    AC-->>PE: parsed spec dict
    PE-->>CLI: {lyrics, image_prompt, render_spec}

    CLI->>AC: generate_image(image_prompt)
    AC->>IMG: Generate image (16:9)
    IMG-->>AC: PNG bytes
    AC-->>CLI: background_bytes

    CLI->>PM: create_project(concept)
    PM-->>CLI: project_dir path
    CLI->>PM: save_assets(project_dir, spec, bg_bytes)
    PM->>PM: Write 01_styles.json
    PM->>PM: Write 02_lyrics.txt
    PM->>PM: Write 03_background.png
    PM-->>CLI: done

    CLI->>User: 📋 Show lyrics preview + project path
```

---

## 4. Audio-Drop & Render Pipeline

```mermaid
flowchart TD
    DROP["👤 User drops\n03_song.mp3\ninto project folder"]
    POLL["🔄 project_manager\npolling every 2s"]
    DETECT{"File exists\n& size > 0?"}
    WAIT["⏳ Continue\npolling…"]

    LOAD["📥 renderer.py\nLoad inputs:\n01_styles.json\n03_background.png\n03_song.mp3"]

    LIBROSA["🎵 librosa.load()\nsr=22050, mono"]
    RMS["📊 Compute RMS\nenergy per frame"]
    SUBBASS["🔊 STFT bandpass\n20–150 Hz\nsub-bass energy"]
    SMOOTH["〰️ 3-frame rolling\naverage smooth"]

    DETECT_ENC{"ffmpeg encoder\ndetection"}
    AMF["⚡ h264_amf\nAMD GPU"]
    X264["🖥️ libx264\nCPU fallback"]

    FRAMEGEN["🖼️ make_frame(t)\nfor each frame"]
    PULSE["💡 background_pulse\nbrightness boost"]
    SHAKE["📳 bass_shake\nrandom translate"]
    WAVEFORM["🌊 draw_waveform()\nrounded_bars / equalizer\ngradient colours"]

    MOVIEPY["🎞️ VideoClip + AudioFileClip\nMoviePy assembly"]
    OUT16["📺 04_video_16x9.mp4\n1920×1080"]
    CROP["✂️ ffmpeg crop\ncentre 1080px wide"]
    OUT9["📱 04_video_9x16.mp4\n1080×1920"]
    DONE(["🎬 Done!"])

    DROP --> POLL
    POLL --> DETECT
    DETECT -->|No| WAIT
    WAIT --> DETECT
    DETECT -->|Yes| LOAD

    LOAD --> LIBROSA
    LIBROSA --> RMS
    LIBROSA --> SUBBASS
    RMS --> SMOOTH
    SUBBASS --> SMOOTH

    LOAD --> DETECT_ENC
    DETECT_ENC -->|Available| AMF
    DETECT_ENC -->|Not found| X264

    SMOOTH --> FRAMEGEN
    FRAMEGEN --> PULSE
    FRAMEGEN --> SHAKE
    FRAMEGEN --> WAVEFORM

    WAVEFORM --> MOVIEPY
    AMF --> MOVIEPY
    X264 --> MOVIEPY

    MOVIEPY --> OUT16
    OUT16 --> CROP
    CROP --> OUT9
    OUT9 --> DONE
```

---

## 5. Project Folder Data Flow

```mermaid
flowchart LR
    AI["🤖 AI Generation\nStep"]
    USER["👤 User\n(audio drop)"]
    RENDER["🎬 Render\nStep"]

    S1["01_styles.json\nrender_spec\nimage_prompt"]
    S2["02_lyrics.txt\nFull song lyrics"]
    S3bg["03_background.png\nAI image"]
    S3mp["03_song.mp3\n← user drops this"]
    OUT16["04_video_16x9.mp4"]
    OUT9["04_video_9x16.mp4"]

    AI -->|writes| S1
    AI -->|writes| S2
    AI -->|writes| S3bg
    USER -->|copies| S3mp
    S1 -->|render_spec| RENDER
    S3bg -->|background| RENDER
    S3mp -->|audio| RENDER
    RENDER -->|outputs| OUT16
    RENDER -->|outputs| OUT9
```

---

## 6. Waveform Drawing Logic

```mermaid
flowchart TD
    FRAME["Current video frame\nbg_array copy"]
    IDX["Frame index i\n= floor(t × 30fps)"]
    AMP["amplitude\n= rms[i] (0.0 – 1.0)"]

    STYLE{"render_spec\nwaveform.style"}
    RB["rounded_bars\nPill-top rectangles\ngradient fill"]
    EQ["equalizer\nStacked segment\nblocks"]

    POS{"waveform.position"}
    BOT["base_y = height − 20\n(bottom anchor)"]
    CTR["base_y = height/2\n(center anchor)"]

    COLOR["Gradient colour\nprimary → secondary\nblend = amplitude"]

    DRAW["cv2.rectangle()\ncv2.ellipse() per bar"]
    OUT["Composited frame\nBGR → RGB\n→ MoviePy"]

    IDX --> AMP
    FRAME --> DRAW
    AMP --> RB
    AMP --> EQ
    STYLE --> RB
    STYLE --> EQ
    POS --> BOT
    POS --> CTR
    BOT --> DRAW
    CTR --> DRAW
    RB --> COLOR
    EQ --> COLOR
    COLOR --> DRAW
    DRAW --> OUT
```

---

## Module Dependency Map

```mermaid
graph LR
    MAIN["main.py"]
    CFG["config.py"]
    PE["services/\nprompt_engine.py"]
    AC["services/\napi_client.py"]
    PM["services/\nproject_manager.py"]
    RD["video/\nrenderer.py"]
    RULES["rules/*.md"]

    MAIN --> CFG
    MAIN --> PE
    MAIN --> AC
    MAIN --> PM
    MAIN --> RD
    PE --> RULES
    PE --> AC
    AC --> CFG
    PM --> CFG
    RD --> CFG
```

