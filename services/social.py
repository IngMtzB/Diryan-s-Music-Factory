"""
services/social.py — YouTube + TikTok metadata: normalization of the LLM's
social fields and formatting of ``Data.txt``.

Data.txt layout
---------------
🎬 YOUTUBE  → TITLE, DESCRIPTION (hook, story, lyrics, credits, CTA, hashtags), TAGS
📱 TIKTOK   → CAPTION + short hashtag set

Emojis are allowed but capped per field so the copy stays clean.
"""

from __future__ import annotations

import re
from typing import Any

MANDATORY_HASHTAGS = ["#corridosenhtml", "#musicadela403"]
BRAND_TAGS = ["corridos en html", "musica de la 403", "Diryan's Factory Music"]

YOUTUBE_TITLE_MAX = 100     # YouTube hard limit
YOUTUBE_TAGS_MAX = 500      # YouTube Studio tags field limit (characters)
HOOK_MAX = 150              # visible above "Show more" in the YouTube description
TIKTOK_CAPTION_MAX = 150    # short captions perform best on TikTok

# Emoji budget per field ("some emojis, but not too much")
EMOJI_LIMITS = {"youtube_title": 1, "hook": 2, "description": 2, "cta": 1, "tiktok_caption": 2}

DEFAULT_CTA = (
    "🔔 Suscríbete y activa la campanita para más corridos en HTML. "
    "Comenta qué tecnología quieres en la próxima canción."
)

_SEP = "═" * 44

# One emoji "cluster": base symbol + optional variation selector / skin tone,
# optionally joined with ZWJ to further symbols.
_EMOJI_BASE = "[\U0001F000-\U0001FAFF☀-➿⬀-⯿←-⇿⌀-⏿]"
_EMOJI_RE = re.compile(
    f"{_EMOJI_BASE}[️\U0001F3FB-\U0001F3FF]?(?:‍{_EMOJI_BASE}[️\U0001F3FB-\U0001F3FF]?)*"
)


# ── Small text helpers ─────────────────────────────────────────────────────────

def count_emojis(text: str) -> int:
    return len(_EMOJI_RE.findall(text or ""))


def limit_emojis(text: str, max_count: int) -> str:
    """Keep the first *max_count* emojis in *text*, drop the rest."""
    seen = 0

    def _keep(match: re.Match[str]) -> str:
        nonlocal seen
        seen += 1
        return match.group(0) if seen <= max_count else ""

    out = _EMOJI_RE.sub(_keep, text or "")
    out = re.sub(r"[ \t]{2,}", " ", out)
    return "\n".join(line.strip() for line in out.splitlines()).strip()


def truncate_words(text: str, max_len: int) -> str:
    """Cut *text* to at most *max_len* chars on a word boundary."""
    text = (text or "").strip()
    if len(text) <= max_len:
        return text
    cut = text[: max_len - 1].rsplit(" ", 1)[0].rstrip(" ,.;:-|")
    return f"{cut}…"


def _first_sentence(text: str) -> str:
    text = (text or "").strip()
    match = re.match(r"(.+?[.!?])(\s|$)", text, flags=re.S)
    return (match.group(1) if match else text.splitlines()[0] if text else "").strip()


def _lyrics_fingerprint(lyrics: str) -> str:
    sung = [ln.strip() for ln in (lyrics or "").splitlines()
            if ln.strip() and not ln.strip().startswith("[")]
    return sung[0] if sung else ""


def strip_legacy_lyrics(description: str, lyrics: str) -> str:
    """
    Older specs put lyrics + credits + CTA inside ``description``. Keep only the
    story text before the lyrics; the template re-adds lyrics, credits and CTA.
    """
    description = (description or "").strip()
    fingerprint = _lyrics_fingerprint(lyrics)
    pos = description.find(fingerprint) if fingerprint else -1
    if pos < 0:
        return description
    markers = [description.rfind(m, 0, pos) for m in ("Letra", "[")]
    cut = min([m for m in markers if m >= 0], default=pos)
    return description[:cut].strip()


def contextual_hashtags(hashtags: str) -> list[str]:
    """Hashtags from *hashtags* minus the mandatory brand ones."""
    tags = [t if t.startswith("#") else f"#{t}"
            for t in (hashtags or "").replace(",", " ").split() if t.strip()]
    mandatory = {m.lower() for m in MANDATORY_HASHTAGS}
    return [t for t in tags if t.lower() not in mandatory]


def tiktok_hashtags(hashtags: str) -> str:
    """3 contextual hashtags + the 2 mandatory brand hashtags."""
    return " ".join(contextual_hashtags(hashtags)[:3] + MANDATORY_HASHTAGS)


_NULLISH_VALUES = {"", "null", "none", "undefined", "n/a", "nil"}


def _clean_social_str(val: Any) -> str:
    """Return a clean string, treating None and literal 'null'/'none'/'undefined' as empty."""
    if val is None or isinstance(val, bool):
        return ""
    text = str(val).strip()
    if text.lower() in _NULLISH_VALUES:
        return ""
    return text


def _strip_leading_null_prefix(text: str, replacement_title: str = "") -> str:
    """
    If *text* starts with a literal 'null - ', 'null | ', 'none - ', etc.
    (e.g. 'null - Electro Corrido Tumbado | Corridos en HTML'), replace the
    leading 'null' token with *replacement_title* or strip the prefix.
    """
    text = _clean_social_str(text)
    if not text:
        return ""
    match = re.match(r"^(?:null|none|undefined)\s*([-|—:•])\s*(.+)$", text, flags=re.IGNORECASE)
    if match:
        sep, rest = match.group(1), match.group(2).strip()
        if replacement_title:
            return f"{replacement_title} {sep} {rest}"
        return rest
    return text


def normalize_tags(raw: Any, title: str, genre: str = "") -> str:
    """
    YouTube Studio tags: comma-separated, no '#', deduplicated, ≤ 500 chars.
    Accepts a list or a comma-separated string from the LLM.
    Never includes literal 'null', 'none', or 'undefined'.
    """
    items = raw if isinstance(raw, list) else _clean_social_str(raw).split(",")
    clean_title = _clean_social_str(title)
    clean_genre = _clean_social_str(genre)
    # Title, genre and brand tags first so they always fit inside the limit.
    candidates = [clean_title, clean_genre, *BRAND_TAGS, *items]
    tags: list[str] = []
    seen: set[str] = set()
    for item in candidates:
        tag = _clean_social_str(item).lstrip("#").strip()
        if not tag or tag.lower() in _NULLISH_VALUES or tag.lower() in seen:
            continue
        if len(", ".join([*tags, tag])) > YOUTUBE_TAGS_MAX:
            continue
        seen.add(tag.lower())
        tags.append(tag)
    return ", ".join(tags)


# ── Normalization of LLM output ────────────────────────────────────────────────

def normalize_social(spec: dict[str, Any], genre: str = "") -> dict[str, Any]:
    """
    Fill in / clean the social fields of *spec* in place and return it:
    youtube_title, hook, description, cta, youtube_tags, tiktok_caption.
    Missing fields get sensible fallbacks so Data.txt is always complete.
    """
    title = _clean_social_str(spec.get("title"))
    spec["title"] = title
    if genre:
        spec["genre"] = _clean_social_str(genre)
    genre = _clean_social_str(spec.get("genre"))

    yt_title = _strip_leading_null_prefix(spec.get("youtube_title", ""), title)
    if not yt_title:
        if title and genre:
            yt_title = f"{title} | {genre.title()} (Letra)"
        elif title:
            yt_title = f"{title} (Letra)"
        elif genre:
            yt_title = f"{genre.title()} (Letra)"
        else:
            yt_title = "Corridos en HTML (Letra)"
    spec["youtube_title"] = truncate_words(
        limit_emojis(yt_title, EMOJI_LIMITS["youtube_title"]), YOUTUBE_TITLE_MAX
    )

    hook = _clean_social_str(spec.get("hook"))
    spec["hook"] = truncate_words(limit_emojis(hook, EMOJI_LIMITS["hook"]), HOOK_MAX)

    story = strip_legacy_lyrics(
        _clean_social_str(spec.get("description")),
        _clean_social_str(spec.get("lyrics")),
    )
    spec["description"] = limit_emojis(story, EMOJI_LIMITS["description"])

    cta = _clean_social_str(spec.get("cta")) or DEFAULT_CTA
    spec["cta"] = limit_emojis(cta, EMOJI_LIMITS["cta"])

    spec["youtube_tags"] = normalize_tags(spec.get("youtube_tags"), title, genre)

    caption = _strip_leading_null_prefix(spec.get("tiktok_caption", ""), title)
    if not caption:
        caption = spec["hook"] or _first_sentence(spec["description"]) or title
    spec["tiktok_caption"] = truncate_words(
        limit_emojis(caption, EMOJI_LIMITS["tiktok_caption"]), TIKTOK_CAPTION_MAX
    )
    return spec


# ── Data.txt ───────────────────────────────────────────────────────────────────

def _section(header: str) -> str:
    return f"{_SEP}\n{header}\n{_SEP}"


def build_youtube_description(spec: dict[str, Any]) -> str:
    """The text to paste into the YouTube description box."""
    lyrics = (spec.get("lyrics") or "").strip()
    story = (spec.get("description") or "").strip()
    hook = (spec.get("hook") or "").strip()

    parts: list[str] = []
    if hook and not story.startswith(hook):
        parts.append(hook)
    if story:
        parts.append(story)

    if lyrics:
        parts.append(f"🎵 Letra:\n{lyrics}")

    credits = [
        "🎧 Créditos: Música de la 403 Forbiden",
        "Producción: Diryan's Factory Music",
    ]
    if spec.get("genre"):
        credits.append(f"Género: {spec['genre']}")
    parts.append("\n".join(credits))

    parts.append((spec.get("cta") or DEFAULT_CTA).strip())

    hashtags = (spec.get("hashtags") or "").strip()
    if hashtags:
        parts.append(hashtags)
    return "\n\n".join(parts)


def build_data_text(spec: dict[str, Any]) -> str:
    """Full Data.txt content: a YouTube section and a short TikTok section."""
    spec = normalize_social(dict(spec))
    title = (spec.get("title") or "").strip()

    youtube = (
        f"{_section('🎬 YOUTUBE')}\n\n"
        f"📌 Título:\n{spec['youtube_title']}\n\n"
        f"📝 Descripción:\n{build_youtube_description(spec)}\n\n"
        f"🏷️ Etiquetas (YouTube Studio, separadas por comas):\n{spec['youtube_tags']}\n"
    )
    tiktok = (
        f"{_section('📱 TIKTOK')}\n\n"
        f"📝 Descripción:\n{spec['tiktok_caption']}\n\n"
        f"🏷️ Hashtags:\n{tiktok_hashtags(spec.get('hashtags', ''))}\n"
    )
    header = f"🎵 Canción: {title}\n\n" if title else ""
    return f"{header}{youtube}\n{tiktok}"
