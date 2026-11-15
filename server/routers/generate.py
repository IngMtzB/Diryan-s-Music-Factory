"""
server/routers/generate.py — Endpoints for invoking AI generation services
(LLM specs, Imagen 3/DALL-E 3 art, and Social metadata).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import (
    ANTHROPIC_TEXT_MODEL,
    DALLE_MODEL,
    GEMINI_IMAGE_MODEL,
    GEMINI_TEXT_MODEL,
    get_key,
    pick_gemini_models,
)
from server.services.project_scanner import get_safe_project_dir
from services.api_client import ProviderClient, build_provider
from services.checkpoint import CheckpointManager
from services.project_manager import save_background, save_spec
from services.prompt_engine import request_spec, request_spec_from_song
from services.regeneration import regenerate_data

router = APIRouter(prefix="/api/generate", tags=["Generation"])


class GenerateSpecRequest(BaseModel):
    rel_path: str
    concept: Optional[str] = None
    style: Optional[str] = None
    provider: str = "gemini"
    existing_lyrics: Optional[str] = None
    existing_styles: Optional[str] = None


class GenerateImageRequest(BaseModel):
    rel_path: str
    prompt: Optional[str] = None
    provider: str = "gemini"


class GenerateDataRequest(BaseModel):
    rel_path: str
    provider: str = "gemini"
    lyrics: Optional[str] = None


def _get_provider_instance(provider_name: str) -> ProviderClient:
    return build_provider(provider_name)


@router.get("/config")
def get_ai_config():
    """Return configured AI models and API key availability."""
    gemini_has_key = bool(get_key("GEMINI_API_KEY"))
    anthropic_has_key = bool(get_key("ANTHROPIC_API_KEY"))
    openai_has_key = bool(get_key("OPENAI_API_KEY"))

    return {
        "gemini": {
            "available": gemini_has_key,
            "text_model": GEMINI_TEXT_MODEL,
            "image_model": GEMINI_IMAGE_MODEL,
        },
        "anthropic": {
            "available": anthropic_has_key and openai_has_key,
            "text_model": ANTHROPIC_TEXT_MODEL,
            "image_model": DALLE_MODEL,
        },
    }


@router.post("/spec")
def generate_spec_endpoint(req: GenerateSpecRequest):
    """Generate complete song spec (lyrics, Suno styles, metadata, visual prompt)."""
    project_dir = get_safe_project_dir(req.rel_path)
    cp = CheckpointManager(project_dir)

    try:
        prov = _get_provider_instance(req.provider)
        meta_now = cp.load_meta()

        # Only use request_spec_from_song if existing_lyrics is explicitly provided
        # or if no concept is provided and lyrics already exist on disk
        lyrics = req.existing_lyrics
        styles = req.existing_styles
        if not req.concept and not lyrics and (project_dir / "02_lyrics.txt").exists():
            lyrics = (project_dir / "02_lyrics.txt").read_text(encoding="utf-8").strip()
        if not req.concept and not styles and (project_dir / "styles.txt").exists():
            styles = (project_dir / "styles.txt").read_text(encoding="utf-8").strip()

        if lyrics and styles and not req.concept:
            # Generate spec from existing song
            res = request_spec_from_song(
                prov,
                lyrics=lyrics,
                suno_styles=styles,
                folder_name=project_dir.name,
            )
            style_used = req.style or meta_now.get("style") or styles
            concept_used = meta_now.get("concept") or project_dir.name.replace("_", " ")
        else:
            concept_used = req.concept or meta_now.get("concept") or project_dir.name.replace("_", " ")
            style_used = req.style or meta_now.get("style") or "Electro corrido tumbado"
            res = request_spec(prov, concept_used, style_used)

        res["concept"] = concept_used
        res["style"] = style_used

        # Preserve any existing genre_tags in 01_styles.json or session meta
        existing_spec_file = project_dir / "01_styles.json"
        if existing_spec_file.exists():
            try:
                old_spec = json.loads(existing_spec_file.read_text(encoding="utf-8"))
                if isinstance(old_spec.get("genre_tags"), list) and old_spec["genre_tags"] and not res.get("genre_tags"):
                    res["genre_tags"] = old_spec["genre_tags"]
            except Exception:
                pass
        raw_meta_tags = meta_now.get("genre_tags")
        if raw_meta_tags and not res.get("genre_tags"):
            if isinstance(raw_meta_tags, list):
                res["genre_tags"] = [str(t).strip() for t in raw_meta_tags if str(t).strip()]
            elif isinstance(raw_meta_tags, str) and raw_meta_tags.strip() not in ("", "[]"):
                try:
                    parsed_gt = json.loads(raw_meta_tags)
                    if isinstance(parsed_gt, list) and parsed_gt:
                        res["genre_tags"] = [str(t).strip() for t in parsed_gt if str(t).strip()]
                except Exception:
                    pass

        # Save spec assets
        save_spec(project_dir, res)
        cp.mark_done("SPEC_GENERATED", res)
        meta_kwargs: dict[str, Any] = {"provider": req.provider}
        if res.get("title"):
            meta_kwargs["title"] = res["title"]
        if concept_used:
            meta_kwargs["concept"] = concept_used
        if style_used:
            meta_kwargs["style"] = style_used
        cp.save_meta(**meta_kwargs)
        cp.close()

        data_text = ""
        data_file = project_dir / "Data.txt"
        if data_file.exists():
            try:
                data_text = data_file.read_text(encoding="utf-8")
            except Exception:
                pass

        return {"success": True, "spec": res, "data_text": data_text}
    except HTTPException:
        cp.close()
        raise
    except Exception as exc:
        cp.mark_failed("SPEC_GENERATED", str(exc))
        cp.close()
        raise HTTPException(status_code=500, detail=f"Error generating spec: {exc}")


@router.post("/image")
def generate_image_endpoint(req: GenerateImageRequest):
    """Generate background image (03_background.png) via Imagen 3 or DALL-E 3."""
    project_dir = get_safe_project_dir(req.rel_path)
    cp = CheckpointManager(project_dir)

    prompt = req.prompt
    spec_path = project_dir / "01_styles.json"

    spec_data: dict[str, Any] = {}
    if spec_path.exists():
        try:
            spec_data = json.loads(spec_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    if not prompt:
        prompt = spec_data.get("image_prompt", "")

    if not prompt:
        cp.close()
        raise HTTPException(status_code=400, detail="No image prompt provided or found in project spec.")

    # Update prompt in spec if changed
    if prompt != spec_data.get("image_prompt"):
        spec_data["image_prompt"] = prompt
        save_spec(project_dir, spec_data)

    try:
        prov = _get_provider_instance(req.provider)
        img_bytes = prov.generate_image(prompt)
        bg_path = save_background(project_dir, img_bytes)
        cp.mark_done("IMAGE_GENERATED", {"path": str(bg_path)})
        cp.close()
        return {"success": True, "filename": bg_path.name}
    except HTTPException:
        cp.close()
        raise
    except Exception as exc:
        cp.mark_failed("IMAGE_GENERATED", str(exc))
        cp.close()
        raise HTTPException(status_code=500, detail=f"Error generating background: {exc}")


@router.post("/data")
def generate_data_endpoint(req: GenerateDataRequest):
    """Regenerate metadata and social copy (Data.txt) via LLM."""
    project_dir = get_safe_project_dir(req.rel_path)
    cp = CheckpointManager(project_dir)

    spec_path = project_dir / "01_styles.json"
    if not spec_path.exists():
        cp.close()
        raise HTTPException(status_code=400, detail="Spec file (01_styles.json) not found.")

    try:
        spec = json.loads(spec_path.read_text(encoding="utf-8"))

        # Preserve / persist lyrics so they are NEVER wiped out
        lyrics_file = project_dir / "02_lyrics.txt"
        if req.lyrics:
            lyrics_file.write_text(req.lyrics, encoding="utf-8")
            spec["lyrics"] = req.lyrics
        elif lyrics_file.exists():
            l_text = lyrics_file.read_text(encoding="utf-8").strip()
            if l_text:
                spec["lyrics"] = l_text

        prov = _get_provider_instance(req.provider)
        meta = cp.load_meta()

        concept = meta.get("concept", project_dir.name)
        style = meta.get("style", "")

        data_path = regenerate_data(
            project_dir=project_dir,
            spec=spec,
            cp=cp,
            provider=prov,
            concept=concept,
            style=style,
        )
        cp.close()
        content = data_path.read_text(encoding="utf-8")
        return {"success": True, "content": content}
    except Exception as exc:
        cp.close()
        raise HTTPException(status_code=500, detail=f"Error generating Data.txt: {exc}")

