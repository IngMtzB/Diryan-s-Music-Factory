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

_JSON_SCHEMA_INSTRUCTIONS = """\
You MUST reply with **only** a single JSON object (no markdown fences, no
commentary) that conforms exactly to this schema:

{
  "title": "<creative and catchy song title matching the concept>",
  "suno_styles": "<comma-separated list of 8-12 generic tags for Suno AI music generation. COPYRIGHT RULE: STRICTLY FORBIDDEN to use real artist names (e.g. Peso Pluma, Xavi, Natanael Cano, Junior H, etc.) or registered brands. Translate the style into generic acoustic and musical elements: subgenres, instruments, rhythm, bass, vocal texture, mood. e.g. 'corridos tumbados, requinto rápido, tololoche, brass belico, voz masculina rasposa, sierreño, bajo quinto, percusión acústica, trap beat 808'>",
  "lyrics": "<full song lyrics formatted in exact Spanish with the mandatory 7-section structure: [Intro], [Verso 1], [Verso 2], [Coro], [Verso 3], [Coro], [Outro]. Every section MUST have at most 4 lines. No poor rhymes. Phonetic spelling in Spanish for English technical terms (e.g. 'bac-end', 'ese-cu-ele', 'pi-pi-ay', 'deplóy', 'git-job', 'yábascript', 'dóquer'). In [Intro] you MUST include: 'Música de la cuatro cero tres' and 'Corridos en ache-te-eme-ele'>",
  "description": "<an engaging YouTube/TikTok/Instagram description explaining the vibe/story of the song, followed by the complete lyrics, credits, and call to action>",
  "hashtags": "<5 contextual technical hashtags regarding the song theme, followed ALWAYS at the end by '#corridosenhtml #musicadela403'>",
  "image_prompt": "<a vivid, genre-matched 16:9 background image generation prompt that follows the visual rules, keeping the lower 25% dark/simple for overlay space>",
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


def _sanitize_suno_styles(styles_str: str, fallback_genre: str) -> str:
    """Ensure no real artist names or trademarks appear in Suno style tags."""
    cleaned = styles_str or fallback_genre
    for pattern in _BANNED_ARTISTS:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r",\s*,+", ",", cleaned)
    cleaned = cleaned.strip(" ,")
    if not cleaned:
        cleaned = "corridos tumbados, requinto rapido, tololoche, brass, 808 sub bass, voz masculina rasposa"
    return cleaned


def _validate_and_fix_hashtags(hashtags_str: str) -> str:
    """Ensure 5 contextual technical hashtags and end with #corridosenhtml #musicadela403."""
    raw_tags = [
        t if t.startswith("#") else f"#{t}"
        for t in (hashtags_str or "").replace(",", " ").split()
        if t.strip()
    ]
    # Filter out the mandatory tags so we append them deterministically at the end
    tags = [
        t for t in raw_tags if t.lower() not in ("#corridosenhtml", "#musicadela403")
    ]

    defaults = ["#Programacion", "#Developer", "#SoftwareEngineer", "#Coding", "#TechLife"]
    for dt in defaults:
        if len(tags) >= 5:
            break
        if dt not in tags:
            tags.append(dt)

    # 5 contextual + mandatory 2
    final_tags = tags[:5] + ["#corridosenhtml", "#musicadela403"]
    return " ".join(final_tags)


def _validate_and_fix_lyrics(lyrics_str: str) -> str:
    """Ensure mandatory mentions exist with exact corrected pronunciation."""
    mention_1 = "Música de la cuatro cero tres"
    mention_2 = "Corridos en ache-te-eme-ele"

    has_m1 = "cuatro cero tres" in lyrics_str.lower()
    has_m2 = "ache-te-eme-ele" in lyrics_str.lower()

    if has_m1 and has_m2:
        return lyrics_str

    # Inject into [Intro] if absent
    if "[Intro]" in lyrics_str:
        return lyrics_str.replace(
            "[Intro]",
            f"[Intro]\n{mention_1},\n{mention_2},",
            1,
        )
    return f"[Intro]\n{mention_1},\n{mention_2},\n\n" + lyrics_str


# ── Public API ─────────────────────────────────────────────────────────────────

def load_rules() -> str:
    """
    Read every .md file in the rules/ directory and concatenate them into
    a single block for the system prompt.
    """
    parts: list[str] = []
    for md_file in sorted(RULES_DIR.glob("*.md")):
        content = md_file.read_text(encoding="utf-8").strip()
        parts.append(f"## Rulebook: {md_file.stem}\n\n{content}")

    if not parts:
        raise FileNotFoundError(f"No .md rule files found in {RULES_DIR}")

    return "\n\n---\n\n".join(parts)


def build_system_prompt() -> str:
    """Assemble the full system prompt with rules + JSON schema."""
    rules_block = load_rules()

    return (
        "You are **Diryan's Factory Music AI** — a creative music-video "
        "specification engine.  Your job is to take a user's song concept and "
        "output a complete production spec as JSON.\n\n"
        "Follow every rule in the attached rulebooks strictly.\n\n"
        f"{rules_block}\n\n"
        "---\n\n"
        f"{_JSON_SCHEMA_INSTRUCTIONS}"
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
    system_prompt = build_system_prompt()

    user_prompt = (
        f"Create a full production spec for a song with this concept:\n\n"
        f"**Concept:** {concept}\n"
        f"**Style / Genre:** {style}\n\n"
        f"Follow the rules and reply with the JSON spec only."
    )

    console.print("[dim]Sending prompt to LLM…[/dim]")
    spec = provider_client.generate_spec(system_prompt, user_prompt)

    # Quick sanity checks and intelligent defaults
    for key in ("lyrics", "image_prompt", "render_spec"):
        if key not in spec:
            raise KeyError(f"LLM response missing required key: '{key}'")

    if not spec.get("title"):
        spec["title"] = concept[:40].strip().title()

    # 1. Sanitize Suno styles (Strict Copyright: no artist names or brands)
    spec["suno_styles"] = _sanitize_suno_styles(spec.get("suno_styles", ""), style)

    # 2. Enforce mandatory mentions and lyrics rules
    spec["lyrics"] = _validate_and_fix_lyrics(spec.get("lyrics", ""))

    # 3. Enforce hashtags: 5 technical + #corridosenhtml #musicadela403
    spec["hashtags"] = _validate_and_fix_hashtags(spec.get("hashtags", ""))

    if not spec.get("description"):
        lyrics = spec.get("lyrics", "")
        spec["description"] = f"{concept}\n\nEstilo: {style}\n\nLetra:\n{lyrics}\n\n{spec['hashtags']}"

    return spec

