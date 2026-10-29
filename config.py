"""
config.py — Environment & API-key management for Diryan's Factory Music.

Loads keys from .env, validates them for the chosen provider, and prompts
the user interactively when keys are missing.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

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

# Model identifiers
GEMINI_TEXT_MODEL = "gemini-2.5-flash"
GEMINI_IMAGE_MODEL = "imagen-3.0-generate-002"
ANTHROPIC_TEXT_MODEL = "claude-3-5-sonnet-20241022"
DALLE_MODEL = "dall-e-3"

console = Console()


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

