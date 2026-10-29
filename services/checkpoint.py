"""
services/checkpoint.py — SQLite-backed pipeline checkpoint manager.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from config import PROJECTS_DIR

STEPS = [
    "SESSION_INIT",
    "SPEC_GENERATED",
    "IMAGE_GENERATED",
    "ASSETS_SAVED",
    "AUDIO_READY",
    "VIDEO_RENDERED",
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class CheckpointManager:
    """Manages pipeline execution state inside a project's SQLite database."""

    def __init__(self, project_dir: Path) -> None:
        self.project_dir = Path(project_dir)
        self._db = self.project_dir / "session.db"
        self._conn = sqlite3.connect(str(self._db))
        self._conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS checkpoints (
                step       TEXT PRIMARY KEY,
                status     TEXT NOT NULL,
                data       TEXT,
                error      TEXT,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS session (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """
        )
        self._conn.commit()

    # ── Session metadata ───────────────────────────────────────────────────

    def save_meta(self, **kwargs: str | None) -> None:
        """Persist key=value session metadata (provider, concept, style, etc.)."""
        items = [(k, str(v) if v is not None else "") for k, v in kwargs.items()]
        self._conn.executemany(
            "INSERT OR REPLACE INTO session(key, value) VALUES (?, ?)",
            items,
        )
        self._conn.commit()

    def load_meta(self) -> dict[str, str]:
        """Load all session metadata key-value pairs."""
        rows = self._conn.execute("SELECT key, value FROM session").fetchall()
        return {r["key"]: r["value"] for r in rows}

    # ── Step management ────────────────────────────────────────────────────

    def is_done(self, step: str) -> bool:
        """Return True if step has already succeeded."""
        row = self._conn.execute(
            "SELECT status FROM checkpoints WHERE step=?", (step,)
        ).fetchone()
        return row is not None and row["status"] == "done"

    def mark_done(self, step: str, data: Any = None) -> None:
        """Record step success and optional output payload."""
        payload = json.dumps(data) if data is not None else None
        self._conn.execute(
            """
            INSERT OR REPLACE INTO checkpoints(step, status, data, error, updated_at)
            VALUES (?, 'done', ?, NULL, ?)
            """,
            (step, payload, _now()),
        )
        self._conn.commit()

    def mark_failed(self, step: str, error: str) -> None:
        """Record step failure with error message."""
        self._conn.execute(
            """
            INSERT OR REPLACE INTO checkpoints(step, status, data, error, updated_at)
            VALUES (?, 'failed', NULL, ?, ?)
            """,
            (step, error, _now()),
        )
        self._conn.commit()

    def load_data(self, step: str) -> Any:
        """Return deserialized data payload for a step."""
        row = self._conn.execute(
            "SELECT data FROM checkpoints WHERE step=?", (step,)
        ).fetchone()
        if row and row["data"]:
            return json.loads(row["data"])
        return None

    def first_incomplete(self) -> str:
        """Return the first step in sequence that is not marked 'done'."""
        done_steps = {
            r["step"]
            for r in self._conn.execute(
                "SELECT step FROM checkpoints WHERE status='done'"
            ).fetchall()
        }
        for step in STEPS:
            if step not in done_steps:
                return step
        return "VIDEO_RENDERED"

    def get_progress_summary(self) -> str:
        """Return a human-readable summary of completed steps."""
        done = {
            r["step"]
            for r in self._conn.execute(
                "SELECT step FROM checkpoints WHERE status='done'"
            ).fetchall()
        }
        parts = []
        for step in STEPS:
            icon = "✔" if step in done else "○"
            parts.append(f"{icon} {step}")
        return " → ".join(parts)

    def close(self) -> None:
        """Close SQLite connection."""
        self._conn.close()


def find_resumable_sessions() -> list[dict[str, Any]]:
    """
    Search PROJECTS_DIR for existing session.db files that are not fully completed.
    Returns a list of dicts with project directory, metadata, and next step.
    """
    if not PROJECTS_DIR.exists():
        return []

    resumable = []
    for db_path in PROJECTS_DIR.glob("*/session.db"):
        project_dir = db_path.parent
        try:
            cp = CheckpointManager(project_dir)
            first = cp.first_incomplete()
            if not cp.is_done("VIDEO_RENDERED"):
                meta = cp.load_meta()
                resumable.append({
                    "project_dir": project_dir,
                    "name": project_dir.name,
                    "next_step": first,
                    "concept": meta.get("concept", project_dir.name),
                    "provider": meta.get("provider", "unknown"),
                    "checkpoint_manager": cp,
                })
            else:
                cp.close()
        except Exception:
            continue

    return resumable

