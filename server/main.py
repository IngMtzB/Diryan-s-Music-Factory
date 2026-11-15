"""
server/main.py — FastAPI application entrypoint for Diryan's Music Factory Web Studio.
"""

from __future__ import annotations

import sys
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

# Ensure project root is on sys.path
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from server.routers import generate, media, playlists, projects, render


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Register active event loop with JobManager and handle Windows proactor socket aborts
    try:
        loop = asyncio.get_running_loop()
        from server.services.render_job import JobManager
        JobManager.get_instance().set_default_loop(loop)

        default_handler = loop.get_exception_handler()

        def _loop_exception_handler(current_loop, context):
            exc = context.get("exception")
            msg = context.get("message", "")
            if isinstance(exc, (ConnectionResetError, OSError)) or "call_connection_lost" in msg:
                return
            if default_handler:
                default_handler(current_loop, context)
            else:
                current_loop.default_exception_handler(context)

        loop.set_exception_handler(_loop_exception_handler)
    except Exception:
        pass
    yield


app = FastAPI(
    title="Diryan's Music Factory Web Studio",
    description="Studio web interactivo para producción y renderizado de videos musicales con IA.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for local development (e.g. Vite dev server on port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(playlists.router)
app.include_router(projects.router)
app.include_router(generate.router)
app.include_router(media.router)
app.include_router(render.router)

# Mount waveform snapshot examples
waveforms_dir = _ROOT / "docs" / "image" / "examples"
if waveforms_dir.exists():
    app.mount("/waveforms", StaticFiles(directory=str(waveforms_dir)), name="waveforms")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "Diryan's Music Factory Web Studio"}


# Mount frontend dist if exists
frontend_dist = _ROOT / "frontend" / "dist"
if frontend_dist.exists() and frontend_dist.is_dir():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")

