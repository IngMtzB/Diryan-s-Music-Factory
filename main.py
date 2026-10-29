#!/usr/bin/env python3
"""
main.py — Interactive CLI entrypoint for Diryan's Factory Music.

Flow
----
1. Resume check (SQLite-backed session recovery) or New Project.
2. Select AI provider (Gemini or Anthropic) & validate API keys.
3. Collect song concept & style from user.
4. Generate JSON spec (lyrics + image prompt + render params).
5. Generate background image via the selected provider.
6. Save project assets to ``projects/<slug>/``.
7. Wait for the user to drop ``03_song.mp3`` into the folder.
8. Render 16:9 + 9:16 music videos with audio-reactive overlays.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

# Ensure package root is on sys.path so sibling imports work.
_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from InquirerPy import inquirer
from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

import config
from config import get_key, pick_gemini_models
from services.api_client import ProviderClient, build_provider
from services.checkpoint import CheckpointManager, find_resumable_sessions
from services.project_manager import (
    create_project,
    save_background,
    save_spec,
    wait_for_audio,
)
from services.prompt_engine import request_spec
from video.renderer import render

console = Console()


# ── Banner ─────────────────────────────────────────────────────────────────────

_BANNER = r"""
    ╔══════════════════════════════════════════════════╗
    ║                                                  ║
    ║     🎶  Diryan's Factory Music  🎶               ║
    ║     ─── AI-Driven Music Video Generator ───      ║
    ║                                                  ║
    ╚══════════════════════════════════════════════════╝
"""


def _show_banner() -> None:
    console.print(Text(_BANNER, style="bold magenta"))


# ── Session / Resume selection ─────────────────────────────────────────────────

def _prompt_session_choice() -> tuple[CheckpointManager | None, Path | None, dict[str, str]]:
    """
    Check for existing incomplete projects.
    Returns (checkpoint_manager, project_dir, meta) if resuming, or (None, None, {}) for new.
    """
    resumable = find_resumable_sessions()
    if not resumable:
        return None, None, {}

    choices: list[dict[str, Any]] = [
        {"name": "✨ Start a new song project", "value": "new"}
    ]
    for s in resumable:
        concept_disp = (s["concept"][:35] + "…") if len(s["concept"]) > 35 else s["concept"]
        choices.append({
            "name": f"🔄 Resume: {s['name']} (Step: {s['next_step']} | Concept: {concept_disp})",
            "value": s,
        })

    choice = inquirer.select(
        message="Active projects found. Would you like to resume?",
        choices=choices,
        default="new",
    ).execute()

    if choice == "new":
        # Close any open connections from search
        for s in resumable:
            s["checkpoint_manager"].close()
        return None, None, {}

    # Resuming selected session
    selected: dict[str, Any] = choice
    cp: CheckpointManager = selected["checkpoint_manager"]
    # Close other connections
    for s in resumable:
        if s is not selected:
            s["checkpoint_manager"].close()

    project_dir: Path = selected["project_dir"]
    meta = cp.load_meta()
    return cp, project_dir, meta


# ── Provider selection ─────────────────────────────────────────────────────────

def _select_provider(default_val: str = "gemini") -> str:
    choice = inquirer.select(
        message="Select your AI provider:",
        choices=[
            {"name": "✨ Gemini  (Default — Gemini + Imagen 3)", "value": "gemini"},
            {"name": "🤖 Anthropic  (Claude + DALL·E 3)",       "value": "anthropic"},
        ],
        default=default_val,
    ).execute()
    return choice


# ── Step Executor with Retry Support ──────────────────────────────────────────

def _execute_with_retry(step_name: str, cp: CheckpointManager, action_fn: Any) -> Any:
    """
    Execute a pipeline step. If an error occurs, save failed status to SQLite
    and offer the user an immediate Retry or Exit choice.
    """
    while True:
        try:
            return action_fn()
        except KeyboardInterrupt:
            raise
        except Exception as exc:
            cp.mark_failed(step_name, str(exc))
            console.print()
            console.print(Panel(
                f"[red bold]⚠ Error at step [yellow]{step_name}[/yellow][/red bold]\n\n"
                f"{exc}\n\n"
                "[dim]Your session progress has been saved in SQLite checkpoint.[/dim]",
                title="❌ Pipeline Interrupted",
                border_style="red",
            ))

            choice = inquirer.select(
                message=f"How would you like to handle the error at {step_name}?",
                choices=[
                    {"name": "🔄 Retry this step", "value": "retry"},
                    {"name": "🛑 Exit for now (you can resume later)", "value": "exit"},
                ],
                default="retry",
            ).execute()

            if choice == "retry":
                console.print(f"[cyan]Retrying {step_name}…[/cyan]\n")
                continue
            else:
                console.print("\n[yellow]Exiting. Progress safely preserved in session.db.[/yellow]")
                sys.exit(1)


# ── Main flow ──────────────────────────────────────────────────────────────────

def main() -> None:
    _show_banner()

    cp, project_dir, meta = _prompt_session_choice()
    is_resuming = cp is not None

    if is_resuming and project_dir:
        console.print(Panel(
            f"[green bold]🔄 Resuming Project:[/green bold] [cyan]{project_dir.name}[/cyan]\n"
            f"[dim]Progress:[/dim] {cp.get_progress_summary()}",
            title="Session Resumed",
            border_style="green",
        ))
        provider_name = meta.get("provider", "gemini")
        concept = meta.get("concept", project_dir.name)
        style = meta.get("style", "Lo-fi Hip-Hop")
        gemini_text_model = meta.get("gemini_text_model", config.GEMINI_TEXT_MODEL)
        gemini_image_model = meta.get("gemini_image_model", config.GEMINI_IMAGE_MODEL)

        # Validate API keys for the resumed provider
        if not config.validate_and_prompt_keys(provider_name):
            sys.exit(1)
    else:
        # 1 ── Provider ─────────────────────────────────────────────────────────
        provider_name = _select_provider()
        console.print(f"\n[bold cyan]Provider:[/bold cyan] {provider_name}\n")

        # 2 ── Key validation ───────────────────────────────────────────────────
        if not config.validate_and_prompt_keys(provider_name):
            sys.exit(1)

        # 2b ── Gemini model selection (live list from the API) ─────────────────
        gemini_text_model = config.GEMINI_TEXT_MODEL
        gemini_image_model = config.GEMINI_IMAGE_MODEL
        if provider_name == "gemini":
            console.print("\n[bold cyan]Fetching available Gemini models…[/bold cyan]")
            gemini_text_model, gemini_image_model = pick_gemini_models(
                get_key("GEMINI_API_KEY")
            )
            console.print(
                f"  [green]✔[/green] Text  model : [bold]{gemini_text_model}[/bold]\n"
                f"  [green]✔[/green] Image model : [bold]{gemini_image_model}[/bold]\n"
            )

        # 3 ── Song details ─────────────────────────────────────────────────────
        concept = inquirer.text(
            message="Describe your song concept:",
            validate=lambda v: len(v.strip()) > 0,
            invalid_message="Concept cannot be empty.",
        ).execute()

        style = inquirer.text(
            message="Genre / style / vibe:",
            default="Electro corrido tumbado",
        ).execute()

        # Initialize project folder & SQLite checkpoint manager immediately
        project_dir = create_project(concept)
        cp = CheckpointManager(project_dir)
        cp.save_meta(
            provider=provider_name,
            concept=concept,
            style=style,
            gemini_text_model=gemini_text_model,
            gemini_image_model=gemini_image_model,
        )
        cp.mark_done("SESSION_INIT")

    # Reusable provider instance builder
    def _get_provider() -> ProviderClient:
        return build_provider(
            provider_name,
            gemini_text_model=gemini_text_model,
            gemini_image_model=gemini_image_model,
        )

    # 4 ── Step: Generate spec via LLM ──────────────────────────────────────
    if not cp.is_done("SPEC_GENERATED"):
        console.print()
        def _generate_spec_action() -> dict[str, Any]:
            with console.status("[bold green]Generating production spec…[/bold green]"):
                prov = _get_provider()
                res = request_spec(prov, concept, style)
                save_spec(project_dir, res)
                cp.mark_done("SPEC_GENERATED", res)
                return res

        spec = _execute_with_retry("SPEC_GENERATED", cp, _generate_spec_action)
    else:
        spec = cp.load_data("SPEC_GENERATED")
        console.print("[dim]↩ Loaded spec from SQLite checkpoint.[/dim]")

    console.print(Panel(
        spec["lyrics"][:500] + ("…" if len(spec["lyrics"]) > 500 else ""),
        title="📝 Lyrics Preview",
        border_style="cyan",
        box=box.ROUNDED,
    ))

    # 5 ── Step: Generate background image ──────────────────────────────────
    bg_img_path = project_dir / "03_background.png"
    if not cp.is_done("IMAGE_GENERATED") or not bg_img_path.exists():
        def _generate_image_action() -> bytes:
            with console.status("[bold green]Generating background image…[/bold green]"):
                prov = _get_provider()
                img_bytes = prov.generate_image(spec["image_prompt"])
                save_background(project_dir, img_bytes)
                cp.mark_done("IMAGE_GENERATED", {"path": str(bg_img_path)})
                return img_bytes

        _execute_with_retry("IMAGE_GENERATED", cp, _generate_image_action)
    else:
        console.print(f"[dim]↩ Background image already created: [bold]{bg_img_path.name}[/bold][/dim]")

    # 6 ── Step: Assets saved confirmation ──────────────────────────────────
    if not cp.is_done("ASSETS_SAVED"):
        # Ensure all three files are on disk
        if not (project_dir / "01_styles.json").exists() or not (project_dir / "02_lyrics.txt").exists():
            save_spec(project_dir, spec)
        cp.mark_done("ASSETS_SAVED")

    # 7 ── Step: Wait for audio ─────────────────────────────────────────────
    audio_path = project_dir / "03_song.mp3"
    if not cp.is_done("AUDIO_READY") or not (audio_path.exists() and audio_path.stat().st_size > 0):
        def _wait_audio_action() -> Path:
            found_audio = wait_for_audio(project_dir)
            cp.mark_done("AUDIO_READY", {"audio_path": str(found_audio)})
            return found_audio

        _execute_with_retry("AUDIO_READY", cp, _wait_audio_action)
    else:
        console.print(f"[dim]↩ Audio file verified: [bold]{audio_path.name}[/bold][/dim]")

    # 8 ── Step: Render video ───────────────────────────────────────────────
    if not cp.is_done("VIDEO_RENDERED"):
        console.print()
        console.rule("[bold magenta]Video Rendering Pipeline[/bold magenta]")

        def _render_action() -> tuple[Path, Path]:
            v16x9, v9x16 = render(project_dir)
            cp.mark_done(
                "VIDEO_RENDERED",
                {"out_16x9": str(v16x9), "out_9x16": str(v9x16)},
            )
            return v16x9, v9x16

        out_16x9, out_9x16 = _execute_with_retry("VIDEO_RENDERED", cp, _render_action)
    else:
        data = cp.load_data("VIDEO_RENDERED")
        out_16x9 = Path(data.get("out_16x9", project_dir / "04_video_16x9.mp4"))
        out_9x16 = Path(data.get("out_9x16", project_dir / "04_video_9x16.mp4"))

    # ── Done! ──────────────────────────────────────────────────────────────
    cp.close()
    console.print()
    console.print(Panel(
        f"[green bold]✅ All done![/green bold]\n\n"
        f"  📺 Landscape : [cyan]{out_16x9}[/cyan]\n"
        f"  📱 Portrait  : [cyan]{out_9x16}[/cyan]\n\n"
        f"  📁 Project   : [cyan]{project_dir}[/cyan]",
        title="🎬 Render Complete",
        border_style="green",
        box=box.DOUBLE,
    ))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[yellow]Cancelled by user.[/yellow]")
        sys.exit(130)
    except Exception as exc:
        console.print_exception(show_locals=False)
        console.print(Panel(
            f"[red bold]An unexpected error occurred:[/red bold] {exc}\n\n"
            "[yellow]Your progress is recorded in the project's SQLite session.db.[/yellow]",
            title="Fatal Error",
            border_style="red",
        ))
        try:
            input("\nPress Enter to exit...")
        except (KeyboardInterrupt, EOFError):
            pass
        sys.exit(1)


