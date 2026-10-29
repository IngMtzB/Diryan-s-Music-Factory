"""
config.py — Environment & API-key management for Diryan's Factory Music.

Loads keys from .env, validates them for the chosen provider, and prompts
the user interactively when keys are missing.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows consoles to prevent UnicodeEncodeError
if sys.stdout is not None and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr is not None and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from dotenv import load_dotenv, set_key
from InquirerPy import inquirer
from rich.console import Console
from rich.panel import Panel

# ── Constants ──────────────────────────────────────────────────────────────────

ROOT_DIR = Path(__file__).resolve().parent
ENV_PATH = ROOT_DIR / ".env"
PROJECTS_DIR = ROOT_DIR / "projects"
RULES_DIR = ROOT_DIR / "rules"

PROVIDER_KEYS: dict[str, list[str]] = {
    "gemini": ["GEMINI_API_KEY"],
    "anthropic": ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"],
}

# Static fallback model identifiers (used when dynamic listing is skipped)
GEMINI_TEXT_MODEL = "gemini-flash-latest"
GEMINI_IMAGE_MODEL = "gemini-flash-image-generation"
ANTHROPIC_TEXT_MODEL = "claude-3-5-sonnet-20241022"
DALLE_MODEL = "dall-e-3"

console = Console()

# ── Gemini model discovery ─────────────────────────────────────────────────────

# Keywords that identify image-generation–capable models vs. text-generation.
# The Gemini model list uses `supported_actions` or model-name conventions;
# we rely on name-based heuristics since the API does not expose a stable
# capability field in the Developer tier.
_IMAGE_MODEL_KEYWORDS = ("image", "imagen", "img")
_TEXT_SKIP_KEYWORDS = (
    "embed",
    "aqa",
    "tts",
    "speech",
    "vision-only",
    "audio",
    "native-audio",
    "live",
    "bidi",
    "realtime",
)


def fetch_gemini_models(api_key: str) -> tuple[list[str], list[str]]:
    """
    Query the live Gemini model list and split into text and image buckets.

    Returns:
        (text_models, image_models) — each a list of model name strings,
        sorted alphabetically with stable/latest aliases first.
    """
    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        all_models: list[str] = []
        for m in client.models.list():
            name: str = m.name  # e.g. "models/gemini-flash-latest"
            # Strip the "models/" prefix for display / usage
            short = name.removeprefix("models/")
            all_models.append(short)
    except Exception as exc:
        console.print(f"[yellow]⚠  Could not fetch model list: {exc}[/yellow]")
        return [], []

    text_models: list[str] = []
    image_models: list[str] = []

    for name in sorted(all_models):
        lower = name.lower()
        if any(kw in lower for kw in _TEXT_SKIP_KEYWORDS):
            continue
        if any(kw in lower for kw in _IMAGE_MODEL_KEYWORDS):
            image_models.append(name)
        else:
            text_models.append(name)

    # Put "latest" aliases at the top for each bucket
    def _sort_key(n: str) -> tuple[int, str]:
        return (0 if "latest" in n else 1, n)

    text_models.sort(key=_sort_key)
    image_models.sort(key=_sort_key)
    return text_models, image_models


def pick_gemini_text_model(api_key: str, current_model: str | None = None) -> str:
    """Interactively select a Gemini text generation model."""
    text_models, _ = fetch_gemini_models(api_key)
    if not text_models:
        console.print(
            f"[yellow]No text models found — using default: {GEMINI_TEXT_MODEL}[/yellow]"
        )
        return GEMINI_TEXT_MODEL

    default_choice = current_model if (current_model and current_model in text_models) else next(
        (m for m in text_models if "flash-latest" in m or "flash" in m),
        text_models[0],
    )
    return inquirer.select(
        message="Select Gemini text model:",
        choices=text_models,
        default=default_choice,
    ).execute()


def pick_gemini_image_model(api_key: str, current_model: str | None = None) -> str:
    """Interactively select a Gemini image generation model."""
    _, image_models = fetch_gemini_models(api_key)
    if not image_models:
        console.print(
            f"[yellow]No image models found — using default: {GEMINI_IMAGE_MODEL}[/yellow]"
        )
        return GEMINI_IMAGE_MODEL

    default_choice = current_model if (current_model and current_model in image_models) else next(
        (m for m in image_models if "flash" in m),
        image_models[0],
    )
    return inquirer.select(
        message="Select Gemini image model:",
        choices=image_models,
        default=default_choice,
    ).execute()


def pick_gemini_models(api_key: str) -> tuple[str, str]:
    """
    Interactively ask the user to choose a Gemini text model and image model
    from the live model list. Falls back to the static defaults if the list
    is empty.

    Returns:
        (text_model, image_model)
    """
    text_model = pick_gemini_text_model(api_key)
    image_model = pick_gemini_image_model(api_key)
    return text_model, image_model


# ── Key helpers ────────────────────────────────────────────────────────────────

def _load_env() -> None:
    """Ensure .env exists and load it into the environment."""
    ENV_PATH.touch(exist_ok=True)
    load_dotenv(ENV_PATH, override=True)


def _prompt_for_key(key_name: str) -> str | None:
    """Prompt the user to enter a single API key via a masked input."""
    console.print(
        f"\n[yellow]⚠  {key_name} is not set in your environment or .env file.[/yellow]"
    )
    try:
        value: str = inquirer.secret(
            message=f"Paste your {key_name}:",
            transformer=lambda _: "••••••••",
        ).execute()
    except (KeyboardInterrupt, EOFError):
        return None

    if not value or not value.strip():
        return None
    return value.strip()


# ── Public API ─────────────────────────────────────────────────────────────────

def validate_and_prompt_keys(provider: str) -> bool:
    """
    Ensure every API key required by *provider* is available.

    1. Loads .env and checks the environment.
    2. For each missing key, prompts the user interactively.
    3. Persists newly entered keys to .env.
    4. Returns True on success; on failure prints an error panel and returns False.
    """
    _load_env()

    required = PROVIDER_KEYS.get(provider)
    if required is None:
        console.print(Panel(
            f"[red]Unknown provider '{provider}'. Choose 'gemini' or 'anthropic'.[/red]",
            title="❌ Invalid Provider",
            border_style="red",
        ))
        return False

    all_ok = True
    for key_name in required:
        value = os.environ.get(key_name, "").strip()
        if value:
            continue  # already set

        entered = _prompt_for_key(key_name)
        if entered is None:
            console.print(Panel(
                f"[red]{key_name} is required for the [b]{provider}[/b] provider. "
                f"Cannot continue without it.[/red]",
                title="❌ Missing API Key",
                border_style="red",
            ))
            all_ok = False
            break

        # Persist to .env and current process environment
        set_key(str(ENV_PATH), key_name, entered)
        os.environ[key_name] = entered
        console.print(f"[green]✔  {key_name} saved to .env[/green]")

    return all_ok


def get_key(key_name: str) -> str:
    """Return an API key from the environment, raising if absent."""
    _load_env()
    value = os.environ.get(key_name, "").strip()
    if not value:
        raise EnvironmentError(f"{key_name} is not set. Run key validation first.")
    return value

