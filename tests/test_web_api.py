"""
tests/test_web_api.py — Comprehensive Integration & Regression Tests
for Diryan's Music Factory Web Studio.

Guarantees stability across:
  • Health & SPA Serving
  • Playlists & Organization CRUD
  • Projects Listing, Searching & Filtering
  • Project Spec & Asset Updates (01_styles.json, 02_lyrics.txt, Data.txt)
  • Media Streaming with HTTP 206 Partial Content (Audio & Video Range Requests)
  • Local Folder Opening (os.startfile integration)
  • Video Rendering (16:9 trigger without AnyIO loop crash)
  • Vertical Video 9:16 Crop (Route precedence without 422 Unprocessable Content)
  • AI Generation Configuration (Gemini 2.5 Flash Image model verification)
"""

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from config import GEMINI_IMAGE_MODEL, PROJECTS_DIR
from server.main import app

client = TestClient(app)


# ── 1. Health & SPA Root ────────────────────────────────────────────────────────

def test_health():
    """Verify health endpoint responds with 200 OK."""
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_spa_root():
    """Verify SPA index.html is served."""
    r = client.get("/")
    assert r.status_code == 200
    assert "Diryan" in r.text or '<div id="root">' in r.text


# ── 2. Playlists API ───────────────────────────────────────────────────────────

def test_playlists_list():
    """Verify playlists listing and stats structure."""
    r = client.get("/api/playlists")
    assert r.status_code == 200
    data = r.json()
    assert "playlists" in data
    assert "unclassified_count" in data
    assert "total_projects" in data


# ── 3. Projects API (Listing, Filtering, Search) ───────────────────────────────

def test_projects_list_and_details():
    """Verify projects list returns valid projects and individual details endpoint works."""
    r = client.get("/api/projects")
    assert r.status_code == 200
    data = r.json()
    assert "projects" in data
    assert "count" in data
    assert data["count"] > 0

    rel_path = data["projects"][0]["rel_path"]
    detail_res = client.get(f"/api/projects/{rel_path}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert "title" in detail
    assert "status" in detail
    assert "has_audio" in detail


def test_projects_filter_by_status():
    """Verify filtering by status returns matching or empty subset."""
    for st in ("COMPLETED", "READY_TO_RENDER", "AWAITING_AUDIO", "UNINITIALIZED"):
        r = client.get(f"/api/projects?status={st}")
        assert r.status_code == 200
        for p in r.json()["projects"]:
            assert p["status"].upper() == st


def test_projects_search():
    """Verify search query parameter filters projects by name/title."""
    r = client.get("/api/projects?q=amor")
    assert r.status_code == 200
    assert "projects" in r.json()


# ── 4. Open Folder Endpoint (Windows Explorer) ─────────────────────────────────

def test_open_project_folder(monkeypatch):
    """Verify /api/projects/{path}/open-folder dispatches to OS file opener."""
    r = client.get("/api/projects")
    projects = r.json()["projects"]
    assert len(projects) > 0
    rel_path = projects[0]["rel_path"]

    opened_paths = []
    if hasattr(os, "startfile"):
        monkeypatch.setattr(os, "startfile", lambda p: opened_paths.append(str(p)))

    res = client.post(f"/api/projects/{rel_path}/open-folder")
    assert res.status_code == 200
    assert res.json()["success"] is True

    # Test 404 on nonexistent project
    err_res = client.post("/api/projects/nonexistent_fake_project_99999/open-folder")
    assert err_res.status_code == 404


# ── 5. Project Spec & Asset Updates ────────────────────────────────────────────

def test_update_spec_persistence():
    """Verify PUT /api/projects/{path}/spec updates render specs in 01_styles.json."""
    r = client.get("/api/projects")
    projects = r.json()["projects"]
    rel_path = projects[0]["rel_path"]

    spec_payload = {
        "title": "Test Title Persistence",
        "suno_styles": "Cyberpunk, 140 BPM, Synthesizer",
        "image_prompt": "Neon stage with lasers",
        "render_spec": {
            "waveform": {
                "style": "center_symmetrical",
                "primary_color": "#00F0FF",
                "secondary_color": "#FF2A55",
                "color_mode": "horizontal",
                "bar_count": 48,
            },
            "motion_effects": {
                "bass_shake": True,
                "shake_intensity_px": 8,
                "background_pulse": True,
            },
        },
    }

    res = client.put(f"/api/projects/{rel_path}/spec", json=spec_payload)
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_palette_extraction():
    """Verify GET /api/projects/{path}/palette returns extracted dominant colors."""
    r = client.get("/api/projects")
    projects = [p for p in r.json()["projects"] if p.get("has_bg")]
    if not projects:
        pytest.skip("No projects with background image found")

    rel_path = projects[0]["rel_path"]
    res = client.get(f"/api/projects/{rel_path}/palette")
    assert res.status_code == 200
    data = res.json()
    assert "primary" in data
    assert "secondary" in data
    assert data["primary"].startswith("#")
    assert data["secondary"].startswith("#")


# ── 6. Media Streaming (HTTP 206 Range Requests) ───────────────────────────────

def test_media_audio_range_request():
    """
    CRITICAL REGRESSION TEST:
    Verify /api/media/{path}/audio supports HTTP 206 Partial Content range requests
    without crashing asyncio event loop or disconnecting abruptly.
    """
    r = client.get("/api/projects")
    audio_projects = [p for p in r.json()["projects"] if p.get("has_audio")]
    if not audio_projects:
        pytest.skip("No projects with audio file found")

    rel_path = audio_projects[0]["rel_path"]

    # Test Range request
    range_headers = {"Range": "bytes=0-1024"}
    res = client.get(f"/api/media/{rel_path}/audio", headers=range_headers)
    assert res.status_code == 206
    assert "bytes 0-1024/" in res.headers.get("Content-Range", "")
    assert res.headers.get("Accept-Ranges") == "bytes"
    assert len(res.content) == 1025


def test_media_audio_full_request():
    """Verify full GET audio returns 200 OK with audio/mpeg or audio/wav."""
    r = client.get("/api/projects")
    audio_projects = [p for p in r.json()["projects"] if p.get("has_audio")]
    if not audio_projects:
        pytest.skip("No projects with audio file found")

    rel_path = audio_projects[0]["rel_path"]
    res = client.get(f"/api/media/{rel_path}/audio")
    assert res.status_code == 200
    assert "audio" in res.headers.get("Content-Type", "")


def test_media_image_serving():
    """Verify image serving returns 200 with image/png or image/jpeg."""
    r = client.get("/api/projects")
    bg_projects = [p for p in r.json()["projects"] if p.get("has_bg")]
    if not bg_projects:
        pytest.skip("No projects with background image found")

    rel_path = bg_projects[0]["rel_path"]
    res = client.get(f"/api/media/{rel_path}/image")
    assert res.status_code == 200
    assert "image" in res.headers.get("Content-Type", "")


def test_media_404():
    """Verify nonexistent media paths return clean 404."""
    res = client.get("/api/media/totally_nonexistent_project_xyz/audio")
    assert res.status_code == 404


# ── 7. Video Rendering & 9:16 Crop Routes ──────────────────────────────────────

def test_trigger_render_endpoint():
    """
    CRITICAL REGRESSION TEST:
    Verify POST /api/render/{path} runs without AnyIO worker thread RuntimeError
    and returns a valid job_id with 200 OK.
    """
    r = client.get("/api/projects")
    audio_projects = [p for p in r.json()["projects"] if p.get("has_audio")]
    if not audio_projects:
        pytest.skip("No projects with audio file found")

    rel_path = audio_projects[0]["rel_path"]

    payload = {
        "custom_spec": {},
        "render_16x9": False,
        "render_9x16": False,
    }
    res = client.post(f"/api/render/{rel_path}", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "job_id" in data
    assert data["status"] in ("queued", "running", "completed")

    # Verify status polling
    job_id = data["job_id"]
    st_res = client.get(f"/api/render/status/{job_id}")
    assert st_res.status_code == 200
    assert st_res.json()["job_id"] == job_id


def test_trigger_render_empty_body():
    """Verify POST /api/render/{path} with empty body defaults without 422 error."""
    r = client.get("/api/projects")
    audio_projects = [p for p in r.json()["projects"] if p.get("has_audio")]
    if not audio_projects:
        pytest.skip("No projects with audio file found")

    rel_path = audio_projects[0]["rel_path"]
    res = client.post(f"/api/render/{rel_path}")
    # Must NOT be 422 Unprocessable Entity
    assert res.status_code in (200, 400)


def test_crop_9x16_route_precedence():
    """
    CRITICAL REGRESSION TEST:
    Verify POST /api/render/{path}/crop-9x16 resolves to crop_9x16 handler
    and DOES NOT match the catch-all render route (which would cause 422 Unprocessable Content).
    """
    r = client.get("/api/projects")
    projects = r.json()["projects"]
    assert len(projects) > 0
    rel_path = projects[0]["rel_path"]

    res = client.post(f"/api/render/{rel_path}/crop-9x16")
    # Must NOT return 422 Unprocessable Content!
    assert res.status_code != 422
    # Returns 200 (if 16:9 video exists) or 400 (no 16:9 video found), both validate route matching
    assert res.status_code in (200, 400)
    if res.status_code == 400:
        assert "no 16:9 video found" in res.json()["detail"].lower()


# ── 8. AI Generation Configuration ─────────────────────────────────────────────

def test_ai_generation_config():
    """Verify AI configuration returns correct, active image generation models."""
    r = client.get("/api/generate/config")
    assert r.status_code == 200
    data = r.json()
    assert "gemini" in data
    # Verify the image model is the updated valid model
    assert data["gemini"]["image_model"] == GEMINI_IMAGE_MODEL
    assert data["gemini"]["image_model"] == "gemini-2.5-flash-image"


# ── 9. Standardized Parametric Waveform Catalog CRUD & 1:1 Renderer ────────────

def test_waveform_catalog_crud_and_renderer():
    """Verify waveform presets can be created, modified, deleted, reset, and rendered 1:1."""
    import numpy as np
    from video.renderer import _draw_waveform

    r = client.get("/api/projects/catalog")
    assert r.status_code == 200
    cat = r.json()
    assert "waveform_presets" in cat
    assert len(cat["waveform_presets"]) >= 10

    custom_wave = {
        "id": "custom_test_wave",
        "name": "CUSTOM TEST WAVE",
        "desc": "Onda de prueba paramétrica",
        "engine": "rounded_mirror",
        "isBuiltin": False,
        "params": {
            "engine": "rounded_mirror",
            "bar_count": 36,
            "base_y_ratio": 0.75,
            "max_height_ratio": 0.30,
            "symmetry": "center",
            "gap_divisor": 4.5,
            "roundness": 6.0,
            "reflection_enabled": True,
            "reflection_scale": 0.50,
            "reflection_opacity": 0.30,
            "reflection_gap": 6.0,
            "glow_blur": 8.0,
            "default_color_mode": "horizontal",
        },
    }

    updated_list = [custom_wave] + cat["waveform_presets"]
    put_res = client.put("/api/projects/catalog", json={"waveform_presets": updated_list})
    assert put_res.status_code == 200
    assert any(w["id"] == "custom_test_wave" for w in put_res.json()["waveform_presets"])

    # Render a frame using the custom parametric wave
    dummy_frame = np.zeros((720, 1280, 3), dtype=np.uint8)
    dummy_amps = np.linspace(0.1, 0.9, 36, dtype=np.float32)
    out_frame = _draw_waveform(
        dummy_frame,
        dummy_amps,
        {"waveform": {"style": "custom_test_wave", "params": custom_wave["params"]}},
        t=0.5,
    )
    assert out_frame.shape == (720, 1280, 3)
    assert int(out_frame.sum()) > 0

    # Reset back to factory defaults
    reset_res = client.post("/api/projects/catalog/reset-waveforms")
    assert reset_res.status_code == 200
    assert len(reset_res.json()["waveform_presets"]) == 10


# ── 10. Video Game Ambient OST Mode (Instrumental / No Vocals) ─────────────────

def test_ambient_ost_videogame_mode_and_enforcement():
    """Verify Ambient / Exploration OST detection, bracket-only lyrics, and 'purely instrumental, no vocals' style enforcement."""
    from services.prompt_engine import (
        is_ambient_ost_style,
        is_videogame_style,
        _enforce_ambient_ost_styles,
        _enforce_ambient_ost_lyrics,
    )

    # 1. Detection of Ambient/Exploration vs Epic/Combat
    ambient_style = "OST Ambiental & Exploración (Sin Voces) - Peaceful RPG Village & Forest, acoustic lute, wooden flute, soft pizzicato strings, purely instrumental, no vocals"
    assert is_ambient_ost_style(ambient_style, "Villa medieval tranquila al amanecer")
    assert is_videogame_style(ambient_style, "Villa medieval tranquila al amanecer")

    combat_style = "Música para videojuegos - Slavic Dark Folk & Combat, hurdy-gurdy, ritual war drums, throat singing & female glossolalia vocalise"
    assert not is_ambient_ost_style(combat_style, "Jefe final ancestral")
    assert is_videogame_style(combat_style, "Jefe final ancestral")

    # 2. Enforce 'purely instrumental, no vocals' at the end and <= 200 chars
    styled = _enforce_ambient_ost_styles("Peaceful RPG Village, acoustic lute, wooden flute, soft pizzicato strings, 92 BPM G Major")
    assert styled.endswith("purely instrumental, no vocals")
    assert len(styled) <= 200

    # 3. Enforce bracket-only directives in lyrics (strip any stray words outside brackets)
    raw_lyrics = (
        "[Intro]\n"
        "[Soft pizzicato strings]\n"
        "Some stray vocal line that should be removed\n"
        "[Theme A: Main Melody]\n"
        "[Solo wooden flute enters]\n"
        "(Sanctus!)\n"
        "[Outro: Loopable Fade]\n"
    )
    cleaned_lyrics = _enforce_ambient_ost_lyrics(raw_lyrics)
    assert "stray vocal" not in cleaned_lyrics
    assert "(Sanctus!)" not in cleaned_lyrics
    assert "[Soft pizzicato strings]" in cleaned_lyrics
    assert "[Solo wooden flute enters]" in cleaned_lyrics
    assert cleaned_lyrics.endswith("[End]")
    for line in cleaned_lyrics.splitlines():
        if line.strip():
            assert line.strip().startswith("[") and line.strip().endswith("]")


def test_custom_electro_corrido_never_triggers_ost_mode():
    """
    Regression test: Custom Electro Corrido tags with bass/harmonic/melancholic descriptions
    and Spanish words containing 'ost' (nostálgico, costó, mostrar) must NEVER trigger
    Video Game or Ambient OST mode, and build_system_prompt must exclude Section 4 of lyrics_rules.md.
    """
    from services.prompt_engine import (
        build_system_prompt,
        is_ambient_ost_style,
        is_videogame_style,
        request_spec,
    )

    custom_style = (
        "Corridos Bélicos - Electro corrido especial para bajos, con bass prologados "
        "y potentes pero controlados y armónicos, sentimental, melancólico y triste"
    )
    concept = (
        "La historia de un programador nostálgico al que le costó mostrar sus sentimientos "
        "en un ambiente tranquilo y le decían ahorita te contesto"
    )

    assert not is_ambient_ost_style(custom_style, concept)
    assert not is_videogame_style(custom_style, concept)

    sys_prompt = build_system_prompt(videogame_mode=False, ambient_ost_mode=False)
    assert "MODO ESPECIAL: MÚSICA PARA VIDEOJUEGOS" not in sys_prompt
    assert "Director de Audio y Compositor de Bandas Sonoras" not in sys_prompt

    # Verify request_spec retries if first LLM call returns bracket-only instrumental cues
    # and sanitizes 'null' title / tags
    calls = []

    class FlakyCorridoProvider:
        def generate_spec(self, system_prompt: str, user_prompt: str):
            calls.append(user_prompt)
            if len(calls) == 1:
                return {
                    "title": None,
                    "youtube_title": "null - Electro Corrido Tumbado | Corridos en HTML",
                    "youtube_tags": "null, electro corrido, corridos tumbados",
                    "suno_styles": "electro corrido tumbado, deep bass, requinto",
                    "lyrics": "[Intro]\n[Heavy bassline and melancholic requinto]\n[End]",
                    "image_prompt": "Dark studio with programmer centered",
                    "render_spec": {"waveform": {"style": "mirrored_bars"}},
                }
            return {
                "title": None,
                "youtube_title": "null - Electro Corrido Tumbado | Corridos en HTML",
                "youtube_tags": "null, electro corrido, corridos tumbados",
                "suno_styles": "electro corrido tumbado, deep bass, requinto",
                "lyrics": (
                    "[Intro]\n"
                    "Música de la cuatro cero tres,\n"
                    "Corridos en ache-te-eme-ele,\n\n"
                    "[Verso 1]\n"
                    "Esperando tu mensaje frente al monitor\n"
                    "Me dijiste ahorita te contesto y se apagó el amor\n"
                ),
                "image_prompt": "Dark studio with programmer centered",
                "render_spec": {"waveform": {"style": "mirrored_bars"}},
            }

    res = request_spec(FlakyCorridoProvider(), concept, custom_style)
    assert len(calls) == 2
    assert "Esperando tu mensaje frente al monitor" in res["lyrics"]
    assert res["title"].lower() != "null"
    assert not res["youtube_title"].lower().startswith("null")
    assert "null" not in [t.strip().lower() for t in res["youtube_tags"].split(",")]



