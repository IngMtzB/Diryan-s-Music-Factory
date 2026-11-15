"""
server/routers/playlists.py — Endpoints for playlist organization.
"""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from server.services.project_scanner import (
    create_playlist,
    delete_playlist,
    move_project,
    rename_playlist,
    scan_all_projects,
)

router = APIRouter(prefix="/api/playlists", tags=["Playlists"])


class CreatePlaylistRequest(BaseModel):
    name: str


class RenamePlaylistRequest(BaseModel):
    new_name: str


class MoveProjectRequest(BaseModel):
    rel_path: str
    target_playlist: Optional[str] = None


@router.get("")
def get_playlists():
    """List all playlists and project statistics."""
    projects, playlists = scan_all_projects()
    unclassified_count = sum(1 for p in projects if not p["playlist"])
    return {
        "playlists": playlists,
        "unclassified_count": unclassified_count,
        "total_projects": len(projects),
    }


@router.post("")
def add_playlist(req: CreatePlaylistRequest):
    """Create a new playlist directory."""
    try:
        created = create_playlist(req.name)
        return {"success": True, "playlist": created}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/{name}")
def update_playlist_name(name: str, req: RenamePlaylistRequest):
    """Rename an existing playlist."""
    try:
        updated = rename_playlist(name, req.new_name)
        return {"success": True, "playlist": updated}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/{name}")
def remove_playlist(name: str):
    """
    Delete playlist folder.
    Moves all song projects inside to projects/ root to preserve songs!
    """
    try:
        delete_playlist(name)
        return {"success": True}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))



@router.post("/move")
def move_song_project(req: MoveProjectRequest):
    """Move a song project into a playlist or back to unclassified root."""
    try:
        new_path = move_project(req.rel_path, req.target_playlist)
        return {"success": True, "rel_path": new_path}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

