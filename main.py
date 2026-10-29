#!/usr/bin/env python3
"""
main.py — Interactive CLI entrypoint for Diryan's Factory Music.

Flow
----
1. Select AI provider (Gemini or Anthropic).
2. Validate / prompt for API keys.
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

# Ensure package root is on sys.path so sibling imports work.
_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from InquirerPy import inquirer
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich import box

import config
from config import pick_gemini_models, get_key
from services.api_client import build_provider
from services.prompt_engine import request_spec
from services.project_manager import create_project, save_assets, wait_for_audio
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


# ── Provider selection ─────────────────────────────────────────────────────────

def _select_provider() -> str:
    choice = inquirer.select(
        message="Select your AI provider:",
        choices=[
            {"name": "✨ Gemini  (Default — Gemini + Imagen 3)", "value": "gemini"},
            {"name": "🤖 Anthropic  (Claude + DALL·E 3)",       "value": "anthropic"},
        ],
        default="gemini",
    ).execute()
    return choice


# ── Main flow ──────────────────────────────────────────────────────────────────

def main() -> None:
    _show_banner()

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
        default="Lo-fi Hip-Hop",
    ).execute()

    # 4 ── Generate spec via LLM ────────────────────────────────────────────
    console.print()
    with console.status("[bold green]Generating production spec…[/bold green]"):
        provider = build_provider(
            provider_name,
            gemini_text_model=gemini_text_model,
            gemini_image_model=gemini_image_model,
        )
        spec = request_spec(provider, concept, style)

    console.print(Panel(
        spec["lyrics"][:500] + ("…" if len(spec["lyrics"]) > 500 else ""),
        title="📝 Lyrics Preview",
        border_style="cyan",
        box=box.ROUNDED,
    ))

    # 5 ── Generate background image ────────────────────────────────────────
    with console.status("[bold green]Generating background image…[/bold green]"):
        bg_bytes = provider.generate_image(spec["image_prompt"])

    # 6 ── Save project assets ──────────────────────────────────────────────
    project_dir = create_project(concept)
    save_assets(project_dir, spec, bg_bytes)

    # 7 ── Wait for audio ──────────────────────────────────────────────────
    audio_path = wait_for_audio(project_dir)

    # 8 ── Render video ─────────────────────────────────────────────────────
    console.print()
    console.rule("[bold magenta]Video Rendering Pipeline[/bold magenta]")
    out_16x9, out_9x16 = render(project_dir)

    # ── Done! ──────────────────────────────────────────────────────────────
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
        sys.exit(1)

