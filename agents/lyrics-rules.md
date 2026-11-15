# Song Lyrics & Structure Rules

> **Agent Instruction**: This rulebook defines the composition, rhyme scheme, mandatory brand mentions, and Spanish phonetic spelling for generating song lyrics.

---

## 1. Mandatory 7-Section Structure

Every song lyric must consist of exactly 7 structural sections:
1. `[Intro]`
2. `[Verso 1]`
3. `[Verso 2]`
4. `[Coro]`
5. `[Verso 3]`
6. `[Coro]`
7. `[Outro]`

Each section MUST contain at most **4 lines**. Do not generate excessively long stanzas.

---

## 2. Mandatory Intro Mentions

In the `[Intro]` section, the lyrics MUST include the exact mentions:
1. `Música de la cuatro cero tres`
2. `Corridos en ache-te-eme-ele`

---

## 3. Spanish Phonetic Spelling for Technical Jargon

Because Suno AI and text-to-speech models pronounce Spanish phonetically, all English technical terms and developer slang MUST be written with Spanish phonetic spelling with accents:
- `backend` → `bac-end` or `bak-end`
- `frontend` → `fron-end`
- `SQL` → `ese-cu-ele`
- `API` → `pi-pi-ay`
- `deploy` → `deplóy`
- `GitHub` → `git-job`
- `JavaScript` → `yábascript`
- `Docker` → `dóquer`
- `div` → `díb`
- `cloud` → `claud`
- `tier` → `tíer`
- `sprint` → `esprint`

---

## 4. Theme & Tone

- **Genre**: Corridos tumbados, electro corridos, sierreño bélico, trap corridos.
- **Storytelling**: Realistic developer humor, late-night debugging crises, production outages on Friday, token budget exhaustion, corporate satire, tech pride and hustle.

---

## 5. Video Game Music Mode (Música para Videojuegos & OST Ambiental)

When the selected genre belongs to **Música para Videojuegos** (*Slavic Dark Folk & Combat*, *Dark Fantasy Emotivo / Tema Principal*, *Cyberpunk / Sci-Fi Boss Fight*) or **OST Ambiental & Exploración (Sin Voces)** (*Villas*, *Bosques*, *Menús tranquilos*, *Dungeons*), act as an **AAA Video Game Audio Director & OST Composer** specialized in Suno AI (Custom Mode) and apply these strict rules instead of the Spanish 7-section corrido structure:

1. **Language**: Spanish is strictly forbidden in `suno_styles`, metatags `[ ]`, and `lyrics`. Everything must be in **English, Latin, or invented phonetic glossolalia**.
2. **Mode Detection (Vocal vs. Ambiental/Instrumental)**:
   - **MODO AMBIENTAL / EXPLORACIÓN (Villas, Bosques, Menús tranquilos, Dungeons)**: Zero vocals. It is strictly forbidden to write any text outside brackets `[ ]`. The entire `lyrics` box must consist **EXCLUSIVELY** of instrumental directives inside brackets `[ ]`. In `suno_styles` (`Style of Music`), always include at the end: `purely instrumental, no vocals`.
   - **MODO ÉPICO / COMBATE / TEMA PRINCIPAL (Boss fights, Cinemáticas)**: Use the voice as an instrument. Minimalist phrases (max 4–5 words per line), vocalizations (`Aaah...`, `Ooh...`), hyphenated phonetics (`Lú-mi-na...`) to enforce *legato* singing, and parentheses `(Sanctus!)` for backing choir responses.
3. **Video Game Pacing**:
   - **Exploración/Villas (Ambiental)**: Use cyclical, relaxed structures (`[Intro]` -> `[Theme A: Main Melody]` -> `[Theme B: Warm Swell]` -> `[Bridge: Magical/Intimate]` -> `[Outro: Loopable Fade]` -> `[End]`) designed not to fatigue the player's ear.
   - **Combate/Épico**: Use high-impact structures (`[Intro]` -> `[Build-up]` -> `[Chorus/Climax]` -> `[Sudden Drop]` -> `[Grand Finale]` -> `[End]`).
4. **Style of Music (`suno_styles`)**: Max 200 characters following `[RPG Subgenre/Scenario] + [3 Lead Acoustic/Synth Instruments] + [Vocal Type OR "purely instrumental, no vocals"] + [BPM + Musical Scale] + [Vibe/Atmosphere]`.
5. **Lyrics / Structural Sequence (`lyrics`)**: Use descriptive metatags in brackets `[ ]` indicating which instrument carries the melody, which provides accompaniment, and intensity shifts (e.g., `[Soft pizzicato strings]`, `[Solo wooden flute enters]`, `[Percussion drops out]`). Always end with `[End]`.



