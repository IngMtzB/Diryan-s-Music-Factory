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
from services.social import build_data_text

console = Console()

AUDIO_FILENAME = "03_song.mp3"


# ── Slug helper ────────────────────────────────────────────────────────────────

def _slugify(text: str, max_len: int = 48) -> str:
    """Turn arbitrary text into a filesystem-safe slug."""
    slug = re.sub(r"[^\w\s-]", "", text.lower())
    slug = re.sub(r"[\s_]+", "_", slug).strip("_")
    return slug[:max_len] or "untitled"


# ── Public API ─────────────────────────────────────────────────────────────────

def is_draft(project_dir: Path) -> bool:
    """Check if project directory is a draft."""
    return project_dir.name.startswith("_draft_")


def rename_project_to_title(project_dir: Path, title: str) -> Path:
    """Rename project folder to the slugified song title."""
    import shutil
    slug = _slugify(title)
    dest = project_dir.parent / slug
    counter = 1
    base = dest
    while dest.exists() and dest != project_dir:
        dest = base.parent / f"{base.name}_{counter}"
        counter += 1
    if dest != project_dir:
        shutil.move(str(project_dir), str(dest))
    return dest


def write_data_file(project_dir: Path, content_or_spec: str | dict[str, Any]) -> Path:
    """Write Data.txt from text or spec dictionary."""
    if isinstance(content_or_spec, dict):
        spec = dict(content_or_spec)
        if not spec.get("lyrics"):
            lyrics_file = project_dir / "02_lyrics.txt"
            if lyrics_file.exists():
                spec["lyrics"] = lyrics_file.read_text(encoding="utf-8").strip()
        text = build_data_text(spec)
    else:
        text = str(content_or_spec)
    data_file = project_dir / "Data.txt"
    data_file.write_text(text, encoding="utf-8")
    return data_file


def create_project(concept: str, draft: bool = False) -> Path:
    """
    Create and return a new project directory under ``projects/<slug>/``.

    The directory is created immediately so subsequent steps can write into it.
    """
    slug = _slugify(concept)
    if draft:
        slug = f"_draft_{slug}"
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
    """
    Save project metadata files into *project_dir*:
    - 01_styles.json: Technical render_spec and image_prompt
    - 02_lyrics.txt:  Plain-text lyrics
    - styles.txt:     Suno-ready comma-separated musical style prompt
    - Data.txt:       YouTube/Social metadata (Title, Description with lyrics, Hashtags)
    """
    styles_path = project_dir / "01_styles.json"
    existing_styles: dict[str, Any] = {}
    if styles_path.exists():
        try:
            existing_styles = json.loads(styles_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    styles_payload: dict[str, Any] = {
        "title": spec.get("title") or existing_styles.get("title", ""),
        "suno_styles": spec.get("suno_styles") or existing_styles.get("suno_styles", ""),
        "image_prompt": spec.get("image_prompt") or existing_styles.get("image_prompt", ""),
        "render_spec": spec.get("render_spec") or existing_styles.get("render_spec", {}),
    }
    if spec.get("style") or existing_styles.get("style"):
        styles_payload["style"] = spec.get("style") or existing_styles.get("style", "")
    if spec.get("concept") or existing_styles.get("concept"):
        styles_payload["concept"] = spec.get("concept") or existing_styles.get("concept", "")
    raw_gtags = spec.get("genre_tags") if "genre_tags" in spec else existing_styles.get("genre_tags")
    if isinstance(raw_gtags, list):
        styles_payload["genre_tags"] = [str(t).strip() for t in raw_gtags if str(t).strip()]
    elif isinstance(raw_gtags, str) and raw_gtags.strip():
        try:
            parsed_gt = json.loads(raw_gtags)
            if isinstance(parsed_gt, list):
                styles_payload["genre_tags"] = [str(t).strip() for t in parsed_gt if str(t).strip()]
        except Exception:
            pass
    styles_path.write_text(
        json.dumps(styles_payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    console.print(f"[green]✔[/green]  Saved [bold]{styles_path.name}[/bold]")

    lyrics_path = project_dir / "02_lyrics.txt"
    lyrics = spec.get("lyrics")
    if lyrics and isinstance(lyrics, str):
        lyrics_path.write_text(lyrics, encoding="utf-8")
        console.print(f"[green]✔[/green]  Saved [bold]{lyrics_path.name}[/bold]")
    elif not lyrics_path.exists():
        lyrics_path.write_text("", encoding="utf-8")
    else:
        # Preserve existing lyrics on disk and load into spec
        existing_lyrics = lyrics_path.read_text(encoding="utf-8")
        if existing_lyrics:
            spec["lyrics"] = existing_lyrics

    # 3 ── styles.txt (Suno AI prompt) ─────────────────────────────────────
    suno_styles = str(spec.get("suno_styles") or "").strip()
    if suno_styles:
        suno_file = project_dir / "styles.txt"
        suno_file.write_text(suno_styles, encoding="utf-8")
        console.print(f"[green]✔[/green]  Saved [bold]{suno_file.name}[/bold] (Suno style prompt)")
    elif (project_dir / "styles.txt").exists():
        spec["suno_styles"] = (project_dir / "styles.txt").read_text(encoding="utf-8").strip()

    # 4 ── Data.txt (YouTube & TikTok metadata) ───────────────────────────
    write_data_file(project_dir, spec)
    console.print(f"[green]✔[/green]  Saved [bold]Data.txt[/bold] (YouTube & TikTok metadata)")


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

