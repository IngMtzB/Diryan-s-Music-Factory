"""
server/routers/render.py — Video rendering triggers and real-time SSE progress streaming.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from server.services.project_scanner import get_safe_project_dir
from server.services.render_job import JobManager
from services.project_manager import _slugify
from video.renderer import (
    find_project_audio,
    find_project_video_16x9,
    find_project_video_9x16,
)

router = APIRouter(prefix="/api/render", tags=["Render"])


class RenderRequest(BaseModel):
    custom_spec: dict[str, Any] = {}
    render_16x9: bool = True
    render_9x16: bool = False
    name_mode: str = "title"  # "title" or "default"


@router.post("/{path:path}/crop-9x16")
async def trigger_crop_9x16(path: str):
    """
    On-demand fast generation of vertical 9:16 video from existing 16:9 video in seconds.
    """
    project_dir = get_safe_project_dir(path)
    source_16x9 = find_project_video_16x9(project_dir)
    if not source_16x9 or not source_16x9.exists():
        raise HTTPException(status_code=400, detail="Cannot crop 9:16: no 16:9 video found in project.")

    # Determine 9:16 filename matching 16:9 naming
    if "16x9" in source_16x9.name:
        out_9x16_name = source_16x9.name.replace("16x9", "9x16")
    else:
        out_9x16_name = f"{source_16x9.stem}_9x16.mp4"

    out_9x16 = project_dir / out_9x16_name

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    job_mgr = JobManager.get_instance()
    job = job_mgr.start_crop_job(
        input_16x9=source_16x9,
        output_9x16=out_9x16,
        loop=loop,
    )

    return {"job_id": job.job_id, "status": job.status}


@router.post("/{path:path}")
async def trigger_render(path: str, req: RenderRequest = RenderRequest()):
    """
    Start background rendering of 16:9 and optionally 9:16 music videos.
    Returns job_id for SSE progress tracking.
    """
    project_dir = get_safe_project_dir(path)
    audio_path = find_project_audio(project_dir)
    if not audio_path or not audio_path.exists():
        raise HTTPException(status_code=400, detail="No audio file found in project.")

    # Determine video filenames
    title = project_dir.name
    spec_path = project_dir / "01_styles.json"
    if spec_path.exists():
        try:
            s_data = json.loads(spec_path.read_text(encoding="utf-8"))
            if s_data.get("title"):
                title = s_data["title"]
        except Exception:
            pass

    slug = _slugify(title, max_len=60)
    if req.name_mode == "title":
        out_16x9 = project_dir / f"{slug}_16x9.mp4"
        out_9x16 = project_dir / f"{slug}_9x16.mp4"
    else:
        out_16x9 = project_dir / "04_video_16x9.mp4"
        out_9x16 = project_dir / "04_video_9x16.mp4"

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    job_mgr = JobManager.get_instance()
    job = job_mgr.start_render_job(
        project_dir=project_dir,
        custom_spec=req.custom_spec,
        render_16x9=req.render_16x9,
        render_9x16=req.render_9x16,
        audio_path=audio_path,
        out_16x9=out_16x9,
        out_9x16=out_9x16,
        loop=loop,
    )

    return {"job_id": job.job_id, "status": job.status}


@router.get("/status/{job_id}")
def get_job_status(job_id: str):
    """Poll job status directly."""
    job = JobManager.get_instance().get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.to_dict()


@router.get("/stream/{job_id}")
async def stream_job_progress(job_id: str, request: Request):
    """Server-Sent Events (SSE) stream for real-time progress bar and log updates."""
    job = JobManager.get_instance().get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    q = job.add_subscriber()

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(q.get(), timeout=20.0)
                    yield {
                        "event": "progress",
                        "data": json.dumps(data),
                    }
                    if data["status"] in ("completed", "failed"):
                        break
                except asyncio.TimeoutError:
                    # Keep-alive ping
                    yield {"event": "ping", "data": "{}"}
        finally:
            job.remove_subscriber(q)

    return EventSourceResponse(event_generator())

