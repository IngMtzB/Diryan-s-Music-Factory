"""YouTube + TikTok formatting of Data.txt."""

from __future__ import annotations

from services.prompt_engine import _JSON_SCHEMA_INSTRUCTIONS
from services.social import (
    YOUTUBE_TAGS_MAX,
    build_data_text,
    build_youtube_description,
    count_emojis,
    limit_emojis,
    normalize_social,
    normalize_tags,
    tiktok_hashtags,
)

from conftest import LYRICS

HASHTAGS = "#IA #Tokens #DevHumor #Frontend #Backend #corridosenhtml #musicadela403"


def _spec(**extra) -> dict:
    spec = {
        "title": "Tokens en Ascenso",
        "genre": "electro corrido tumbado",
        "lyrics": LYRICS,
        "description": "Un dev que no sabe centrar un div asciende gracias a la IA.",
        "hashtags": HASHTAGS,
    }
    spec.update(extra)
    return spec


# ── Emoji budget ───────────────────────────────────────────────────────────────

def test_limit_emojis_keeps_only_the_first_n() -> None:
    assert limit_emojis("Hola 🔥🔥 mundo 🚀 fin 🎉", 2) == "Hola 🔥🔥 mundo fin"
    assert limit_emojis("Sin emojis, ¡pero con acentos ñ!", 0) == "Sin emojis, ¡pero con acentos ñ!"


def test_limit_emojis_handles_compound_emojis() -> None:
    assert count_emojis("👨‍💻 ❤️ 👍🏽") == 3
    assert limit_emojis("👨‍💻 code ❤️", 1) == "👨‍💻 code"


def test_whole_data_file_stays_light_on_emojis() -> None:
    noisy = _spec(
        youtube_title="🔥🔥 Tokens 🔥 en Ascenso 🚀",
        hook="🤖🤖🤖 La IA me dio el ascenso 💼💼",
        cta="🔔🔔 Suscríbete 👍👍",
        tiktok_caption="😅😅😅 POV: se acabaron los tokens 💀💀",
    )
    text = build_data_text(noisy)
    yt_title = text.split("📌 Título:\n")[1].splitlines()[0]
    assert count_emojis(yt_title) <= 1
    caption = text.split("📱 TIKTOK")[1].split("📝 Descripción:\n")[1].splitlines()[0]
    assert count_emojis(caption) <= 2
    # Section headers (with emojis) + description fields: reasonable count, not dozens.
    assert count_emojis(text) <= 16


# ── YouTube ────────────────────────────────────────────────────────────────────

def test_youtube_title_fallback_and_length_limit() -> None:
    spec = normalize_social(_spec())
    assert spec["youtube_title"] == "Tokens en Ascenso | Electro Corrido Tumbado (Letra)"

    long = normalize_social(_spec(youtube_title="palabra " * 30))
    assert len(long["youtube_title"]) <= 100


def test_hook_is_short_enough_for_above_the_fold() -> None:
    spec = normalize_social(_spec(hook="muy " * 80))
    assert len(spec["hook"]) <= 150


def test_youtube_description_order() -> None:
    spec = normalize_social(_spec(hook="La IA me dio el ascenso 🤖"))
    desc = build_youtube_description(spec)
    order = [
        desc.index("La IA me dio el ascenso"),          # hook (above "Show more")
        desc.index("Un dev que no sabe centrar"),       # story
        desc.index("🎵 Letra:"),                        # lyrics
        desc.index("🎧 Créditos:"),                     # credits
        desc.index("Suscríbete"),                       # call to action
        desc.index("#corridosenhtml"),                  # hashtags last
    ]
    assert order == sorted(order)
    assert "Género: electro corrido tumbado" in desc


def test_data_text_spanish_emojis_and_exact_credits() -> None:
    spec = _spec(lyrics="Verso 1 de prueba")
    text = build_data_text(spec)

    # Separators
    sep = "═" * 44
    assert f"{sep}\n🎬 YOUTUBE\n{sep}" in text
    assert f"{sep}\n📱 TIKTOK\n{sep}" in text

    # No English words in section headers
    assert "TITLE:" not in text
    assert "DESCRIPTION:" not in text
    assert "TAGS (" not in text
    assert "CAPTION:" not in text
    assert "SONG:" not in text

    # Emojis on headers
    assert "📌 Título:\n" in text
    assert "📝 Descripción:\n" in text
    assert "🏷️ Etiquetas (YouTube Studio, separadas por comas):\n" in text
    assert "🏷️ Hashtags:\n" in text

    # Lyrics included
    assert "🎵 Letra:\nVerso 1 de prueba" in text

    # Exact credits
    expected_credits = (
        "🎧 Créditos: Música de la 403 Forbiden\n"
        "Producción: Diryan's Factory Music"
    )
    assert expected_credits in text


def test_legacy_description_with_lyrics_is_not_duplicated() -> None:
    legacy = _spec(description=(
        "Historia.\n\nLetra:\n" + LYRICS +
        "\nCréditos: Producido por Diryan's Factory Music AI.\nSuscríbete, activa la campanita."
    ))
    spec = normalize_social(legacy)
    assert spec["description"] == "Historia."
    desc = build_youtube_description(spec)
    assert desc.count("Prendo la terminal a medianoche") == 1
    assert desc.count("Créditos") == 1
    assert desc.count("campanita") == 1


def test_tags_have_no_hash_are_unique_and_fit_youtube_limit() -> None:
    raw = ["#IA", "ia", "corridos tumbados", *[f"keyword largo numero {i}" for i in range(60)]]
    tags = normalize_tags(raw, "Tokens en Ascenso", "electro corrido")
    items = tags.split(", ")
    assert len(tags) <= YOUTUBE_TAGS_MAX
    assert items[0] == "Tokens en Ascenso"
    assert "#" not in tags
    assert [t.lower() for t in items].count("ia") == 1
    assert "corridos en html" in items  # brand tags always present


def test_tags_accept_comma_separated_string() -> None:
    assert normalize_tags("git, docker , ", "T").endswith("git, docker")


# ── TikTok ─────────────────────────────────────────────────────────────────────

def test_tiktok_section_is_short() -> None:
    text = build_data_text(_spec(tiktok_caption="POV: se acabaron los tokens a mitad de sprint 😅"))
    tiktok = text.split("📱 TIKTOK")[1]
    assert "POV: se acabaron los tokens a mitad de sprint 😅" in tiktok
    assert "Letra" not in tiktok
    assert tiktok.strip().endswith("#IA #Tokens #DevHumor #corridosenhtml #musicadela403")


def test_tiktok_hashtags_are_3_contextual_plus_brand() -> None:
    assert tiktok_hashtags(HASHTAGS).split() == [
        "#IA", "#Tokens", "#DevHumor", "#corridosenhtml", "#musicadela403"
    ]


def test_tiktok_caption_falls_back_to_hook_then_story() -> None:
    assert normalize_social(_spec(hook="Gancho corto"))["tiktok_caption"] == "Gancho corto"
    assert normalize_social(_spec())["tiktok_caption"].startswith("Un dev que no sabe centrar")


# ── Prompt ─────────────────────────────────────────────────────────────────────

def test_spec_prompt_asks_for_social_fields() -> None:
    assert "{_SOCIAL_FIELDS}" not in _JSON_SCHEMA_INSTRUCTIONS
    for key in ("youtube_title", "hook", "youtube_tags", "tiktok_caption", "cta", "hashtags"):
        assert f'"{key}"' in _JSON_SCHEMA_INSTRUCTIONS


def test_null_title_and_tags_are_sanitized() -> None:
    """Regression test: literal 'null' from LLM in title/youtube_title/youtube_tags is stripped."""
    corrupted = _spec(
        title="null",
        youtube_title="null - Electro Corrido Tumbado | Corridos en HTML",
        youtube_tags="null, electro corrido, corridos tumbados, none, undefined",
        tiktok_caption="null - POV: te dejaron en visto",
    )
    cleaned = normalize_social(corrupted)
    assert cleaned["title"].lower() != "null"
    assert not cleaned["youtube_title"].lower().startswith("null")
    assert "Electro Corrido Tumbado | Corridos en HTML" in cleaned["youtube_title"]
    tag_items = [t.strip().lower() for t in cleaned["youtube_tags"].split(",")]
    assert "null" not in tag_items
    assert "none" not in tag_items
    assert "undefined" not in tag_items
    assert not cleaned["tiktok_caption"].lower().startswith("null")

