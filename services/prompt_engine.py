"""
services/prompt_engine.py — Builds the system prompt from rule files and
requests a strict JSON spec from the selected LLM.
"""

from __future__ import annotations

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
  "suno_styles": "<comma-separated list of 8-12 specific tags for Suno AI music generation, including subgenres, primary acoustic & electronic instruments, rhythm/bpm feel, bass style, mood, and production texture. e.g. 'electro corrido tumbado, corrido tumbado, regional mexicano, electronic trap beat, heavy synth bass, melancholic requinto, fat 808 sub-bass, futuristic regional, dark atmospheric synths, crisp snappy drums'>",
  "lyrics": "<full song lyrics as a single string, section headers in [brackets], lines separated by \\n>",
  "description": "<an engaging YouTube/TikTok/Instagram description explaining the vibe/story of the song, followed by the complete lyrics, credits, and call to action>",
  "hashtags": "<8 to 15 relevant space-separated hashtags, e.g. '#ElectroCorrido #CorridosTumbados #TrapLatino #RegionalMexicano #ViralMusic'>",
  "image_prompt": "<a vivid, genre-matched 16:9 background image generation prompt that follows the visual rules, keeping the lower 25% dark/simple for overlay space>",
  "render_spec": {
    "waveform": {
      "style": "<frequency_bars | mirrored_bars | equalizer | neon_glow_line | none>",
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

    if not spec.get("suno_styles"):
        spec["suno_styles"] = f"{style.lower()}, acoustic and electronic elements, modern production, clear vocals, punchy rhythm"

    if not spec.get("description"):
        lyrics = spec.get("lyrics", "")
        spec["description"] = f"{concept}\n\nStyle: {style}\n\nLyrics:\n{lyrics}"

    if not spec.get("hashtags"):
        slug_genre = "".join(w.capitalize() for w in style.split() if w.isalnum())
        spec["hashtags"] = f"#{slug_genre} #NewMusic #AIGeneratedMusic #DiryansMusicFactory"

    return spec

