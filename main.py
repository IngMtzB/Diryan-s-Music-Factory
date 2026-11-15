#!/usr/bin/env python3
"""
main.py — Entrypoint for Diryan's Music Factory.

La creación y gestión de proyectos musicales ahora se realiza exclusivamente
a través del Web Studio interactivo con interfaz gráfica en el navegador.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if sys.stdout is not None and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr is not None and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Ensure package root is on sys.path
_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from rich.console import Console
from rich.panel import Panel
from rich.text import Text

import run_web

console = Console()

_BANNER = r"""
    ╔══════════════════════════════════════════════════╗
    ║                                                  ║
    ║     🎶  Diryan's Factory Music Web Studio  🎶    ║
    ║     ─── AI-Driven Music Video Generator ───      ║
    ║                                                  ║
    ╚══════════════════════════════════════════════════╝
"""


def main() -> None:
    console.print(Text(_BANNER, style="bold cyan"))
    console.print(Panel(
        "[bold green]✔ Web Studio Activo[/bold green]\n\n"
        "La creación y gestión de canciones ahora se realiza a través de la interfaz web:\n"
        f"  🌐 [bold cyan]http://127.0.0.1:8000[/bold cyan]\n\n"
        "[dim]Abriendo navegador automáticamente... Presiona Ctrl+C en esta terminal para detener.[/dim]",
        title="Diryan's Music Factory",
        border_style="cyan",
    ))
    run_web.main()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[yellow]Servidor detenido por el usuario.[/yellow]")
        sys.exit(0)
