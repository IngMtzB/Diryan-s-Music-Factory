"""
services/project_manager.py — Workspace creation, asset writing, and
blocking poll for the user-supplied audio file.
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any

from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

from config import PROJECTS_DIR

console = Console()

AUDIO_FILENAME = "03_song.mp3"


# ── Slug helper ────────────────────────────────────────────────────────────────

def _slugify(text: str, max_len: int = 48) -> str:
    """Turn arbitrary text into a filesystem-safe slug."""
    slug = re.sub(r"[^\w\s-]", "", text.lower())
    slug = re.sub(r"[\s_]+", "_", slug).strip("_")
    return slug[:max_len] or "untitled"


# ── Public API ─────────────────────────────────────────────────────────────────

def create_project(concept: str) -> Path:
    """
    Create and return a new project directory under ``projects/<slug>/``.

    The directory is created immediately so subsequent steps can write into it.
    """
    slug = _slugify(concept)
    project_dir = PROJECTS_DIR / slug

    # Avoid collisions by appending a counter
    counter = 1
    base = project_dir
    while project_dir.exists():
        project_dir = base.parent / f"{base.name}_{counter}"
        counter += 1

    project_dir.mkdir(parents=True, exist_ok=True)
    console.print(f"[green]📁 Project folder:[/green] {project_dir}")
    return project_dir


def save_spec(project_dir: Path, spec: dict[str, Any]) -> None:
    """Save 01_styles.json and 02_lyrics.txt into *project_dir*."""
    styles_path = project_dir / "01_styles.json"
    styles_payload = {
        "image_prompt": spec.get("image_prompt", ""),
        "render_spec": spec.get("render_spec", {}),
    }
    styles_path.write_text(
        json.dumps(styles_payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    console.print(f"[green]✔[/green]  Saved [bold]{styles_path.name}[/bold]")

    lyrics_path = project_dir / "02_lyrics.txt"
    lyrics_path.write_text(spec.get("lyrics", ""), encoding="utf-8")
    console.print(f"[green]✔[/green]  Saved [bold]{lyrics_path.name}[/bold]")


def save_background(project_dir: Path, background_bytes: bytes) -> Path:
    """Save 03_background.png into *project_dir* and return its Path."""
    bg_path = project_dir / "03_background.png"
    bg_path.write_bytes(background_bytes)
    console.print(f"[green]✔[/green]  Saved [bold]{bg_path.name}[/bold]")
    return bg_path


def save_assets(
    project_dir: Path,
    spec: dict[str, Any],
    background_bytes: bytes,
) -> None:
    """
    Write the three generated assets into *project_dir*:

    - ``01_styles.json``   – metadata + render_spec
    - ``02_lyrics.txt``    – plain-text lyrics
    - ``03_background.png``– AI-generated background image
    """
    save_spec(project_dir, spec)
    save_background(project_dir, background_bytes)


def wait_for_audio(project_dir: Path, poll_interval: float = 2.0) -> Path:
    """
    Block until ``03_song.mp3`` appears in *project_dir*.

    Displays a rich spinner while waiting.  Returns the Path to the audio file.
    """
    audio_path = project_dir / AUDIO_FILENAME

    console.print()
    console.print(Panel(
        f"[bold yellow]Drop your audio file into the project folder:[/bold yellow]\n\n"
        f"  [cyan]{audio_path}[/cyan]\n\n"
        f"The renderer will start automatically once the file is detected.",
        title="🎵 Waiting for Audio",
        border_style="yellow",
    ))

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
        transient=True,
    ) as progress:
        task = progress.add_task("Polling for 03_song.mp3…", total=None)
        while True:
            if audio_path.exists() and audio_path.stat().st_size > 0:
                break
            time.sleep(poll_interval)

    console.print(f"\n[green]🎶 Audio file detected![/green]  {audio_path}")
    return audio_path

