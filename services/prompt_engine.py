"""
services/prompt_engine.py — Builds the system prompt from rule files and
requests a strict JSON spec from the selected LLM.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from rich.console import Console

from config import RULES_DIR

console = Console()

# ── Spec schema description (injected into the system prompt) ──────────────────

_VOCAL_GENRE_GUARD_KEYWORDS = (
    "corrido",
    "tumbado",
    "sierreño",
    "sierreno",
    "bélico",
    "belico",
    "requinto",
    "tololoche",
    "bajo quinto",
    "banda",
    "norteño",
    "norteno",
    "mariachi",
    "ranchera",
    "phonk",
    "synthwave",
    "darksynth",
    "lofi",
    "lo-fi",
    "chillhop",
    "trap",
    "reggaeton",
    "cumbia",
)

_EXPLICIT_INSTRUMENTAL_OR_VG_OVERRIDES = (
    "ost ambiental",
    "ambient ost",
    "modo ambiental",
    "purely instrumental",
    "no vocals",
    "sin voces",
    "cero voces",
    "videojuego",
    "videojuegos",
)

_VIDEOGAME_PHRASE_KEYWORDS = (
    "videojuego",
    "videojuegos",
    "slavic dark folk",
    "dark fantasy",
    "boss fight",
    "sci-fi boss",
    "glossolalia",
    "orchestral combat",
    "ost ambiental",
    "ambient ost",
    "purely instrumental",
    "no vocals",
    "sin voces",
)

_AMBIENT_OST_KEYWORDS = (
    "ost ambiental",
    "ambient ost",
    "modo ambiental",
    "purely instrumental",
    "no vocals",
    "sin voces",
    "cero voces",
    "rpg village",
    "villa medieval",
    "bosque tranquilo",
    "peaceful village",
    "peaceful menu",
    "menú principal",
    "menu principal",
    "mystic dungeon",
    "dungeon místico",
    "dungeon mistico",
    "ruinas antiguas",
    "space exploration",
    "exploración espacial",
)


def _is_guarded_vocal_style(style: str) -> bool:
    """Return True if *style* is a vocal/regional/urban genre without explicit OST/instrumental overrides."""
    style_low = (style or "").lower()
    if any(ov in style_low for ov in _EXPLICIT_INSTRUMENTAL_OR_VG_OVERRIDES):
        return False
    return any(g in style_low for g in _VOCAL_GENRE_GUARD_KEYWORDS)


def is_ambient_ost_style(style: str, concept: str = "") -> bool:
    """Return True if the selected genre/style or concept is Ambient / Exploration Video Game OST (Instrumental, No Vocals)."""
    if _is_guarded_vocal_style(style):
        return False
    style_low = (style or "").lower()
    combined = f"{style_low} {(concept or '').lower()}"
    if any(kw in combined for kw in _AMBIENT_OST_KEYWORDS):
        return True
    # Only trigger exploration/ambient detection when the style/concept explicitly has videogame/OST word tokens
    if re.search(r"\b(videojuego|videojuegos|ost|soundtrack|gaming|rpg)\b", combined):
        if re.search(
            r"\b(exploraci[oó]n|exploration|santuario|sanctuary|villa|village|bosque|forest|dungeon|men[uú]|tavern|taberna|ambient|ambiental|instrumental)\b",
            combined,
        ):
            if not re.search(
                r"\b(boss|combate|combat|jefe final|choir|coro|vocalise|glossolalia)\b",
                combined,
            ):
                return True
    return False


def is_videogame_style(style: str, concept: str = "") -> bool:
    """Return True if the selected genre/style or concept is Video Game Music (either Epic/Combat or Ambient/Exploration OST)."""
    if _is_guarded_vocal_style(style):
        return False
    if is_ambient_ost_style(style, concept):
        return True
    style_low = (style or "").lower()
    combined = f"{style_low} {(concept or '').lower()}"
    if any(kw in combined for kw in _VIDEOGAME_PHRASE_KEYWORDS):
        return True
    if re.search(r"\b(ost|soundtrack|gaming|rpg)\b", style_low):
        return True
    return False


_JSON_SCHEMA_INSTRUCTIONS = """\
You MUST reply with **only** a single JSON object (no markdown fences, no
commentary) that conforms exactly to this schema:

{
  "title": "<creative and catchy song title matching the concept>",
  "youtube_title": "<engaging YouTube title for the video>",
  "hook": "<1-2 sentence hook capturing the listener>",
  "suno_styles": "<comma-separated list of 8-12 generic tags for Suno AI music generation. COPYRIGHT RULE: STRICTLY FORBIDDEN to use real artist names (e.g. Peso Pluma, Xavi, Natanael Cano, Junior H, etc.) or registered brands. Translate the style into generic acoustic and musical elements: subgenres, instruments, rhythm, bass, vocal texture, mood. e.g. 'corridos tumbados, requinto rápido, tololoche, brass belico, voz masculina rasposa, sierreño, bajo quinto, percusión acústica, trap beat 808'>",
  "lyrics": "<full song lyrics formatted in exact Spanish with the mandatory 7-section structure: [Intro], [Verso 1], [Verso 2], [Coro], [Verso 3], [Coro], [Outro]. Every section MUST have at most 4 lines. No poor rhymes. Phonetic spelling in Spanish for English technical terms (e.g. 'bac-end', 'ese-cu-ele', 'pi-pi-ay', 'deplóy', 'git-job', 'yábascript', 'dóquer'). In [Intro] you MUST include: 'Música de la cuatro cero tres' and 'Corridos en ache-te-eme-ele'>",
  "description": "<an engaging YouTube/TikTok/Instagram description IN SPANISH explaining the vibe/story of the song, followed by the complete lyrics, credits, and call to action>",
  "cta": "<call to action IN SPANISH for likes and subscriptions>",
  "youtube_tags": "<comma-separated tags without hash>",
  "tiktok_caption": "<short punchy TikTok caption IN SPANISH>",
  "hashtags": "<5 contextual technical hashtags regarding the song theme, followed ALWAYS at the end by '#corridosenhtml #musicadela403'>",
  "image_prompt": "<a vivid, genre-matched 16:9 background image prompt following visual rules: all key subjects and focal elements centered so it looks great both in 16:9 and when cropped to 9:16 vertical format (safe zone centered), and lower 25% kept dark/simple for overlay space>",
  "render_spec": {
    "waveform": {
      "style": "<rounded_mirror | dot_matrix | neon_ladder | center_symmetrical | flowing_ribbons | particle_waves | mirrored_bars | frequency_bars | none>",
      "position": "<bottom | center>",
      "primary_color": "<hex color matching the scene vibe>",
      "secondary_color": "<hex color matching the scene accent>",
      "bar_count": <int 24-64>
    },
    "motion_effects": {
      "bass_shake": <true | false>,
      "shake_intensity_px": <int 0-14>,
      "background_pulse": <true | false>
    }
  }
}

Do NOT wrap the JSON in markdown code fences.  Do NOT add any text before or
after the JSON object.
"""

_VIDEOGAME_JSON_SCHEMA_INSTRUCTIONS = """\
You MUST reply with **only** a single JSON object (no markdown fences, no
commentary) that conforms exactly to this schema for **VIDEO GAME MUSIC (OST)**:

# ROLE
Eres un Director de Audio y Compositor de Bandas Sonoras (OST) para videojuegos AAA, especializado en ingeniería de prompts para Suno AI (Custom Mode). Tu objetivo es transformar un "Concepto" y un "Género/Vibe" en una estructura musical lista para producción.

# CORE RULES (REGLAS ESTRICTAS)
1. **Idioma**: Prohibido usar español en `suno_styles`, metatags `[ ]` y `lyrics`. Todo el output (`suno_styles`, metatags `[ ]` y líricas) debe estar en **inglés, latín o lenguaje fonético inventado (glossolalia)**. (Los campos sociales `youtube_title`, `hook`, `description`, `cta`, `tiktok_caption` SÍ van en español para Data.txt).
2. **Detección de Modo (Vocal vs. Ambiental/Instrumental)**:
   - **MODO AMBIENTAL / EXPLORACIÓN (Villas, Bosques, Menús tranquilos, Dungeons)**: Cero voces. Prohibido escribir texto fuera de los corchetes `[ ]`. Toda la caja de `lyrics` debe componerse EXCLUSIVAMENTE de directivas instrumentales entre corchetes `[ ]`. En `suno_styles` incluye siempre al final: `purely instrumental, no vocals`.
   - **MODO ÉPICO / COMBATE / TEMA PRINCIPAL (Boss fights, Cinemáticas)**: Usa la voz como instrumento. Frases minimalistas (máx 4-5 palabras), vocalizaciones (`Aaah...`, `Ooh...`), fonética con guiones (`Lú-mi-na...`) para forzar canto *legato*, y paréntesis `(Sanctus!)` para coros de respuesta.
3. **Pacing de Videojuego**:
   - Para **Exploración/Villas**: Usa estructuras cíclicas y relajadas (`[Intro]` -> `[Theme A: Main Melody]` -> `[Theme B: Warm Swell]` -> `[Bridge: Magical/Intimate]` -> `[Outro: Loopable Fade]` -> `[End]`) diseñadas para no cansar el oído del jugador.
   - Para **Combate/Épico**: Usa estructuras de impacto (`[Intro]` -> `[Vocal Intro / Verse 1]` -> `[Build-up]` -> `[Chorus / Main Theme]` -> `[Instrumental Break]` -> `[Bridge: Sudden Drop]` -> `[Climax: Maximum Intensity]` -> `[Outro]` -> `[End]`).

{
  "title": "<epic video game track title in English or Latin>",
  "youtube_title": "<engaging YouTube title in Spanish/English for the OST video>",
  "hook": "<1-2 sentence hook IN SPANISH capturing the epic gaming atmosphere>",
  "suno_styles": "<MAXIMUM 200 CHARACTERS, IN ENGLISH ONLY. Formula: [Subgénero/Escenario RPG] + [3 Instrumentos Acústicos/Sintéticos Protagonistas] + [Tipo de Voz O 'purely instrumental, no vocals'] + [BPM + Escala Musical] + [Vibe/Atmósfera]>",
  "lyrics": "<STRICTLY IN ENGLISH, LATIN, OR GLOSSOLALIA (NO SPANISH). Genera la secuencia usando metatags descriptivos entre corchetes [ ] que indiquen qué instrumento lleva la melodía, qué instrumento hace el acompañamiento y los cambios de intensidad (ej. [Soft pizzicato strings], [Solo wooden flute enters], [Percussion drops out]). Si es MODO AMBIENTAL: Solo escribe bloques [ ]. Ninguna palabra suelta. Si es MODO ÉPICO: Intercala las líricas cortas/fonéticas debajo de cada bloque [ ]. Termina siempre con [End].>",
  "description": "<an engaging YouTube description IN SPANISH explaining the boss fight / world lore / vibe of the soundtrack, followed by the complete lyrics, credits, and call to action>",
  "cta": "<call to action IN SPANISH for likes and subscriptions>",
  "youtube_tags": "<comma-separated tags without hash>",
  "tiktok_caption": "<short punchy TikTok caption IN SPANISH>",
  "hashtags": "<5 contextual gaming/OST hashtags, followed ALWAYS at the end by '#corridosenhtml #musicadela403'>",
  "image_prompt": "<a vivid, AAA dark fantasy / sci-fi / Slavic folk / RPG 16:9 background image prompt following visual rules: all key subjects and focal elements centered so it looks great both in 16:9 and when cropped to 9:16 vertical format (safe zone centered), and lower 25% kept dark/simple for waveform overlay space, NO text>",
  "render_spec": {
    "waveform": {
      "style": "<center_symmetrical | flowing_ribbons | particle_waves | neon_ladder | rounded_mirror>",
      "position": "<bottom | center>",
      "primary_color": "<hex color matching the scene vibe>",
      "secondary_color": "<hex color matching the scene accent>",
      "bar_count": <int 32-64>
    },
    "motion_effects": {
      "bass_shake": <true | false>,
      "shake_intensity_px": <int 4-12>,
      "background_pulse": <true | false>
    }
  }
}

Do NOT wrap the JSON in markdown code fences.  Do NOT add any text before or
after the JSON object.
"""

_AMBIENT_OST_JSON_SCHEMA_INSTRUCTIONS = """\
You MUST reply with **only** a single JSON object (no markdown fences, no
commentary) that conforms exactly to this schema for **VIDEO GAME AMBIENT / EXPLORATION OST (INSTRUMENTAL — NO VOCALS)**:

# ROLE
Eres un Director de Audio y Compositor de Bandas Sonoras (OST) para videojuegos AAA, especializado en ingeniería de prompts para Suno AI (Custom Mode). Tu objetivo es transformar un "Concepto" y un "Género/Vibe" en una estructura musical lista para producción.

# CORE RULES (REGLAS ESTRICTAS — MODO AMBIENTAL / EXPLORACIÓN ACTIVO)
1. **Idioma**: Prohibido usar español en `suno_styles`, metatags `[ ]` y `lyrics`. Todo el output de `suno_styles` y metatags `[ ]` en `lyrics` debe estar 100% en **inglés**. (Los campos sociales `youtube_title`, `hook`, `description`, `cta`, `tiktok_caption` SÍ van en español para Data.txt).
2. **MODO AMBIENTAL / EXPLORACIÓN (Villas, Bosques, Menús tranquilos, Dungeons)**:
   - **Cero voces**: Prohibido escribir texto fuera de los corchetes `[ ]`.
   - Toda la caja de `lyrics` debe componerse **EXCLUSIVAMENTE** de directivas instrumentales entre corchetes `[ ]` (ej. `[Soft pizzicato strings]`, `[Solo wooden flute enters]`, `[Percussion drops out]`). Ninguna palabra suelta fuera de `[ ]`.
   - En `suno_styles` (`Style of Music`) incluye **SIEMPRE al final**: `purely instrumental, no vocals`.
3. **Pacing de Videojuego (Exploración/Villas)**:
   - Usa estructuras cíclicas y relajadas diseñadas para no cansar el oído del jugador:
     `[Intro]` -> `[Theme A: Main Melody]` -> `[Theme B: Warm Swell]` -> `[Bridge: Magical/Intimate]` -> `[Outro: Loopable Fade]` -> `[End]`.

{
  "title": "<evocative RPG / video game ambient OST title in English>",
  "youtube_title": "<engaging YouTube title in Spanish/English for the Ambient OST video>",
  "hook": "<1-2 sentence hook IN SPANISH capturing the immersive exploration/ambient world atmosphere>",
  "suno_styles": "<MAXIMUM 200 CHARACTERS, IN ENGLISH ONLY. Formula: [Subgénero/Escenario RPG] + [3 Instrumentos Acústicos/Sintéticos Protagonistas] + [BPM + Escala Musical] + [Vibe/Atmósfera], purely instrumental, no vocals>",
  "lyrics": "<STRICTLY INSTRUMENTAL METATAGS INSIDE BRACKETS [ ] ONLY (ZERO WORDS OUTSIDE BRACKETS, NO VOCALS, NO SPANISH). Must follow this cyclical exploration structure:\\n[Intro]\\n[Ambient atmosphere & soft accompaniment instrument directives]\\n\\n[Theme A: Main Melody]\\n[Lead melody instrument & gentle accompaniment directives]\\n\\n[Theme B: Warm Swell]\\n[Harmonic swell & secondary instrument directives]\\n\\n[Bridge: Magical/Intimate]\\n[Percussion drops out, intimate solo instrument directives]\\n\\n[Outro: Loopable Fade]\\n[Seamless loopable fade directives]\\n[End]>",
  "description": "<an engaging YouTube description IN SPANISH explaining the RPG zone / exploration lore / atmosphere of the soundtrack, followed by the structural cues, credits, and call to action>",
  "cta": "<call to action IN SPANISH for likes and subscriptions>",
  "youtube_tags": "<comma-separated tags without hash>",
  "tiktok_caption": "<short punchy TikTok caption IN SPANISH>",
  "hashtags": "<5 contextual gaming/ambient OST hashtags, followed ALWAYS at the end by '#corridosenhtml #musicadela403'>",
  "image_prompt": "<a vivid, AAA RPG village / mystical forest / ancient dungeon / sci-fi sanctuary 16:9 background image prompt following visual rules: all key subjects and focal elements centered so it looks great both in 16:9 and when cropped to 9:16 vertical format (safe zone centered), and lower 25% kept dark/simple for waveform overlay space, NO text>",
  "render_spec": {
    "waveform": {
      "style": "<flowing_ribbons | particle_waves | center_symmetrical | rounded_mirror | neon_ladder>",
      "position": "<bottom | center>",
      "primary_color": "<hex color matching the scene vibe>",
      "secondary_color": "<hex color matching the scene accent>",
      "bar_count": <int 32-64>
    },
    "motion_effects": {
      "bass_shake": <true | false>,
      "shake_intensity_px": <int 0-6>,
      "background_pulse": <true | false>
    }
  }
}

Do NOT wrap the JSON in markdown code fences.  Do NOT add any text before or
after the JSON object.
"""


# ── Validation and Sanitization Helpers ───────────────────────────────────────

_BANNED_ARTISTS = [
    r"\bpeso\s+pluma\b",
    r"\bnatanael\s+cano\b",
    r"\bjunior\s+h\b",
    r"\bfuerza\s+regida\b",
    r"\bxavi\b",
    r"\bgabito\s+ballesteros\b",
    r"\beslabon\s+armado\b",
    r"\bbad\s+bunny\b",
    r"\banuel\b",
    r"\bbizarrap\b",
    r"\bquevedo\b",
    r"\btito\s+double\s+p\b",
    r"\bluis\s+r\s+conriquez\b",
]


_NULLISH_LITERALS = frozenset({"null", "none", "undefined", "n/a", "nil", "nan"})


def _clean_str_field(val: Any) -> str:
    """Convert any LLM field value to a clean string, treating nullish literals as empty."""
    if val is None or isinstance(val, bool):
        return ""
    if isinstance(val, list):
        parts = [_clean_str_field(x) for x in val]
        return ", ".join(p for p in parts if p)
    s = str(val).strip()
    if s.lower() in _NULLISH_LITERALS:
        return ""
    return s


def _has_sung_lyrics(lyrics_str: str) -> bool:
    """Return True if *lyrics_str* contains actual sung lines outside `[ ]` tags."""
    raw = _clean_str_field(lyrics_str)
    if not raw:
        return False
    sung_lines = 0
    for line in raw.splitlines():
        stripped = re.sub(r"\[[^\]]*\]", "", line).strip()
        if stripped and stripped.lower() not in _NULLISH_LITERALS:
            sung_lines += 1
    return sung_lines >= 2


def _sanitize_suno_styles(styles_str: Any, fallback_genre: str) -> str:
    """Ensure no real artist names or trademarks appear in Suno style tags."""
    cleaned = _clean_str_field(styles_str) or _clean_str_field(fallback_genre)
    for pattern in _BANNED_ARTISTS:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r",\s*,+", ",", cleaned)
    cleaned = cleaned.strip(" ,")
    if not cleaned:
        cleaned = "corridos tumbados, requinto rapido, tololoche, brass, 808 sub bass, voz masculina rasposa"
    return cleaned


def _validate_and_fix_hashtags(hashtags_str: Any, videogame_mode: bool = False) -> str:
    """Ensure 5 contextual hashtags and end with #corridosenhtml #musicadela403."""
    clean_hashtags = _clean_str_field(hashtags_str)
    raw_tags = [
        t if t.startswith("#") else f"#{t}"
        for t in clean_hashtags.replace(",", " ").split()
        if t.strip() and t.strip("#").lower() not in _NULLISH_LITERALS
    ]
    # Filter out the mandatory tags so we append them deterministically at the end
    tags = [
        t for t in raw_tags if t.lower() not in ("#corridosenhtml", "#musicadela403")
    ]

    defaults = (
        ["#GameOST", "#DarkFantasy", "#BossFight", "#Soundtrack", "#GamingMusic"]
        if videogame_mode
        else ["#Programacion", "#Developer", "#SoftwareEngineer", "#Coding", "#TechLife"]
    )
    for dt in defaults:
        if len(tags) >= 5:
            break
        if dt not in tags:
            tags.append(dt)

    # 5 contextual + mandatory 2
    final_tags = tags[:5] + ["#corridosenhtml", "#musicadela403"]
    return " ".join(final_tags)


def _validate_and_fix_lyrics(lyrics_str: Any) -> str:
    """Ensure mandatory mentions exist with exact corrected pronunciation."""
    lyrics_clean = _clean_str_field(lyrics_str)
    mention_1 = "Música de la cuatro cero tres"
    mention_2 = "Corridos en ache-te-eme-ele"

    has_m1 = "cuatro cero tres" in lyrics_clean.lower()
    has_m2 = "ache-te-eme-ele" in lyrics_clean.lower()

    if has_m1 and has_m2:
        return lyrics_clean

    # Inject into [Intro] if absent
    if "[Intro]" in lyrics_clean:
        return lyrics_clean.replace(
            "[Intro]",
            f"[Intro]\n{mention_1},\n{mention_2},",
            1,
        )
    return f"[Intro]\n{mention_1},\n{mention_2},\n\n" + lyrics_clean


def _enforce_ambient_ost_styles(styles_str: str) -> str:
    """Ensure Ambient OST Style of Music ends with 'purely instrumental, no vocals' and is <= 200 chars."""
    suffix = "purely instrumental, no vocals"
    base = re.sub(r",?\s*purely\s+instrumental\s*,?\s*no\s+vocals\s*", "", styles_str or "", flags=re.IGNORECASE)
    base = base.strip(" ,")
    if not base:
        base = "Peaceful RPG Exploration OST, acoustic lute, wooden flute, soft pizzicato strings, 90 BPM G Major, warm nostalgic atmosphere"
    max_base_len = 200 - len(suffix) - 2  # ", " + suffix
    if len(base) > max_base_len:
        if "," in base[:max_base_len]:
            base = base[:max_base_len].rsplit(",", 1)[0].strip(" ,")
        else:
            base = base[:max_base_len].strip(" ,")
    return f"{base}, {suffix}"


def _enforce_ambient_ost_lyrics(lyrics_str: str) -> str:
    """
    Ensure Ambient / Exploration OST lyrics consist EXCLUSIVAMENTE of instrumental
    directives inside brackets [ ] and end with [End]. Zero loose text outside [ ].
    """
    raw = _clean_str_field(lyrics_str)
    if not raw:
        return (
            "[Intro]\n"
            "[Ambient atmosphere & soft accompaniment instrument enters]\n\n"
            "[Theme A: Main Melody]\n"
            "[Solo lead instrument states the main exploration melody]\n"
            "[Gentle rhythmic accompaniment supports the theme]\n\n"
            "[Theme B: Warm Swell]\n"
            "[Warm strings swell, secondary melodic instrument joins]\n\n"
            "[Bridge: Magical/Intimate]\n"
            "[Percussion drops out, intimate solo arpeggios]\n\n"
            "[Outro: Loopable Fade]\n"
            "[Soft sustained notes fading seamlessly for game loop]\n"
            "[End]"
        )

    cleaned_lines: list[str] = []
    for line in raw.splitlines():
        s = line.strip()
        if not s:
            if cleaned_lines and cleaned_lines[-1] != "":
                cleaned_lines.append("")
            continue
        # Extract all bracketed directives on this line
        brackets = re.findall(r"\[[^\]]+\]", s)
        if brackets:
            cleaned_lines.append(" ".join(brackets))
        # Any non-bracketed vocal/loose text is strictly stripped in Ambient mode!

    result = "\n".join(cleaned_lines).strip()
    if not result:
        return _enforce_ambient_ost_lyrics("")
    if not result.endswith("[End]"):
        result = re.sub(r"\[End\]\s*$", "", result, flags=re.IGNORECASE).strip()
        result = f"{result}\n[End]"
    return result


# ── Public API ─────────────────────────────────────────────────────────────────

def load_rules(videogame_mode: bool = False, ambient_ost_mode: bool = False) -> str:
    """
    Read every .md file in the rules/ directory and concatenate them into
    a single block for the system prompt.
    When neither videogame_mode nor ambient_ost_mode is active, strip Section 4
    (Video Game & Ambient OST special mode) from lyrics_rules.md so standard
    vocal tracks never accidentally trigger instrumental or non-Spanish OST rules.
    """
    parts: list[str] = []
    for md_file in sorted(RULES_DIR.glob("*.md")):
        content = md_file.read_text(encoding="utf-8").strip()
        if md_file.stem == "lyrics_rules" and not videogame_mode and not ambient_ost_mode:
            content = re.split(
                r"^##\s*4\.\s*MODO ESPECIAL",
                content,
                maxsplit=1,
                flags=re.MULTILINE,
            )[0].strip()
        parts.append(f"## Rulebook: {md_file.stem}\n\n{content}")

    if not parts:
        raise FileNotFoundError(f"No .md rule files found in {RULES_DIR}")

    return "\n\n---\n\n".join(parts)


def build_system_prompt(videogame_mode: bool = False, ambient_ost_mode: bool = False) -> str:
    """Assemble the full system prompt with rules + JSON schema."""
    rules_block = load_rules(videogame_mode=videogame_mode, ambient_ost_mode=ambient_ost_mode)
    if ambient_ost_mode:
        schema_instructions = _AMBIENT_OST_JSON_SCHEMA_INSTRUCTIONS
    elif videogame_mode:
        schema_instructions = _VIDEOGAME_JSON_SCHEMA_INSTRUCTIONS
    else:
        schema_instructions = _JSON_SCHEMA_INSTRUCTIONS

    return (
        "You are **Diryan's Factory Music AI** — a creative music-video "
        "specification engine.  Your job is to take a user's song concept and "
        "output a complete production spec as JSON.\n\n"
        "Follow every rule in the attached rulebooks strictly.\n\n"
        f"{rules_block}\n\n"
        "---\n\n"
        f"{schema_instructions}"
    )


def request_spec(
    provider_client: Any,
    concept: str,
    style: str,
) -> dict[str, Any]:
    """
    Send the concept + style to the LLM via *provider_client* and return
    the parsed JSON spec dictionary.

    Parameters
    ----------
    provider_client:
        An instance of ``ProviderClient`` (Gemini or Anthropic).
    concept:
        Free-text song concept from the user.
    style:
        Musical genre / vibe descriptor.

    Returns
    -------
    dict  with keys: lyrics, image_prompt, render_spec
    """
    from services.social import normalize_social

    ambient_mode = is_ambient_ost_style(style, concept)
    vg_mode = ambient_mode or is_videogame_style(style, concept)
    system_prompt = build_system_prompt(videogame_mode=vg_mode, ambient_ost_mode=ambient_mode)

    if ambient_mode:
        mode_banner = (
            "\n**ACTIVE MODE:** VIDEO GAME OST — MODO AMBIENTAL / EXPLORACIÓN (CERO VOCES / INSTRUMENTAL). "
            "Strictly enforce the Ambient OST Core Rules:\n"
            "1. NO SPANISH in `suno_styles`, metatags `[ ]`, or `lyrics` (100% English).\n"
            "2. ZERO VOCALS: It is strictly forbidden to write any text outside brackets `[ ]`. The entire `lyrics` field MUST consist EXCLUSIVELY of instrumental directives inside `[ ]`.\n"
            "3. In `suno_styles`, ALWAYS end with `purely instrumental, no vocals` and keep total length <= 200 chars.\n"
            "4. Use the cyclical exploration pacing (`[Intro]` -> `[Theme A: Main Melody]` -> `[Theme B: Warm Swell]` -> `[Bridge: Magical/Intimate]` -> `[Outro: Loopable Fade]` -> `[End]`).\n"
        )
    elif vg_mode:
        mode_banner = (
            "\n**ACTIVE MODE:** VIDEO GAME MUSIC (OST — MODO ÉPICO / COMBATE / TEMA PRINCIPAL). Strictly enforce the Video Game Music Core Rules: "
            "NO SPANISH in `suno_styles`, metatags `[ ]`, or `lyrics` (use English, Latin, or Glossolalia only), "
            "max 200 chars for `suno_styles`, and use the dynamic Video Game arc ending with `[End]`.\n"
        )
    else:
        mode_banner = (
            "\n**ACTIVE MODE:** CANCIÓN VOCAL COMPLETA EN ESPAÑOL (ESTRUCTURA DE 7 SECCIONES CON LETRA CANTADA).\n"
            "REGLAS CRÍTICAS INQUEBRANTABLES:\n"
            "1. Aunque el estilo o subgénero personalizado mencione bajos (bass), sintetizadores, arreglos instrumentales o atmósfera melancólica/triste, DEBES generar la LETRA CANTADA COMPLETA en español con las 7 secciones obligatorias (`[Intro]`, `[Verso 1]`, `[Verso 2]`, `[Coro]`, `[Verso 3]`, `[Coro]`, `[Outro]`), con 3 a 4 versos cantados por sección.\n"
            "2. PROHIBIDO generar canciones instrumentales o rellenar `lyrics` solo con directivas entre corchetes `[ ]`.\n"
            "3. PROHIBIDO devolver `null`, `\"null\"`, `None` o campos vacíos en `title`, `youtube_title`, `youtube_tags`, `lyrics` o cualquier campo del JSON.\n"
        )

    user_prompt = (
        f"Create a full production spec for a song with this concept:\n\n"
        f"**Concept:** {concept}\n"
        f"**Style / Genre:** {style}\n"
        f"{mode_banner}\n"
        f"Follow the rules and reply with the JSON spec only."
    )

    console.print("[dim]Sending prompt to LLM…[/dim]")
    spec = provider_client.generate_spec(system_prompt, user_prompt)
    if not isinstance(spec, dict):
        raise ValueError("LLM did not return a valid JSON object for spec.")

    # If in standard vocal mode and LLM returned bracket-only / instrumental lyrics, retry once with corrective instructions
    if not ambient_mode and not vg_mode and not _has_sung_lyrics(spec.get("lyrics", "")):
        console.print("[yellow]⚠ LLM returned instrumental/empty lyrics for a vocal song. Retrying with strict vocal enforcement…[/yellow]")
        retry_prompt = (
            f"{user_prompt}\n\n"
            "CORRECCIÓN OBLIGATORIA: Tu respuesta anterior NO incluyó letra cantada en español (solo etiquetas instrumentales o vacía). "
            "Esta NO es una canción instrumental. Escribe la letra cantada completa en español con las 7 secciones: "
            "[Intro], [Verso 1], [Verso 2], [Coro], [Verso 3], [Coro], [Outro], incluyendo 'Música de la cuatro cero tres' y 'Corridos en ache-te-eme-ele' en [Intro]."
        )
        retry_spec = provider_client.generate_spec(system_prompt, retry_prompt)
        if isinstance(retry_spec, dict) and _has_sung_lyrics(retry_spec.get("lyrics", "")):
            spec = retry_spec

    # Quick sanity checks and intelligent defaults
    for key in ("lyrics", "image_prompt", "render_spec"):
        if key not in spec:
            raise KeyError(f"LLM response missing required key: '{key}'")

    clean_title = _clean_str_field(spec.get("title"))
    if not clean_title:
        clean_title = (concept or "Canción Sin Título")[:40].strip().title()
    spec["title"] = clean_title

    spec["image_prompt"] = _clean_str_field(spec.get("image_prompt")) or (
        f"Vivid 16:9 dark atmospheric music background for {clean_title}, centered composition, lower 25% dark clean space"
    )
    if not isinstance(spec.get("render_spec"), dict):
        spec["render_spec"] = {"waveform": {"style": "center_symmetrical", "position": "bottom"}}

    # 1. Sanitize Suno styles (Strict Copyright: no artist names or brands)
    cleaned_styles = _sanitize_suno_styles(spec.get("suno_styles", ""), style)
    if ambient_mode:
        cleaned_styles = _enforce_ambient_ost_styles(cleaned_styles)
    elif vg_mode and len(cleaned_styles) > 200:
        cleaned_styles = cleaned_styles[:200].rsplit(",", 1)[0].strip()
    spec["suno_styles"] = cleaned_styles

    # 2. Enforce mandatory mentions and lyrics rules (only for non-videogame Spanish tracks)
    if ambient_mode:
        spec["lyrics"] = _enforce_ambient_ost_lyrics(spec.get("lyrics", ""))
    elif vg_mode:
        lyrics_raw = _clean_str_field(spec.get("lyrics"))
        if lyrics_raw and "[End]" not in lyrics_raw:
            lyrics_raw = f"{lyrics_raw}\n[End]"
        spec["lyrics"] = lyrics_raw
    else:
        spec["lyrics"] = _validate_and_fix_lyrics(spec.get("lyrics", ""))

    # 3. Enforce hashtags: 5 contextual + #corridosenhtml #musicadela403
    spec["hashtags"] = _validate_and_fix_hashtags(spec.get("hashtags", ""), videogame_mode=vg_mode)

    # 4. Sanitize all social fields (removes 'null - ...', 'null, ...', etc.)
    spec = normalize_social(spec, genre=style)

    if not _clean_str_field(spec.get("description")):
        lyrics = spec.get("lyrics", "")
        spec["description"] = f"{concept}\n\nEstilo: {style}\n\nLetra:\n{lyrics}\n\n{spec['hashtags']}"

    return spec


# ── Metadata & Visual Spec for existing songs ───────────────────────────────────

_FROM_SONG_SCHEMA_INSTRUCTIONS = """\
You MUST reply with **only** a single JSON object (no markdown fences, no
commentary) that conforms exactly to this schema:

{
  "title": "<creative and catchy song title matching the lyrics and theme>",
  "suno_styles": "<comma-separated list of 8-12 generic tags for the song musical style. Avoid real artist names>",
  "description": "<an engaging YouTube/TikTok/Instagram description explaining the vibe/story of the song, followed by the complete lyrics, credits, and call to action>",
  "hashtags": "<5 contextual technical hashtags regarding the song theme, followed ALWAYS at the end by '#corridosenhtml #musicadela403'>",
  "image_prompt": "<a vivid, genre-matched 16:9 background image prompt capturing the lyrics story, following visual rules: all key subjects centered so it looks great both in 16:9 widescreen and 9:16 vertical crop, and lower 25% kept dark/simple for waveform overlay space>",
  "render_spec": {
    "waveform": {
      "style": "<mirrored_bars | frequency_bars | equalizer | neon_glow_line | none>",
      "position": "<bottom | center>",
      "primary_color": "<hex color matching the scene vibe>",
      "secondary_color": "<hex color matching the scene accent>",
      "bar_count": <int 24-64>
    },
    "motion_effects": {
      "bass_shake": <true | false>,
      "shake_intensity_px": <int 0-14>,
      "background_pulse": <true | false>
    }
  }
}

Do NOT wrap the JSON in markdown code fences. Do NOT add any text before or
after the JSON object. Do NOT include 'lyrics' in the JSON.
"""


def request_spec_from_song(
    provider_client: Any,
    lyrics: str,
    suno_styles: str,
    folder_name: str = "",
) -> dict[str, Any]:
    """
    Given existing song lyrics and musical style, ask the LLM to generate:
    - title
    - image_prompt (genre and lyrics matched)
    - render_spec (waveform, colors, motion)
    - description & hashtags for Data.txt
    Does not ask the LLM for lyrics, as they already exist.
    """
    system_prompt = (
        "You are **Diryan's Factory Music AI** — a creative music-video "
        "specification engine. You are provided with the full lyrics and musical "
        "styles of an existing song. Output the complete production and social spec "
        "as a JSON object adhering to the schema.\n\n"
        "Follow every rule in the attached rulebooks strictly.\n\n"
        f"{load_rules()}\n\n"
        "---\n\n"
        f"{_FROM_SONG_SCHEMA_INSTRUCTIONS}"
    )

    clean_name = folder_name.replace("_", " ").strip().title() if folder_name else ""
    user_prompt = (
        f"Generate production metadata, visual image prompt, and social data for this song.\n\n"
        f"**Suggested/Folder Title:** {clean_name or '(infer from lyrics)'}\n"
        f"**Musical Style / Genre:** {suno_styles or 'Regional Mexican / Corrido'}\n\n"
        f"**Song Lyrics:**\n{lyrics}\n\n"
        f"Reply with the JSON spec only."
    )

    console.print("[dim]Sending lyrics & style to LLM to generate production metadata & visual prompt…[/dim]")
    spec = provider_client.generate_spec(system_prompt, user_prompt)

    # Sanity checks
    for key in ("image_prompt", "render_spec"):
        if key not in spec:
            raise KeyError(f"LLM response missing required key: '{key}'")

    if not spec.get("title"):
        spec["title"] = clean_name or "Untitled Song"

    spec["suno_styles"] = _sanitize_suno_styles(spec.get("suno_styles", "") or suno_styles, suno_styles)
    # Ensure lyrics are attached in spec dict so downstream save functions can access it
    spec["lyrics"] = lyrics
    spec["hashtags"] = _validate_and_fix_hashtags(spec.get("hashtags", ""))

    if not spec.get("description"):
        spec["description"] = f"{spec['title']}.\n\nEstilo: {suno_styles}\n\nLETRA:\n{lyrics}\n\n{spec['hashtags']}"

    return spec


def request_metadata(
    provider_client: Any,
    concept: str,
    style: str,
    lyrics: str,
    current_title: str = "",
) -> dict[str, Any]:
    """Ask LLM to generate fresh YouTube & TikTok metadata for existing lyrics."""
    from services.social import normalize_social
    system_prompt = (
        "You are Diryan's Factory Music AI — generate social copy and metadata in a JSON object conforming to:\n"
        "{\n"
        '  "title": "<song title>",\n'
        '  "youtube_title": "<short engaging youtube title>",\n'
        '  "hook": "<1-2 sentence hook>",\n'
        '  "description": "<story/vibe of the track>",\n'
        '  "cta": "<call to action>",\n'
        '  "youtube_tags": "<comma-separated tags without hash>",\n'
        '  "tiktok_caption": "<short punchy tiktok caption>",\n'
        '  "hashtags": "<5 technical tags + #corridosenhtml #musicadela403>"\n'
        "}\n"
        "Do NOT include markdown fences."
    )
    user_prompt = (
        f"Generate updated social metadata and title for this song:\n\n"
        f"Concept: {concept}\n"
        f"Style: {style}\n"
        f"Current Title: {current_title}\n\n"
        f"Lyrics:\n{lyrics}\n"
    )
    res = provider_client.generate_spec(system_prompt, user_prompt)
    clean_t = _clean_str_field(res.get("title"))
    res["title"] = clean_t or _clean_str_field(current_title) or concept[:40].strip().title()
    res["hashtags"] = _validate_and_fix_hashtags(res.get("hashtags", ""))
    res = normalize_social(res, genre=style)
    return res


