"""
server/routers/projects.py — Endpoints for Project CRUD, asset editing, file uploads,
and palette sampling.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from PIL import Image
from pydantic import BaseModel

from config import PROJECTS_DIR
from server.services.project_scanner import (
    delete_project,
    get_safe_project_dir,
    load_studio_catalog,
    register_genre_tags,
    save_studio_catalog,
    scan_all_projects,
    scan_project_details,
)
from services.checkpoint import CheckpointManager
from services.project_manager import _slugify
from video.renderer import (
    extract_palette_from_image,
    find_project_audio,
    find_project_video_16x9,
    find_project_video_9x16,
)

router = APIRouter(prefix="/api/projects", tags=["Projects"])


class CreateProjectRequest(BaseModel):
    concept: str
    style: str = "Electro corrido tumbado"
    playlist: Optional[str] = None
    provider: str = "gemini"
    genre_tags: Optional[list[str]] = None


class UpdateSpecRequest(BaseModel):
    title: Optional[str] = None
    concept: Optional[str] = None
    style: Optional[str] = None
    provider: Optional[str] = None
    suno_styles: Optional[str] = None
    image_prompt: Optional[str] = None
    render_spec: Optional[dict[str, Any]] = None
    genre_tags: Optional[list[str]] = None


from video.styles import get_default_waveform_presets


class CatalogUpdateRequest(BaseModel):
    genre_tags: Optional[list[str]] = None
    creation_categories: Optional[list[dict[str, Any]]] = None
    creation_genres: Optional[list[dict[str, Any]]] = None
    waveform_presets: Optional[list[dict[str, Any]]] = None


class TextFileUpdateRequest(BaseModel):
    content: str


@router.get("/catalog")
def get_studio_catalog():
    """Return global studio catalog (reusable genre_tags, creation_genres, and waveform_presets)."""
    return load_studio_catalog()


@router.put("/catalog")
def update_studio_catalog_endpoint(req: CatalogUpdateRequest):
    """Update global studio catalog (genre_tags, creation_categories, creation_genres, waveform_presets)."""
    current = load_studio_catalog()
    if req.genre_tags is not None:
        current["genre_tags"] = req.genre_tags
    if req.creation_categories is not None:
        current["creation_categories"] = req.creation_categories
    if req.creation_genres is not None:
        current["creation_genres"] = req.creation_genres
    if req.waveform_presets is not None:
        current["waveform_presets"] = req.waveform_presets
    saved = save_studio_catalog(current)
    return saved


@router.post("/catalog/reset-waveforms")
def reset_waveform_presets_endpoint():
    """Restore factory default waveform presets in the global catalog."""
    current = load_studio_catalog()
    current["waveform_presets"] = get_default_waveform_presets()
    return save_studio_catalog(current)


@router.get("")
def list_projects(
    playlist: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    genre: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
):
    """List projects with optional filtering by playlist, status, genre tag, or search query."""
    projects, _ = scan_all_projects()

    filtered = projects
    if playlist is not None:
        if playlist.lower() in ("root", "unclassified", "sin clasificar", ""):
            filtered = [p for p in filtered if not p["playlist"]]
        else:
            filtered = [p for p in filtered if p["playlist"] == playlist]

    if status:
        filtered = [p for p in filtered if p["status"].lower() == status.lower()]

    if genre:
        g_lower = genre.strip().lower()
        filtered = [
            p for p in filtered
            if any(g_lower == str(t).lower() for t in (p.get("genre_tags") or []))
        ]

    if q:
        query = q.lower()
        filtered = [
            p for p in filtered
            if query in p["name"].lower()
            or query in p["title"].lower()
            or query in p["concept"].lower()
            or query in (p["playlist"] or "").lower()
            or any(query in str(t).lower() for t in (p.get("genre_tags") or []))
        ]

    return {"projects": filtered, "count": len(filtered)}


@router.post("/create")
def create_new_project(req: CreateProjectRequest):
    """Create a new project folder under PROJECTS_DIR or PROJECTS_DIR/playlist."""
    slug = _slugify(req.concept)

    if req.playlist and req.playlist.strip():
        pl_name = req.playlist.strip().replace("/", "_").replace("\\", "_")
        parent_dir = PROJECTS_DIR / pl_name
        parent_dir.mkdir(parents=True, exist_ok=True)
    else:
        parent_dir = PROJECTS_DIR
        pl_name = None

    project_dir = parent_dir / slug
    counter = 1
    base = project_dir
    while project_dir.exists():
        project_dir = parent_dir / f"{base.name}_{counter}"
        counter += 1

    project_dir.mkdir(parents=True, exist_ok=True)

    clean_tags = [str(t).strip() for t in (req.genre_tags or []) if str(t).strip()]
    if clean_tags:
        register_genre_tags(clean_tags)
        styles_file = project_dir / "01_styles.json"
        styles_file.write_text(
            json.dumps({"title": req.concept, "genre_tags": clean_tags}, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    # Initialize SQLite Checkpoint
    cp = CheckpointManager(project_dir)
    cp.save_meta(
        provider=req.provider,
        concept=req.concept,
        style=req.style,
        title=req.concept,
        genre_tags=clean_tags,
    )
    cp.mark_done("SESSION_INIT")
    cp.close()

    return scan_project_details(project_dir, playlist_name=pl_name)


@router.get("/{path:path}/palette")
def get_extracted_palette(path: str):
    """Extract vibrant color palette from project's background art via k-means."""
    project_dir = get_safe_project_dir(path)
    bg_path = project_dir / "03_background.png"
    if not bg_path.exists():
        for ext in ("*.png", "*.jpg", "*.jpeg"):
            candidates = list(project_dir.glob(ext))
            if candidates:
                bg_path = candidates[0]
                break

    if not bg_path.exists():
        return {"primary": "#00E5FF", "secondary": "#FF2A55"}

    try:
        c1, c2 = extract_palette_from_image(bg_path)
        return {"primary": c1, "secondary": c2}
    except Exception:
        return {"primary": "#00E5FF", "secondary": "#FF2A55"}


@router.get("/{path:path}")
def get_project(path: str):
    """Retrieve full project details, including file contents and rendering specs."""
    project_dir = get_safe_project_dir(path)
    if not project_dir.exists() or not project_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"Project not found: {path}")

    rel = project_dir.relative_to(PROJECTS_DIR)
    playlist_name = rel.parent.name if rel.parent != Path(".") else None
    details = scan_project_details(project_dir, playlist_name)

    # Read file contents
    lyrics_content = ""
    if (project_dir / "02_lyrics.txt").exists():
        try:
            lyrics_content = (project_dir / "02_lyrics.txt").read_text(encoding="utf-8")
        except Exception:
            pass

    styles_content = ""
    if (project_dir / "styles.txt").exists():
        try:
            styles_content = (project_dir / "styles.txt").read_text(encoding="utf-8")
        except Exception:
            pass

    data_content = ""
    if (project_dir / "Data.txt").exists():
        try:
            data_content = (project_dir / "Data.txt").read_text(encoding="utf-8")
        except Exception:
            pass

    spec_content: dict[str, Any] = {}
    if (project_dir / "01_styles.json").exists():
        try:
            spec_content = json.loads((project_dir / "01_styles.json").read_text(encoding="utf-8"))
        except Exception:
            pass

    return {
        **details,
        "lyrics_text": lyrics_content,
        "styles_text": styles_content,
        "data_text": data_content,
        "spec": spec_content,
    }


@router.put("/{path:path}/spec")
def update_project_spec(path: str, req: UpdateSpecRequest):
    """Update 01_styles.json and keep SQLite checkpoint in sync."""
    project_dir = get_safe_project_dir(path)
    styles_file = project_dir / "01_styles.json"

    current: dict[str, Any] = {}
    if styles_file.exists():
        try:
            current = json.loads(styles_file.read_text(encoding="utf-8"))
        except Exception:
            pass

    if req.title is not None:
        current["title"] = req.title
    if req.suno_styles is not None:
        current["suno_styles"] = req.suno_styles
        # Also update styles.txt
        (project_dir / "styles.txt").write_text(req.suno_styles, encoding="utf-8")
    if req.image_prompt is not None:
        current["image_prompt"] = req.image_prompt
    if req.render_spec is not None:
        current["render_spec"] = req.render_spec
    if req.genre_tags is not None:
        clean_tags = [str(t).strip() for t in req.genre_tags if str(t).strip()]
        current["genre_tags"] = clean_tags
        register_genre_tags(clean_tags)

    styles_file.write_text(json.dumps(current, indent=2, ensure_ascii=False), encoding="utf-8")

    # Update checkpoint
    try:
        cp = CheckpointManager(project_dir)
        cp.mark_done("SPEC_GENERATED", current)
        meta_updates: dict[str, Any] = {}
        if req.title:
            meta_updates["title"] = req.title
        if req.concept is not None:
            meta_updates["concept"] = req.concept
        if req.style is not None:
            meta_updates["style"] = req.style
        if req.provider is not None:
            meta_updates["provider"] = req.provider
        if req.genre_tags is not None:
            meta_updates["genre_tags"] = current["genre_tags"]
        if meta_updates:
            cp.save_meta(**meta_updates)
        cp.close()
    except Exception:
        pass

    return {"success": True, "spec": current}


@router.put("/{path:path}/lyrics")
def update_lyrics(path: str, req: TextFileUpdateRequest):
    """Update 02_lyrics.txt."""
    project_dir = get_safe_project_dir(path)
    (project_dir / "02_lyrics.txt").write_text(req.content, encoding="utf-8")
    return {"success": True}


@router.put("/{path:path}/data")
def update_data_file(path: str, req: TextFileUpdateRequest):
    """Update Data.txt."""
    project_dir = get_safe_project_dir(path)
    (project_dir / "Data.txt").write_text(req.content, encoding="utf-8")
    return {"success": True}


@router.post("/{path:path}/upload-audio")
async def upload_audio_track(
    path: str,
    file: UploadFile = File(...),
    mode: str = Form("title"),
    custom_name: Optional[str] = Form(None),
):
    """
    Handle audio upload with naming confirmation:
    - mode="title": rename to song title (or project folder name)
    - mode="original": keep original uploaded filename
    - mode="custom": use provided custom_name
    Removes previous audio files to ensure exactly one active audio track per project.
    """
    project_dir = get_safe_project_dir(path)

    # Read project title
    title = project_dir.name
    spec_path = project_dir / "01_styles.json"
    if spec_path.exists():
        try:
            s_data = json.loads(spec_path.read_text(encoding="utf-8"))
            if s_data.get("title"):
                title = s_data["title"]
        except Exception:
            pass

    # Clean title for filesystem
    safe_title = _slugify(title, max_len=60)

    # Determine filename
    orig_name = Path(file.filename or "song.mp3").name
    ext = Path(orig_name).suffix.lower() or ".mp3"

    if mode == "title":
        target_filename = f"{safe_title}{ext}"
    elif mode == "custom" and custom_name and custom_name.strip():
        c_slug = _slugify(custom_name.strip(), max_len=60)
        target_filename = f"{c_slug}{ext}"
    else:  # "original"
        clean_orig = re.sub(r"[^\w\s.-]", "", orig_name).replace(" ", "_")
        target_filename = clean_orig or f"{safe_title}{ext}"

    # Remove existing audio files in project folder
    for existing_ext in ("*.mp3", "*.wav", "*.m4a"):
        for f in project_dir.glob(existing_ext):
            try:
                f.unlink()
            except Exception:
                pass

    target_path = project_dir / target_filename
    content = await file.read()
    target_path.write_bytes(content)

    # Update checkpoint
    try:
        cp = CheckpointManager(project_dir)
        cp.mark_done("AUDIO_READY", {"audio_path": str(target_path)})
        cp.close()
    except Exception:
        pass

    return {
        "success": True,
        "filename": target_filename,
        "size_bytes": len(content),
    }


@router.post("/{path:path}/upload-image")
async def upload_background_image(path: str, file: UploadFile = File(...)):
    """Upload custom background image and convert/save as 03_background.png."""
    project_dir = get_safe_project_dir(path)
    content = await file.read()

    target_path = project_dir / "03_background.png"
    # Try converting to PNG using PIL if needed
    try:
        import io
        img = Image.open(io.BytesIO(content)).convert("RGB")
        img.save(target_path, "PNG")
    except Exception:
        target_path.write_bytes(content)

    try:
        cp = CheckpointManager(project_dir)
        cp.mark_done("IMAGE_GENERATED", {"path": str(target_path)})
        cp.close()
    except Exception:
        pass

    return {"success": True, "filename": target_path.name}


@router.post("/{path:path}/open-folder")
def open_project_folder(path: str):
    """Open project directory in native OS file explorer."""
    project_dir = get_safe_project_dir(path)
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail="Project directory not found")

    try:
        if sys.platform == "win32":
            os.startfile(str(project_dir))
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(project_dir)])
        else:
            subprocess.Popen(["xdg-open", str(project_dir)])
        return {"success": True, "path": str(project_dir)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No se pudo abrir la carpeta: {exc}")


@router.delete("/{path:path}")
def remove_project(path: str):
    """Delete project directory."""
    try:
        delete_project(path)
        return {"success": True}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

