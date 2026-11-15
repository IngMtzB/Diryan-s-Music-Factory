"""
server/services/render_job.py — Manages background video rendering jobs
and distributes live SSE progress events to clients.
"""

from __future__ import annotations

import asyncio
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from video.renderer import centre_crop_9x16, render


class RenderJob:
    def __init__(self, job_id: str, project_dir: Path, custom_spec: dict[str, Any], render_16x9: bool, render_9x16: bool, audio_path: Path | None = None, out_16x9: Path | None = None, out_9x16: Path | None = None):
        self.job_id = job_id
        self.project_dir = project_dir
        self.custom_spec = custom_spec
        self.render_16x9 = render_16x9
        self.render_9x16 = render_9x16
        self.audio_path = audio_path
        self.out_16x9 = out_16x9
        self.out_9x16 = out_9x16

        self.status = "queued"  # queued, running, completed, failed
        self.percent = 0.0
        self.current_frame = 0
        self.total_frames = 0
        self.fps = 30.0
        self.message = "En cola..."
        self.error: str | None = None
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.finished_at: str | None = None

        self._subscribers: list[asyncio.Queue] = []
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def add_subscriber(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.append(q)
        # Push current state immediately
        q.put_nowait(self.to_dict())
        return q

    def remove_subscriber(self, q: asyncio.Queue) -> None:
        if q in self._subscribers:
            self._subscribers.remove(q)

    def _broadcast(self) -> None:
        payload = self.to_dict()
        for q in list(self._subscribers):
            try:
                if self._loop and not self._loop.is_closed():
                    self._loop.call_soon_threadsafe(q.put_nowait, payload)
                else:
                    q.put_nowait(payload)
            except Exception:
                pass

    def update_progress(self, percent: float, current_frame: int, total_frames: int, fps: float, message: str) -> None:
        self.status = "running"
        self.percent = percent
        self.current_frame = current_frame
        self.total_frames = total_frames
        self.fps = fps
        self.message = message
        self._broadcast()

    def mark_completed(self, message: str = "¡Renderizado completado con éxito!") -> None:
        self.status = "completed"
        self.percent = 100.0
        self.message = message
        self.finished_at = datetime.now(timezone.utc).isoformat()
        self._broadcast()

    def mark_failed(self, error: str) -> None:
        self.status = "failed"
        self.error = error
        self.message = f"Error: {error}"
        self.finished_at = datetime.now(timezone.utc).isoformat()
        self._broadcast()

    def to_dict(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "status": self.status,
            "percent": self.percent,
            "current_frame": self.current_frame,
            "total_frames": self.total_frames,
            "fps": self.fps,
            "message": self.message,
            "error": self.error,
            "created_at": self.created_at,
            "finished_at": self.finished_at,
        }


class JobManager:
    _instance: JobManager | None = None

    def __init__(self) -> None:
        self._jobs: dict[str, RenderJob] = {}
        self._lock = threading.Lock()
        self._default_loop: asyncio.AbstractEventLoop | None = None

    def set_default_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._default_loop = loop

    @classmethod
    def get_instance(cls) -> JobManager:
        if cls._instance is None:
            cls._instance = JobManager()
        return cls._instance

    def get_job(self, job_id: str) -> RenderJob | None:
        with self._lock:
            return self._jobs.get(job_id)

    def start_render_job(
        self,
        project_dir: Path,
        custom_spec: dict[str, Any],
        render_16x9: bool = True,
        render_9x16: bool = False,
        audio_path: Path | None = None,
        out_16x9: Path | None = None,
        out_9x16: Path | None = None,
        loop: asyncio.AbstractEventLoop | None = None,
    ) -> RenderJob:
        job_id = str(uuid.uuid4())
        job = RenderJob(
            job_id=job_id,
            project_dir=project_dir,
            custom_spec=custom_spec,
            render_16x9=render_16x9,
            render_9x16=render_9x16,
            audio_path=audio_path,
            out_16x9=out_16x9,
            out_9x16=out_9x16,
        )
        target_loop = loop or self._default_loop
        if not target_loop:
            try:
                target_loop = asyncio.get_running_loop()
            except RuntimeError:
                pass
        if target_loop:
            job.set_loop(target_loop)

        with self._lock:
            self._jobs[job_id] = job

        # Run in separate daemon thread so it doesn't block FastAPI
        thread = threading.Thread(target=self._run_job_worker, args=(job,), daemon=True)
        thread.start()
        return job

    def start_crop_job(
        self,
        input_16x9: Path,
        output_9x16: Path,
        loop: asyncio.AbstractEventLoop | None = None,
    ) -> RenderJob:
        job_id = str(uuid.uuid4())
        job = RenderJob(
            job_id=job_id,
            project_dir=input_16x9.parent,
            custom_spec={},
            render_16x9=False,
            render_9x16=True,
            out_9x16=output_9x16,
        )
        target_loop = loop or self._default_loop
        if not target_loop:
            try:
                target_loop = asyncio.get_running_loop()
            except RuntimeError:
                pass
        if target_loop:
            job.set_loop(target_loop)

        with self._lock:
            self._jobs[job_id] = job

        def _worker() -> None:
            job.status = "running"
            job.update_progress(10.0, 0, 100, 30.0, "Iniciando recorte vertical 9:16...")
            try:
                centre_crop_9x16(input_16x9, output_9x16)
                job.mark_completed("¡Video vertical 9:16 generado con éxito!")
            except Exception as e:
                job.mark_failed(str(e))

        thread = threading.Thread(target=_worker, daemon=True)
        thread.start()
        return job

    def _run_job_worker(self, job: RenderJob) -> None:
        job.status = "running"
        job.update_progress(1.0, 0, 100, 30.0, "Preparando recursos y análisis de audio...")

        def _callback(percent: float, current_frame: int, total_frames: int, fps: float, message: str) -> None:
            job.update_progress(percent, current_frame, total_frames, fps, message)

        try:
            render(
                project_dir=job.project_dir,
                custom_render_spec=job.custom_spec,
                audio_path=job.audio_path,
                output_16x9_path=job.out_16x9,
                output_9x16_path=job.out_9x16,
                render_16x9=job.render_16x9,
                render_9x16=job.render_9x16,
                progress_callback=_callback,
            )

            # Update checkpoint if exists
            try:
                from services.checkpoint import CheckpointManager
                cp = CheckpointManager(job.project_dir)
                cp.mark_done("VIDEO_RENDERED", {
                    "out_16x9": str(job.out_16x9) if job.out_16x9 else None,
                    "out_9x16": str(job.out_9x16) if job.out_9x16 else None,
                })
                cp.close()
            except Exception:
                pass

            job.mark_completed()
        except Exception as exc:
            job.mark_failed(str(exc))

