"""
server/routers/media.py — Streaming media files (Audio, Images, Videos)
with range-request support for HTML5 players.
"""

from __future__ import annotations

import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from server.services.project_scanner import get_safe_project_dir
from video.renderer import (
    find_project_audio,
    find_project_video_16x9,
    find_project_video_9x16,
)

router = APIRouter(prefix="/api/media", tags=["Media"])


@router.get("/{path:path}/audio")
def get_audio(path: str):
    """Stream song audio file with native HTTP 206 Range support."""
    project_dir = get_safe_project_dir(path)
    audio_path = find_project_audio(project_dir)
    if not audio_path or not audio_path.exists():
        raise HTTPException(status_code=404, detail="No audio file found in project.")

    ext = audio_path.suffix.lower()
    media_type = "audio/mpeg" if ext == ".mp3" else "audio/wav" if ext == ".wav" else "audio/mp4"
    return FileResponse(audio_path, media_type=media_type)


@router.get("/{path:path}/image")
def get_image(path: str):
    """Serve background artwork."""
    project_dir = get_safe_project_dir(path)
    bg_path = project_dir / "03_background.png"
    if not bg_path.exists():
        for ext in ("*.png", "*.jpg", "*.jpeg"):
            candidates = list(project_dir.glob(ext))
            if candidates:
                bg_path = candidates[0]
                break

    if not bg_path.exists():
        raise HTTPException(status_code=404, detail="No background image found in project.")

    media_type = "image/png" if bg_path.suffix.lower() == ".png" else "image/jpeg"
    return FileResponse(bg_path, media_type=media_type)


@router.get("/{path:path}/video-16x9")
def get_video_16x9(path: str):
    """Stream 16:9 landscape video with native HTTP 206 Range support."""
    project_dir = get_safe_project_dir(path)
    v_path = find_project_video_16x9(project_dir)
    if not v_path or not v_path.exists():
        raise HTTPException(status_code=404, detail="16:9 video not found.")
    return FileResponse(v_path, media_type="video/mp4")


@router.get("/{path:path}/video-9x16")
def get_video_9x16(path: str):
    """Stream 9:16 portrait video with native HTTP 206 Range support."""
    project_dir = get_safe_project_dir(path)
    v_path = find_project_video_9x16(project_dir)
    if not v_path or not v_path.exists():
        raise HTTPException(status_code=404, detail="9:16 video not found.")
    return FileResponse(v_path, media_type="video/mp4")

