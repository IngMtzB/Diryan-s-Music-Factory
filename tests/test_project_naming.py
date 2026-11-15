"""Projects are named after the AI-generated song title, not the concept."""

from __future__ import annotations

from pathlib import Path

from services.checkpoint import CheckpointManager, find_resumable_sessions
from services.project_manager import (
    create_project,
    is_draft,
    rename_project_to_title,
    save_spec,
)
from services.regeneration import finalize_project_name


def test_new_project_starts_as_draft(projects_dir: Path) -> None:
    project = create_project("un corrido sobre programar de noche", draft=True)
    assert project.parent == projects_dir
    assert is_draft(project)
    assert project.name == "_draft_un_corrido_sobre_programar_de_noche"


def test_rename_uses_title_slug(projects_dir: Path) -> None:
    project = create_project("concept text", draft=True)
    (project / "02_lyrics.txt").write_text("hola", encoding="utf-8")

    renamed = rename_project_to_title(project, "El Último Deploy!")

    assert renamed.name == "el_último_deploy"
    assert not project.exists()
    assert (renamed / "02_lyrics.txt").read_text(encoding="utf-8") == "hola"


def test_rename_avoids_collisions(projects_dir: Path) -> None:
    (projects_dir / "el_ultimo_deploy").mkdir()
    project = create_project("x", draft=True)
    renamed = rename_project_to_title(project, "El Ultimo Deploy")
    assert renamed.name == "el_ultimo_deploy_1"


def test_finalize_renames_draft_and_reopens_checkpoint(
    projects_dir: Path, base_spec: dict
) -> None:
    project = create_project("some long concept the user typed", draft=True)
    cp = CheckpointManager(project)
    cp.save_meta(concept="some long concept the user typed", provider="gemini")
    save_spec(project, base_spec)
    cp.mark_done("SPEC_GENERATED", base_spec)

    new_dir, new_cp = finalize_project_name(project, cp, base_spec["title"])
    try:
        assert new_dir.name == "el_último_deploy"
        assert not is_draft(new_dir)
        assert (new_dir / "Data.txt").exists()
        assert (new_dir / "session.db").exists()
        # Checkpoint state survives the rename and the title is recorded.
        assert new_cp.is_done("SPEC_GENERATED")
        assert new_cp.load_data("SPEC_GENERATED")["title"] == base_spec["title"]
        assert new_cp.load_meta()["title"] == base_spec["title"]
    finally:
        new_cp.close()


def test_finalize_leaves_non_draft_projects_alone(
    projects_dir: Path, base_spec: dict
) -> None:
    # Older (already-rendered) projects keep their folder so stored paths stay valid.
    project = create_project("old concept based project")
    cp = CheckpointManager(project)
    try:
        new_dir, new_cp = finalize_project_name(project, cp, base_spec["title"])
        assert new_dir == project
        assert new_cp is cp
    finally:
        cp.close()


def test_resume_list_exposes_title(projects_dir: Path, base_spec: dict) -> None:
    project = create_project("concept", draft=True)
    cp = CheckpointManager(project)
    cp.save_meta(concept="concept")
    _, cp = finalize_project_name(project, cp, base_spec["title"])
    cp.close()

    sessions = find_resumable_sessions()
    try:
        assert len(sessions) == 1
        assert sessions[0]["title"] == base_spec["title"]
        assert sessions[0]["name"] == "el_último_deploy"
    finally:
        for s in sessions:
            s["checkpoint_manager"].close()
