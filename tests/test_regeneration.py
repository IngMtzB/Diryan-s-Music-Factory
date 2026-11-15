"""Regenerating Data.txt and the background image."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from services.checkpoint import CheckpointManager
from services.project_manager import build_data_text, create_project, save_spec
from services.prompt_engine import request_metadata
from services.regeneration import regenerate_background, regenerate_data

from conftest import LYRICS, FakeProvider


@pytest.fixture
def project(projects_dir: Path, base_spec: dict):
    project_dir = create_project(base_spec["title"])
    cp = CheckpointManager(project_dir)
    save_spec(project_dir, base_spec)
    cp.mark_done("SPEC_GENERATED", base_spec)
    yield project_dir, cp
    cp.close()


# ── Data.txt ───────────────────────────────────────────────────────────────────

def test_data_text_has_youtube_and_tiktok_sections(base_spec: dict) -> None:
    text = build_data_text(base_spec)
    assert text.startswith("🎵 Canción: El Último Deploy\n")
    assert text.index("🎬 YOUTUBE") < text.index("📱 TIKTOK")
    assert "📌 Título:\n" in text and "📝 Descripción:\n" in text
    assert "🏷️ Etiquetas (YouTube Studio, separadas por comas):\n" in text
    assert "🏷️ Hashtags:\n" in text
    assert text.endswith("#corridosenhtml #musicadela403\n")


def test_rebuild_data_from_spec_restores_missing_file(project, base_spec: dict) -> None:
    project_dir, cp = project
    data_file = project_dir / "Data.txt"
    data_file.unlink()

    path = regenerate_data(project_dir, base_spec, cp)

    assert path == data_file
    assert data_file.read_text(encoding="utf-8") == build_data_text(base_spec)


def test_regenerate_data_with_ai_updates_files_and_checkpoint(
    project, base_spec: dict
) -> None:
    project_dir, cp = project
    provider = FakeProvider(spec={
        "title": "Merge a Medianoche",
        "youtube_title": "Merge a Medianoche | Corrido Tumbado (Letra)",
        "hook": "Cuando el merge conflict llega a las 3 AM 🌙",
        "description": "Nueva historia del dev.",  # no lyrics → added by the template
        "tiktok_caption": "POV: tu PR tiene 47 conflictos 😅",
        "youtube_tags": ["git", "merge", "corridos tumbados"],
        "hashtags": "#Git #Merge",
    })

    regenerate_data(project_dir, base_spec, cp, provider=provider,
                    concept="programar de noche", style="corrido")

    data = (project_dir / "Data.txt").read_text(encoding="utf-8")
    assert "📌 Título:\nMerge a Medianoche | Corrido Tumbado (Letra)" in data
    assert "Cuando el merge conflict llega a las 3 AM 🌙" in data
    assert "📝 Descripción:\nPOV: tu PR tiene 47 conflictos 😅" in data
    assert "git, merge, corridos tumbados" in data
    assert "Nueva historia del dev." in data
    assert "Prendo la terminal a medianoche" in data  # lyrics appended
    assert "#corridosenhtml #musicadela403" in data
    # Lyrics themselves are untouched.
    assert (project_dir / "02_lyrics.txt").read_text(encoding="utf-8") == LYRICS
    # Spec persisted so a resume sees the new metadata.
    assert cp.load_data("SPEC_GENERATED")["title"] == "Merge a Medianoche"
    styles = json.loads((project_dir / "01_styles.json").read_text(encoding="utf-8"))
    assert styles["title"] == "Merge a Medianoche"
    # The prompt sent to the model contained the lyrics.
    assert "Prendo la terminal" in provider.spec_calls[0][1]


def test_request_metadata_fallbacks() -> None:
    provider = FakeProvider(spec={})
    meta = request_metadata(provider, "concepto", "corrido", LYRICS, current_title="Viejo")
    assert meta["title"] == "Viejo"
    tags = meta["hashtags"].split()
    assert len(tags) == 7
    assert tags[-2:] == ["#corridosenhtml", "#musicadela403"]
    # Every social field gets a fallback so Data.txt is always complete.
    assert meta["youtube_title"] == "Viejo | Corrido (Letra)"
    assert meta["cta"] and meta["tiktok_caption"]
    assert "Viejo" in meta["youtube_tags"]


def test_request_metadata_sends_lyrics_and_social_schema() -> None:
    provider = FakeProvider(spec={"title": "T"})
    request_metadata(provider, "c", "s", LYRICS)
    system_prompt, user_prompt = provider.spec_calls[0]
    assert "Prendo la terminal" in user_prompt
    for key in ("youtube_title", "hook", "youtube_tags", "tiktok_caption", "cta"):
        assert f'"{key}"' in system_prompt


# ── Background image ──────────────────────────────────────────────────────────

def test_regenerate_background_same_prompt(project, base_spec: dict) -> None:
    project_dir, cp = project
    provider = FakeProvider(image=b"NEWIMAGE")

    path = regenerate_background(project_dir, provider, base_spec, cp)

    assert path == project_dir / "03_background.png"
    assert path.read_bytes() == b"NEWIMAGE"
    assert provider.image_calls == ["neon desert highway at night"]
    assert cp.is_done("IMAGE_GENERATED")


def test_regenerate_background_with_edited_prompt_persists(project, base_spec: dict) -> None:
    project_dir, cp = project
    provider = FakeProvider(image=b"IMG2")

    regenerate_background(project_dir, provider, base_spec, cp, prompt="foggy sierra at dawn")

    assert provider.image_calls == ["foggy sierra at dawn"]
    styles = json.loads((project_dir / "01_styles.json").read_text(encoding="utf-8"))
    assert styles["image_prompt"] == "foggy sierra at dawn"
    assert cp.load_data("SPEC_GENERATED")["image_prompt"] == "foggy sierra at dawn"


def test_regenerate_background_failure_keeps_old_image(project, base_spec: dict) -> None:
    project_dir, cp = project
    bg = project_dir / "03_background.png"
    bg.write_bytes(b"OLD")

    with pytest.raises(RuntimeError):
        regenerate_background(project_dir, FakeProvider(image=b""), base_spec, cp)

    assert bg.read_bytes() == b"OLD"


def test_regenerate_background_rejects_empty_prompt(project, base_spec: dict) -> None:
    project_dir, cp = project
    base_spec["image_prompt"] = ""
    with pytest.raises(ValueError):
        regenerate_background(project_dir, FakeProvider(), base_spec, cp)
