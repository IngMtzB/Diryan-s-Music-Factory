#!/usr/bin/env python3
"""
run_web.py — Launch script for Diryan's Music Factory Web Studio.
Starts the FastAPI backend and opens the web application in your default browser.
"""

import os
import sys
import time
import webbrowser
from pathlib import Path
import uvicorn

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

PORT = 8000
HOST = "127.0.0.1"
URL = f"http://{HOST}:{PORT}"


def main():
    print("=" * 60)
    print("  🎶  Diryan's Music Factory — Web Studio")
    print(f"  🌐  Iniciando servidor en: {URL}")
    print("=" * 60)

    # Launch browser after slight delay
    def open_browser():
        time.sleep(1.2)
        print(f"\n🚀 Abriendo navegador en {URL} ...\n")
        webbrowser.open(URL)

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    # Start FastAPI server
    uvicorn.run("server.main:app", host=HOST, port=PORT, reload=False)


if __name__ == "__main__":
    main()

