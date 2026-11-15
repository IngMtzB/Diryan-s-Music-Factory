"""
services/regeneration.py — Non-interactive building blocks for re-generating
project assets (background image, Data.txt) and for naming a project after
its AI-generated song title.

Kept free of InquirerPy prompts so the logic can be unit-tested with a fake
provider; ``main.py`` wires these into the interactive menu.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from services.checkpoint import CheckpointManager
from services.project_manager import (
    is_draft,
    rename_project_to_title,
    save_background,
    save_spec,
    write_data_file,
)
from services.prompt_engine import request_metadata


def _persist_spec(cp: CheckpointManager, spec: dict[str, Any]) -> None:
    """Keep the SQLite copy of the spec in sync so edits survive a resume."""
    cp.mark_done("SPEC_GENERATED", spec)


def finalize_project_name(
    project_dir: Path,
    cp: CheckpointManager,
    title: str,
) -> tuple[Path, CheckpointManager]:
    """
    Rename a draft project folder after the AI-generated *title*.

    Closes *cp* before renaming (required on Windows) and returns the new
    directory plus a fresh ``CheckpointManager`` opened on it. Non-draft
    folders are left untouched so already-rendered projects keep valid paths.
    """
    if not is_draft(project_dir) or not title.strip():
        return project_dir, cp

    cp.close()
    new_dir = rename_project_to_title(project_dir, title)
    new_cp = CheckpointManager(new_dir)
    new_cp.save_meta(title=title)
    return new_dir, new_cp


def regenerate_background(
    project_dir: Path,
    provider: Any,
    spec: dict[str, Any],
    cp: CheckpointManager,
    prompt: str | None = None,
) -> Path:
    """
    Generate a new ``03_background.png``.

    If *prompt* is given it replaces ``spec["image_prompt"]`` and is saved to
    ``01_styles.json`` and the checkpoint DB before the image call.
    """
    if prompt is not None and prompt.strip():
        if prompt != spec.get("image_prompt"):
            spec["image_prompt"] = prompt
            save_spec(project_dir, spec)
            _persist_spec(cp, spec)

    image_prompt = spec.get("image_prompt", "").strip()
    if not image_prompt:
        raise ValueError("Cannot regenerate background: image prompt is empty.")

    img_bytes = provider.generate_image(image_prompt)
    if not img_bytes:
        raise RuntimeError("Image provider returned no image data.")

    bg_path = save_background(project_dir, img_bytes)
    cp.mark_done("IMAGE_GENERATED", {"path": str(bg_path)})
    return bg_path


def regenerate_data(
    project_dir: Path,
    spec: dict[str, Any],
    cp: CheckpointManager,
    provider: Any | None = None,
    concept: str = "",
    style: str = "",
) -> Path:
    """
    Re-create ``Data.txt``.

    - ``provider=None``: rebuild from the saved spec (0 tokens).
    - With a provider: ask the LLM for a new title, description and hashtags
      for the existing lyrics, update the spec, then write ``Data.txt``.

    The project folder is *not* renamed here, so rendered video paths stay valid.
    """
    if not spec.get("lyrics") and (project_dir / "02_lyrics.txt").exists():
        spec["lyrics"] = (project_dir / "02_lyrics.txt").read_text(encoding="utf-8")

    if provider is not None:
        preserved_lyrics = spec.get("lyrics", "")
        meta = request_metadata(
            provider,
            concept=concept,
            style=style,
            lyrics=preserved_lyrics,
            current_title=spec.get("title", ""),
        )
        spec.update(meta)
        if preserved_lyrics and not spec.get("lyrics"):
            spec["lyrics"] = preserved_lyrics
        save_spec(project_dir, spec)
        _persist_spec(cp, spec)
        return write_data_file(project_dir, spec)

    if style and not spec.get("genre"):
        spec["genre"] = style  # older specs: lets Data.txt show the genre
    return write_data_file(project_dir, spec)
