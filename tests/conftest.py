"""Shared pytest fixtures for Diryan's Factory Music."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services import checkpoint, project_manager  # noqa: E402


LYRICS = (
    "[Intro]\n"
    "Música de la cuatro cero tres,\n"
    "Corridos en ache-te-eme-ele,\n\n"
    "[Verso 1]\n"
    "Prendo la terminal a medianoche\n"
)


class FakeProvider:
    """Stand-in for ProviderClient that records calls and returns canned data."""

    def __init__(
        self,
        spec: dict[str, Any] | None = None,
        image: bytes = b"\x89PNG-fake",
    ) -> None:
        self.spec = spec or {}
        self.image = image
        self.spec_calls: list[tuple[str, str]] = []
        self.image_calls: list[str] = []

    def generate_spec(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        self.spec_calls.append((system_prompt, user_prompt))
        return dict(self.spec)

    def generate_image(self, prompt: str) -> bytes:
        self.image_calls.append(prompt)
        return self.image


@pytest.fixture
def projects_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Redirect PROJECTS_DIR to a temp folder for every module that imported it."""
    target = tmp_path / "projects"
    target.mkdir()
    monkeypatch.setattr(project_manager, "PROJECTS_DIR", target)
    monkeypatch.setattr(checkpoint, "PROJECTS_DIR", target)
    return target


@pytest.fixture
def base_spec() -> dict[str, Any]:
    return {
        "title": "El Último Deploy",
        "suno_styles": "corridos tumbados, requinto, 808",
        "lyrics": LYRICS,
        "description": "Historia de un dev.\n\n" + LYRICS,
        "hashtags": "#DevOps #Git #Cloud #Backend #Linux #corridosenhtml #musicadela403",
        "image_prompt": "neon desert highway at night",
        "render_spec": {"waveform": {"style": "mirrored_bars"}},
    }
