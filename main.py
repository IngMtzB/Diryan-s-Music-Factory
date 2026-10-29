#!/usr/bin/env python3
"""
main.py — Interactive CLI entrypoint for Diryan's Factory Music.

Flow
----
1. Resume check (SQLite-backed session recovery) or New Project.
2. Select AI provider (Gemini or Anthropic) & validate API keys.
3. Collect song concept & style from user.
4. Generate JSON spec (lyrics + image prompt + Suno styles + metadata).
5. Generate background image via the selected provider.
6. Save project assets to ``projects/<slug>/``:
   - styles.txt (Suno prompt)
   - Data.txt (Title, Description with lyrics, Hashtags)
   - 01_styles.json, 02_lyrics.txt, 03_background.png
7. Wait for the user to drop ``03_song.mp3`` into the folder.
8. Interactive visualizer configuration (waveform style, auto-palette, shake, pulse).
9. Render 16:9 + 9:16 music videos with multi-band audio-reactive overlays.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Callable

# Ensure UTF-8 output on Windows consoles to prevent UnicodeEncodeError
if sys.stdout is not None and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr is not None and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

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
from config import (
    get_key,
    pick_gemini_image_model,
    pick_gemini_models,
    pick_gemini_text_model,
)
from services.api_client import ProviderClient, build_provider
from services.checkpoint import CheckpointManager, find_resumable_sessions
from services.project_manager import (
    create_project,
    save_background,
    save_spec,
    wait_for_audio,
)
from services.prompt_engine import request_spec
from video.renderer import extract_palette_from_image, render

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
        if s.get("is_complete"):
            label = f"🎬 Open / Re-render: {s['name']} (Completed | Concept: {concept_disp})"
        else:
            label = f"🔄 Resume: {s['name']} (Step: {s['next_step']} | Concept: {concept_disp})"
        choices.append({
            "name": label,
            "value": s,
        })

    choice = inquirer.select(
        message="Active song projects found. Choose an option:",
        choices=choices,
        default="new",
    ).execute()

    if choice == "new":
        for s in resumable:
            s["checkpoint_manager"].close()
        return None, None, {}

    selected: dict[str, Any] = choice
    cp: CheckpointManager = selected["checkpoint_manager"]
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


# ── Step Executor with Retry & Change-Model Support ────────────────────────────

def _execute_with_retry(
    step_name: str,
    cp: CheckpointManager,
    action_fn: Any,
    on_change_model: Callable[[], None] | None = None,
) -> Any:
    """
    Execute a pipeline step. If an error occurs, save failed status to SQLite
    and offer immediate Retry, Model Change, or Exit.
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

            choices: list[dict[str, Any]] = [
                {"name": "🔄 Retry this step", "value": "retry"},
            ]
            if on_change_model is not None:
                choices.append({"name": "⚙️ Change model and retry", "value": "change_model"})
            choices.append({"name": "🛑 Exit for now (you can resume later)", "value": "exit"})

            choice = inquirer.select(
                message=f"How would you like to handle the error at {step_name}?",
                choices=choices,
                default="retry",
            ).execute()

            if choice == "retry":
                console.print(f"[cyan]Retrying {step_name}…[/cyan]\n")
                continue
            elif choice == "change_model" and on_change_model is not None:
                on_change_model()
                console.print(f"[cyan]Model updated. Retrying {step_name}…[/cyan]\n")
                continue
            else:
                console.print("\n[yellow]Exiting. Progress safely preserved in session.db.[/yellow]")
                sys.exit(1)


# ── Interactive Visualizer Configuration ───────────────────────────────────────

def _configure_visualizer_interactive(
    project_dir: Path, default_spec: dict[str, Any]
) -> dict[str, Any]:
    """
    Allow the user to interactively choose waveform style, color palette,
    camera bass shake, and beat pulse before rendering video.
    """
    console.print()
    console.rule("[bold magenta]🎬 Video Visualizer Customization[/bold magenta]")
    console.print("[dim]Configure the audio-reactive effects to match your style:[/dim]")
    console.print("[dim]💡 Local GPU/CPU rendering — consumes [bold green]0 AI tokens[/bold green].[/dim]\n")

    # 1. Waveform style
    style = inquirer.select(
        message="Select waveform visual style (form):",
        choices=[
            {
                "name": "✨ Capsule Bars with Water Reflection (Image 1 style — Clean & Modern)",
                "value": "rounded_mirror",
            },
            {
                "name": "🟣 Halftone LED Dot Matrix (Image 2 style — Stadium Concert Grid)",
                "value": "dot_matrix",
            },
            {
                "name": "🎛️ Neon Segmented Ladder with Floor Reflection (Image 4 style — 3D Cyber Club)",
                "value": "neon_ladder",
            },
            {
                "name": "⚡ Double-Sided Center Soundwave (Image 5 style — Stem Waveform)",
                "value": "center_symmetrical",
            },
            {
                "name": "〰️ Glowing Sine Wave Ribbons (Image 3 style — Fluid Multi-Harmonics)",
                "value": "flowing_ribbons",
            },
            {
                "name": "📐 Cyber Polygon Spikes (Image 3 style — Razor-sharp EDM Trap)",
                "value": "sharp_spikes",
            },
            {
                "name": "📊 Classic Mirrored Spectrum (Solid rounded bars — Bass in Center)",
                "value": "mirrored_bars",
            },
            {
                "name": "📈 Classic Frequency Bars (Solid rounded bars — Left to Right)",
                "value": "frequency_bars",
            },
            {
                "name": "🚫 Clean (No waveform — Camera shake & beat pulse only)",
                "value": "none",
            },
        ],
        default="rounded_mirror",
    ).execute()

    # 2. Color Palette & Gradient
    palette_colors = ["#00E5FF", "#FF2A55"]
    color_mode = "horizontal"

    if style != "none":
        bg_path = project_dir / "03_background.png"
        auto_c1, auto_c2 = extract_palette_from_image(bg_path)

        palette_choice = inquirer.select(
            message="Select waveform color palette:",
            choices=[
                {
                    "name": f"🎨 Auto-Sample from Background Art ({auto_c1} & {auto_c2}) — Harmonized",
                    "value": "auto",
                },
                {
                    "name": "🌅 Sunset Fire (Image 5 style — Crimson #FF1744 → Orange #FF6D00 → Gold #FFD600)",
                    "value": "sunset",
                },
                {
                    "name": "🌆 Synthwave Neon (Image 2 & 4 style — Cyan #00F0FF → Purple #B000FF → Hot Pink #FF007F)",
                    "value": "cyberpunk",
                },
                {
                    "name": "🌈 Pastel Horizon Spectrum (Image 1 style — Yellow #FFE66D → Teal #4ECDC4 → Purple #7B2CBF → Coral #FF6B6B)",
                    "value": "pastel",
                },
                {
                    "name": "🎛️ Studio Peak Meter (Image 3 style — Green #00E676 → Yellow #FFD600 → Red #FF1744)",
                    "value": "studio",
                },
                {
                    "name": "👑 Regal Gold & Amber (#FFDF00 & #FF8C00)",
                    "value": "gold",
                },
                {
                    "name": "🧊 Glacier Cyan & Frost (#00FFFF & #FFFFFF)",
                    "value": "ice",
                },
                {
                    "name": "🎨 Custom Hex Color(s) (Type your own)",
                    "value": "custom",
                },
                {
                    "name": "🤖 Keep AI Suggested Colors",
                    "value": "spec",
                },
            ],
            default="auto",
        ).execute()

        if palette_choice == "auto":
            palette_colors = [auto_c1, auto_c2]
        elif palette_choice == "sunset":
            palette_colors = ["#FF1744", "#FF6D00", "#FFD600"]
        elif palette_choice == "cyberpunk":
            palette_colors = ["#00F0FF", "#B000FF", "#FF007F"]
        elif palette_choice == "pastel":
            palette_colors = ["#FFE66D", "#4ECDC4", "#7B2CBF", "#FF6B6B"]
        elif palette_choice == "studio":
            palette_colors = ["#00E676", "#FFD600", "#FF1744"]
        elif palette_choice == "gold":
            palette_colors = ["#FFDF00", "#FF8C00"]
        elif palette_choice == "ice":
            palette_colors = ["#00FFFF", "#FFFFFF"]
        elif palette_choice == "custom":
            custom_input = inquirer.text(
                message="Enter 1 to 4 comma-separated hex colors (e.g. #FF0055, #00E5FF):",
                default="#00E5FF, #FF2A55",
            ).execute()
            parsed = [c.strip() for c in custom_input.split(",") if c.strip().startswith("#")]
            palette_colors = parsed if parsed else ["#00E5FF", "#FF2A55"]
        else:
            wf = default_spec.get("waveform", {})
            p1 = wf.get("primary_color", "#00E5FF")
            p2 = wf.get("secondary_color", "#FF2A55")
            palette_colors = [p1, p2]

        # Select gradient flow mode
        if style not in ("flowing_ribbons",):
            color_mode = inquirer.select(
                message="Color gradient direction:",
                choices=[
                    {
                        "name": "↔️ Horizontal Gradient (Colors flow smoothly across screen width from Left to Right)",
                        "value": "horizontal",
                    },
                    {
                        "name": "↕️ Vertical Height Gradient (Colors shift as bars grow taller/louder)",
                        "value": "vertical",
                    },
                ],
                default="horizontal" if style in ("rounded_mirror", "center_symmetrical", "sharp_spikes") else "vertical",
            ).execute()

    primary = palette_colors[0]
    secondary = palette_colors[-1]

    # 3. Waveform Position
    position = "bottom"
    if style != "none":
        position = inquirer.select(
            message="Waveform position on screen:",
            choices=[
                {"name": "⬇️ Bottom (Lower third — Recommended)", "value": "bottom"},
                {"name": "⏺️ Center (Vertically centered)", "value": "center"},
            ],
            default="bottom",
        ).execute()

    # 4. Camera Shake Intensity
    shake_choice = inquirer.select(
        message="Camera Bass Shake intensity (reacts to heavy 808s & kicks):",
        choices=[
            {"name": "⚡ Dynamic Medium (6px punch — Recommended)", "value": 6},
            {"name": "🔥 Hardcore Punch (12px intense bass shake)", "value": 12},
            {"name": "🌊 Subtle (3px gentle shake)", "value": 3},
            {"name": "🚫 Disabled (Steady frame)", "value": 0},
        ],
        default=6,
    ).execute()

    # 5. Beat Pulse
    pulse_choice = inquirer.select(
        message="Background brightness beat pulse:",
        choices=[
            {"name": "✨ Enabled (Subtle brightness surge on beat drops)", "value": True},
            {"name": "🚫 Disabled", "value": False},
        ],
        default=True,
    ).execute()

    configured_spec = {
        "waveform": {
            "style": style,
            "position": position,
            "primary_color": primary,
            "secondary_color": secondary,
            "palette_colors": palette_colors,
            "color_mode": color_mode,
            "bar_count": 48,
        },
        "motion_effects": {
            "bass_shake": shake_choice > 0,
            "shake_intensity_px": shake_choice,
            "background_pulse": pulse_choice,
        },
    }

    console.print(
        f"\n[green]✔ Configuration applied:[/green] "
        f"Style: [bold]{style}[/bold] | "
        f"Palette: [cyan]{', '.join(palette_colors)}[/cyan] ({color_mode}) | "
        f"Shake: [yellow]{shake_choice}px[/yellow] | "
        f"Pulse: [yellow]{pulse_choice}[/yellow]\n"
    )
    return configured_spec


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
        style = meta.get("style", "Electro corrido tumbado")
        gemini_text_model = meta.get("gemini_text_model", config.GEMINI_TEXT_MODEL)
        gemini_image_model = meta.get("gemini_image_model", config.GEMINI_IMAGE_MODEL)

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
            with console.status("[bold green]Generating production spec, Suno styles & lyrics…[/bold green]"):
                prov = _get_provider()
                res = request_spec(prov, concept, style)
                save_spec(project_dir, res)
                cp.mark_done("SPEC_GENERATED", res)
                return res

        def _on_change_text_model() -> None:
            nonlocal gemini_text_model
            if provider_name == "gemini":
                gemini_text_model = pick_gemini_text_model(
                    get_key("GEMINI_API_KEY"), current_model=gemini_text_model
                )
                cp.save_meta(gemini_text_model=gemini_text_model)
                console.print(f"[green]✔ Switched Gemini text model to:[/green] [bold]{gemini_text_model}[/bold]")

        spec = _execute_with_retry(
            "SPEC_GENERATED",
            cp,
            _generate_spec_action,
            on_change_model=_on_change_text_model if provider_name == "gemini" else None,
        )
    else:
        spec = cp.load_data("SPEC_GENERATED")
        console.print("[dim]↩ Loaded spec from SQLite checkpoint.[/dim]")

    # Display Suno Style prompt panel
    suno_styles = spec.get("suno_styles", "").strip()
    if suno_styles:
        console.print(Panel(
            f"[bold yellow]{suno_styles}[/bold yellow]\n\n"
            f"[dim]📁 Saved to: [bold]{(project_dir / 'styles.txt')}[/bold][/dim]",
            title="🎵 Suno AI Style Prompt (Copy & Paste to Suno)",
            border_style="yellow",
            box=box.ROUNDED,
        ))

    # Display Production Metadata & Lyrics Preview
    title_text = spec.get("title", concept)
    hashtags_text = spec.get("hashtags", "")
    console.print(Panel(
        f"[bold cyan]Title:[/bold cyan] {title_text}\n\n"
        f"[bold cyan]Lyrics Preview:[/bold cyan]\n"
        f"{spec['lyrics'][:450]}…\n\n"
        f"[bold cyan]Hashtags:[/bold cyan] {hashtags_text}\n\n"
        f"[dim]📁 Complete metadata, story & lyrics saved to: [bold]{(project_dir / 'Data.txt')}[/bold][/dim]",
        title="📝 Production Metadata & Social Data",
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

        def _on_change_image_model() -> None:
            nonlocal gemini_image_model
            if provider_name == "gemini":
                gemini_image_model = pick_gemini_image_model(
                    get_key("GEMINI_API_KEY"), current_model=gemini_image_model
                )
                cp.save_meta(gemini_image_model=gemini_image_model)
                console.print(f"[green]✔ Switched Gemini image model to:[/green] [bold]{gemini_image_model}[/bold]")

        _execute_with_retry(
            "IMAGE_GENERATED",
            cp,
            _generate_image_action,
            on_change_model=_on_change_image_model if provider_name == "gemini" else None,
        )
    else:
        console.print(f"[dim]↩ Background image already created: [bold]{bg_img_path.name}[/bold][/dim]")

    # 6 ── Step: Assets saved confirmation ──────────────────────────────────
    if not cp.is_done("ASSETS_SAVED"):
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

    # 8 ── Step: Render video (with interactive customization) ──────────────
    if not cp.is_done("VIDEO_RENDERED"):
        # Interactive customization for waveform style, color palette, shake & pulse
        custom_render_spec = _configure_visualizer_interactive(
            project_dir, spec.get("render_spec", {})
        )

        console.rule("[bold magenta]Video Rendering Pipeline[/bold magenta]")

        def _render_action() -> tuple[Path, Path]:
            v16x9, v9x16 = render(project_dir, custom_render_spec=custom_render_spec)
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
        console.print(f"[dim]↩ Loaded existing video files: {out_16x9.name}, {out_9x16.name}[/dim]")

    # ── Interactive Post-Render Loop & Re-generation Menu ─────────────────
    while True:
        console.print()
        console.print(Panel(
            f"[green bold]✅ Project Assets & Videos Ready![/green bold]\n\n"
            f"  📺 Landscape : [cyan]{out_16x9}[/cyan]\n"
            f"  📱 Portrait  : [cyan]{out_9x16}[/cyan]\n\n"
            f"  📁 Project   : [cyan]{project_dir}[/cyan]\n"
            f"  🎵 Suno Style: [cyan]{project_dir / 'styles.txt'}[/cyan]\n"
            f"  📝 Socials   : [cyan]{project_dir / 'Data.txt'}[/cyan]",
            title="🎬 Render Complete",
            border_style="green",
            box=box.DOUBLE,
        ))

        action_choice = inquirer.select(
            message="What would you like to do next?",
            choices=[
                {
                    "name": "🚪 Complete & Exit (Keep current video)",
                    "value": "exit",
                },
                {
                    "name": "🎬 Re-render video (Tweak waveform, palette, camera shake) [⚡ 0 Tokens — Local & Free]",
                    "value": "rerender_video",
                },
                {
                    "name": "🖼️ Regenerate background image & re-render video [🎨 ~1,290 image tokens / 1 image call]",
                    "value": "regen_image",
                },
            ],
            default="exit",
        ).execute()

        if action_choice == "exit":
            break

        if action_choice == "rerender_video":
            console.print("\n[cyan]ℹ️  Re-rendering video locally using OpenCV and FFmpeg (AMF GPU/CPU).[/cyan]")
            console.print("[dim]Token consumption: 0 tokens (No API requests).[/dim]\n")
            custom_render_spec = _configure_visualizer_interactive(
                project_dir, spec.get("render_spec", {})
            )
            console.rule("[bold magenta]Video Re-rendering Pipeline[/bold magenta]")

            def _rerender_action() -> tuple[Path, Path]:
                v16x9, v9x16 = render(project_dir, custom_render_spec=custom_render_spec)
                cp.mark_done(
                    "VIDEO_RENDERED",
                    {"out_16x9": str(v16x9), "out_9x16": str(v9x16)},
                )
                return v16x9, v9x16

            out_16x9, out_9x16 = _execute_with_retry("VIDEO_RENDERED", cp, _rerender_action)
            console.print("\n[green bold]✔ Video successfully re-rendered![/green bold]\n")

        elif action_choice == "regen_image":
            console.print()
            console.print(Panel(
                f"[bold yellow]Estimated Token / API Consumption:[/bold yellow]\n"
                f"  • Gemini (Imagen 3)      : [bold]~1,290 tokens[/bold] per generated image\n"
                f"  • Anthropic (DALL-E 3)   : [bold]1 image generation call[/bold] (~$0.04 - $0.08, 0 text tokens)\n"
                f"  • Video rendering        : [bold green]0 tokens[/bold green] (100% local processing)\n",
                title="🎨 Token Estimate: Regenerate Background Image",
                border_style="yellow",
            ))

            current_prompt = spec.get("image_prompt", "")
            img_choice = inquirer.select(
                message="How would you like to generate the new image?",
                choices=[
                    {"name": f"✨ Use current prompt: \"{current_prompt[:50]}…\"", "value": "same"},
                    {"name": "✏️ Edit the image prompt before generating", "value": "edit"},
                    {"name": "🔙 Cancel (Go back)", "value": "cancel"},
                ],
                default="same",
            ).execute()

            if img_choice == "cancel":
                continue

            if img_choice == "edit":
                current_prompt = inquirer.text(
                    message="Edit image prompt:",
                    default=current_prompt,
                    validate=lambda v: len(v.strip()) > 0,
                    invalid_message="Prompt cannot be empty.",
                ).execute()
                spec["image_prompt"] = current_prompt
                save_spec(project_dir, spec)

            def _regen_img_action() -> bytes:
                with console.status("[bold green]Regenerating background image…[/bold green]"):
                    prov = _get_provider()
                    img_bytes = prov.generate_image(current_prompt)
                    save_background(project_dir, img_bytes)
                    cp.mark_done("IMAGE_GENERATED", {"path": str(bg_img_path)})
                    return img_bytes

            _execute_with_retry(
                "IMAGE_GENERATED",
                cp,
                _regen_img_action,
                on_change_model=_on_change_image_model if provider_name == "gemini" else None,
            )
            console.print(f"[green]✔ New background image saved: [bold]{bg_img_path.name}[/bold][/green]\n")

            # Now re-configure and re-render video
            custom_render_spec = _configure_visualizer_interactive(
                project_dir, spec.get("render_spec", {})
            )
            console.rule("[bold magenta]Video Re-rendering Pipeline[/bold magenta]")

            def _rerender_after_img_action() -> tuple[Path, Path]:
                v16x9, v9x16 = render(project_dir, custom_render_spec=custom_render_spec)
                cp.mark_done(
                    "VIDEO_RENDERED",
                    {"out_16x9": str(v16x9), "out_9x16": str(v9x16)},
                )
                return v16x9, v9x16

            out_16x9, out_9x16 = _execute_with_retry("VIDEO_RENDERED", cp, _rerender_after_img_action)
            console.print("\n[green bold]✔ Video re-rendered with new background art![/green bold]\n")

    # ── Done! ──────────────────────────────────────────────────────────────
    cp.close()


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
