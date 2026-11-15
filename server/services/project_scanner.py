"""
server/services/project_scanner.py — Hierarchical discovery and management of
song projects and playlists under PROJECTS_DIR.
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Any

from config import PROJECTS_DIR
from services.checkpoint import CheckpointManager
from video.renderer import (
    find_project_audio,
    find_project_video_16x9,
    find_project_video_9x16,
)
from video.styles import get_default_waveform_presets

SONG_IDENTIFIER_FILES = {
    "session.db",
    "01_styles.json",
    "02_lyrics.txt",
    "styles.txt",
    "Data.txt",
    "03_background.png",
    "03_song.mp3",
}


def is_song_project_dir(path: Path) -> bool:
    """Check if a directory is a song project folder."""
    if not path.is_dir():
        return False
    # Check for direct marker files
    for name in SONG_IDENTIFIER_FILES:
        if (path / name).exists():
            return True
    # Check if there is any mp3 or video file
    for ext in ("*.mp3", "*16x9*.mp4", "*9x16*.mp4"):
        if any(path.glob(ext)):
            return True
    return False


def get_safe_project_dir(rel_path: str) -> Path:
    """Safely resolve a relative project path inside PROJECTS_DIR."""
    # Clean leading slashes
    clean = rel_path.strip("/\\").replace("\\", "/")
    target = (PROJECTS_DIR / clean).resolve()
    base = PROJECTS_DIR.resolve()
    if not (target == base or base in target.parents):
        raise ValueError("Invalid project path traversal.")
    return target


def scan_project_details(project_dir: Path, playlist_name: str | None = None) -> dict[str, Any]:
    """Inspect a song project directory and return structured metadata and asset statuses."""
    rel_path = project_dir.relative_to(PROJECTS_DIR).as_posix()
    name = project_dir.name

    # Check files
    audio_path = find_project_audio(project_dir)
    video_16x9_path = find_project_video_16x9(project_dir)
    video_9x16_path = find_project_video_9x16(project_dir)

    bg_path = project_dir / "03_background.png"
    if not bg_path.exists():
        for ext in ("*.png", "*.jpg", "*.jpeg"):
            candidates = list(project_dir.glob(ext))
            if candidates:
                bg_path = candidates[0]
                break

    has_audio = audio_path is not None and audio_path.exists()
    has_bg = bg_path.exists()
    has_lyrics = (project_dir / "02_lyrics.txt").exists()
    has_styles = (project_dir / "styles.txt").exists()
    has_spec = (project_dir / "01_styles.json").exists()
    has_data = (project_dir / "Data.txt").exists()
    has_16x9 = video_16x9_path is not None and video_16x9_path.exists()
    has_9x16 = video_9x16_path is not None and video_9x16_path.exists()

    # Read checkpoint / session metadata
    checkpoint_step = "SESSION_INIT"
    is_complete = False
    meta: dict[str, Any] = {}
    db_path = project_dir / "session.db"

    if db_path.exists() and db_path.stat().st_size > 0:
        try:
            cp = CheckpointManager(project_dir)
            checkpoint_step = cp.first_incomplete()
            is_complete = cp.is_done("VIDEO_RENDERED") or has_16x9
            meta = cp.load_meta()
            cp.close()
        except Exception:
            pass

    # Read spec if available
    spec_data: dict[str, Any] = {}
    if has_spec:
        try:
            spec_data = json.loads((project_dir / "01_styles.json").read_text(encoding="utf-8"))
        except Exception:
            pass

    def _non_null(val: Any) -> str:
        s = str(val or "").strip()
        return "" if s.lower() in ("null", "none", "undefined", "n/a") else s

    title = (
        _non_null(spec_data.get("title"))
        or _non_null(meta.get("title"))
        or _non_null(meta.get("concept"))
        or name.replace("_", " ")
    )
    concept = _non_null(meta.get("concept")) or _non_null(spec_data.get("concept")) or title
    style = (
        _non_null(meta.get("style"))
        or _non_null(spec_data.get("style"))
        or _non_null(spec_data.get("suno_styles"))
    )
    provider = _non_null(meta.get("provider")) or "gemini"
    raw_tags = spec_data.get("genre_tags") if "genre_tags" in spec_data else meta.get("genre_tags")
    if isinstance(raw_tags, str) and raw_tags.strip():
        try:
            parsed_tags = json.loads(raw_tags)
            raw_tags = parsed_tags if isinstance(parsed_tags, list) else []
        except Exception:
            raw_tags = []
    genre_tags = [str(t).strip() for t in raw_tags if _non_null(t)] if isinstance(raw_tags, list) else []

    # Overall project status tag
    if is_complete or has_16x9:
        status = "COMPLETED"
    elif has_audio:
        status = "READY_TO_RENDER"
    elif has_bg or has_spec:
        status = "AWAITING_AUDIO"
    elif has_lyrics or has_styles:
        status = "UNINITIALIZED"
    else:
        status = "DRAFT"

    return {
        "name": name,
        "title": title,
        "concept": concept,
        "style": style,
        "provider": provider,
        "genre_tags": genre_tags,
        "playlist": playlist_name,
        "rel_path": rel_path,
        "abs_path": str(project_dir),
        "status": status,
        "checkpoint_step": checkpoint_step,
        "is_complete": is_complete,
        "has_audio": has_audio,
        "audio_name": audio_path.name if audio_path else None,
        "has_bg": has_bg,
        "bg_name": bg_path.name if has_bg else None,
        "has_lyrics": has_lyrics,
        "has_styles": has_styles,
        "has_spec": has_spec,
        "has_data": has_data,
        "has_video_16x9": has_16x9,
        "video_16x9_name": video_16x9_path.name if video_16x9_path else None,
        "has_video_9x16": has_9x16,
        "video_9x16_name": video_9x16_path.name if video_9x16_path else None,
        "modified_at": os.path.getmtime(project_dir),
    }


def scan_all_projects() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Recursively scans PROJECTS_DIR.
    Returns:
    - projects: list of all project dictionaries
    - playlists: list of playlists with song counts
    """
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)

    projects: list[dict[str, Any]] = []
    playlist_folders: set[str] = set()

    for item in sorted(PROJECTS_DIR.iterdir()):
        if not item.is_dir() or item.name.startswith("."):
            continue

        if is_song_project_dir(item):
            # Direct song in projects root (no playlist)
            projects.append(scan_project_details(item, playlist_name=None))
        else:
            # It's a playlist container folder
            playlist_folders.add(item.name)
            for sub_item in sorted(item.iterdir()):
                if sub_item.is_dir() and not sub_item.name.startswith("."):
                    if is_song_project_dir(sub_item):
                        projects.append(scan_project_details(sub_item, playlist_name=item.name))

    # Calculate counts per playlist
    counts: dict[str, int] = {p: 0 for p in playlist_folders}
    for p in projects:
        pl = p["playlist"]
        if pl and pl in counts:
            counts[pl] += 1

    playlists = [
        {"name": name, "count": counts.get(name, 0)}
        for name in sorted(playlist_folders)
    ]

    # Sort projects by modified_at desc (most recent first)
    projects.sort(key=lambda x: x["modified_at"], reverse=True)
    return projects, playlists


def create_playlist(name: str) -> str:
    """Create a new playlist directory inside PROJECTS_DIR."""
    clean_name = name.strip().replace("/", "_").replace("\\", "_")
    if not clean_name:
        raise ValueError("El nombre de la playlist no puede estar vacío.")

    target = PROJECTS_DIR / clean_name
    target.mkdir(parents=True, exist_ok=True)
    return clean_name


def rename_playlist(old_name: str, new_name: str) -> str:
    """Rename an existing playlist directory."""
    clean_old = old_name.strip().replace("/", "_").replace("\\", "_")
    clean_new = new_name.strip().replace("/", "_").replace("\\", "_")
    if not clean_new:
        raise ValueError("El nuevo nombre de playlist no puede estar vacío.")

    source = PROJECTS_DIR / clean_old
    if not source.exists() or not source.is_dir():
        raise FileNotFoundError(f"Playlist no encontrada: {old_name}")

    dest = PROJECTS_DIR / clean_new
    if dest.exists() and dest.resolve() != source.resolve():
        raise FileExistsError(f"Ya existe una carpeta o playlist con el nombre '{clean_new}'.")

    if dest.resolve() != source.resolve():
        shutil.move(str(source), str(dest))
    return clean_new


def delete_playlist(name: str) -> None:
    """
    Delete a playlist directory.
    Moves all song projects inside this playlist to the root projects/ folder
    so that deleting the playlist only dissolves the relationship, never deleting the songs!
    """
    clean_name = name.strip().replace("/", "_").replace("\\", "_")
    target = PROJECTS_DIR / clean_name
    if not target.exists() or not target.is_dir():
        raise FileNotFoundError(f"Playlist no encontrada: {name}")

    # Move any song project subfolders to root PROJECTS_DIR
    for item in list(target.iterdir()):
        if item.is_dir():
            dest = PROJECTS_DIR / item.name
            counter = 1
            base = dest
            while dest.exists():
                dest = PROJECTS_DIR / f"{base.name}_{counter}"
                counter += 1
            shutil.move(str(item), str(dest))
        else:
            try:
                item.unlink()
            except Exception:
                pass

    # Remove the emptied playlist container folder
    shutil.rmtree(str(target))



def move_project(rel_path: str, target_playlist: str | None) -> str:
    """
    Move a project directory to another playlist folder or back to root.
    Returns the new relative path.
    """
    source_dir = get_safe_project_dir(rel_path)
    if not source_dir.exists() or not source_dir.is_dir():
        raise FileNotFoundError(f"Project directory not found: {rel_path}")

    project_folder_name = source_dir.name

    if target_playlist and target_playlist.strip():
        pl_clean = target_playlist.strip().replace("/", "_").replace("\\", "_")
        dest_parent = PROJECTS_DIR / pl_clean
        dest_parent.mkdir(parents=True, exist_ok=True)
        dest_dir = dest_parent / project_folder_name
    else:
        dest_dir = PROJECTS_DIR / project_folder_name

    if source_dir.resolve() == dest_dir.resolve():
        return source_dir.relative_to(PROJECTS_DIR).as_posix()

    if dest_dir.exists():
        raise FileExistsError(f"A project with name '{project_folder_name}' already exists in target location.")

    shutil.move(str(source_dir), str(dest_dir))
    return dest_dir.relative_to(PROJECTS_DIR).as_posix()


def delete_project(rel_path: str) -> None:
    """Delete a project folder."""
    target_dir = get_safe_project_dir(rel_path)
    if not target_dir.exists():
        raise FileNotFoundError(f"Project not found: {rel_path}")
    shutil.rmtree(str(target_dir))


CATALOG_FILE = PROJECTS_DIR / ".studio_catalog.json"

DEFAULT_GENRE_TAGS = [
    "Corridos Bélicos",
    "Electro Tumbado",
    "Tumbado Sinfónico",
    "Cyber-Corrido",
    "Música para Videojuegos",
    "OST Ambiental (Sin Voces)",
    "RPG Exploration OST",
    "Slavic Dark Folk",
    "Dark Fantasy OST",
    "Cyberpunk Boss Fight",
    "Synthwave",
    "Darksynth",
    "Phonk",
    "Brazilian Phonk",
    "Lo-Fi Beats",
]

DEFAULT_CREATION_CATEGORIES = [
    {"id": "all", "label": "Todos"},
    {"id": "regional", "label": "Regional & Tumbado"},
    {"id": "gaming", "label": "Gaming & Cinematic"},
    {"id": "cyberpunk", "label": "Cyberpunk & Synth"},
    {"id": "trap", "label": "Trap & Drill"},
    {"id": "lofi", "label": "Lo-Fi / Beats"},
]

DEFAULT_CREATION_GENRES = [
    {
        "id": "corridos_belicos",
        "category": "regional",
        "tag": "Regional & Tumbado",
        "title": "Corridos Bélicos",
        "description": "Tololoche percusivo, requinto de doce cuerdas metálico con 808s saturados y metales de banda en compás de 3/4.",
        "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuBqmf9iuwQsR2MIdC3BpLrtZqxOhpmSaW0mVu8e2Rop9aUOnl7poNERi78MCgOcG7Gu2mxFa1R6f-dGWRLBErUJOIN4n6cY89CV40-G3dOQxYgF-o0xk-d_8EVa5RcnEHRsCOIIrgpxnAKA8jR5CleuqcN7tL8QakkLZDTJswJdL80AqKSM898mRuMVcw84OJYqVI1uHqSZBooSye_V_HP6Xe7bMg9E8bq5Gr26fho",
        "tuning": "Afinación: Fa# Menor",
        "bpm": "145 BPM",
        "presetName": "REQUINTO_CYBERPUNK_V4",
        "isVideogame": False,
        "subgenres": [
            {
                "id": "electro_tumbado",
                "label": "Electro Tumbado",
                "prompt": "Electro corrido tumbado, requinto de 12 cuerdas acústico con 808 distorsionado, charcheta de viento y sintetizador analógico a 145 BPM",
            },
            {
                "id": "tumbado_sinfonico",
                "label": "Tumbado Sinfónico",
                "prompt": "Corrido tumbado sinfónico, requinto sierreño agresivo fusionado con cuerdas orquestales dramáticas, tololoche profundo y trombones bélicos a 138 BPM",
            },
            {
                "id": "cyber_corrido",
                "label": "Cyber-Corrido Belic",
                "prompt": "Cyber-corrido bélico, requinto electro-acústico, bajo quinto agresivo, sub-bass 808 saturado, synth leads oscuros, 145 BPM",
            },
        ],
    },
    {
        "id": "musica_videojuegos",
        "category": "gaming",
        "tag": "Gaming Engine • Épico/Vocal",
        "title": "Música para Videojuegos (Épico & Combate)",
        "description": "Texturas orquestales épicas, tambores taiko de combate, percusión ritual nórdica/eslava, voz como instrumento (glossolalia/latín) y arco dinámico AAA.",
        "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuBFRsnOwC4foNQbhbuN7cfAIUdRvtgedL8ciN_pq3lPyaiFg9nbrBwjQA1w2fE297Bu56jBoW4Sn--ir8a6ZdgLpThL9NUms5CWddBxq_Y2G1-Ip3q7stXNt_-54-ZCwvNlFon6d2RtyfYPr-H_VtS2L6J-_u0ZL4IiwDKpBzzZvwpZ3xaHoO_QcWaEz6cU4tFyNOfXDLAZ1GYLWPziu2D0at6tkEy6fvlGwe_9mRo",
        "tuning": "Escala: Dórica / Frigia",
        "bpm": "120 - 160 BPM",
        "presetName": "OST_DYNAMIC_ENGINE_V2",
        "isVideogame": True,
        "isAmbientOst": False,
        "subgenres": [
            {
                "id": "slavic_dark_folk",
                "label": "Slavic Dark Folk & Combat",
                "prompt": "Música para videojuegos - Slavic Dark Folk & Combat, hurdy-gurdy, ritual war drums, throat singing & female glossolalia vocalise, 140 BPM D Dorian, dark AAA combat vibe",
            },
            {
                "id": "dark_fantasy_emotivo",
                "label": "Dark Fantasy Emotivo / Tema Principal",
                "prompt": "Música para videojuegos - Dark Fantasy Emotivo / Tema Principal, solo cello, harp, ethereal soprano vocalise in Latin & glossolalia, solemn choir, 118 BPM C# Minor, emotional AAA main theme",
            },
            {
                "id": "cyberpunk_boss_fight",
                "label": "Cyberpunk / Sci-Fi Boss Fight",
                "prompt": "Música para videojuegos - Cyberpunk / Sci-Fi Boss Fight, distorted industrial synths, orchestral brass, operatic choir counterpoint, 155 BPM F Phrygian, high-intensity boss battle",
            },
        ],
    },
    {
        "id": "ost_ambiental_exploracion",
        "category": "gaming",
        "tag": "OST Ambiental • Sin Voces",
        "title": "OST Ambiental & Exploración (Sin Voces)",
        "description": "Soundtrack instrumental de ambientación AAA para villas, bosques, menús tranquilos y dungeons. Cero voces: estructura cíclica con directivas [ ] y purely instrumental, no vocals.",
        "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuBFRsnOwC4foNQbhbuN7cfAIUdRvtgedL8ciN_pq3lPyaiFg9nbrBwjQA1w2fE297Bu56jBoW4Sn--ir8a6ZdgLpThL9NUms5CWddBxq_Y2G1-Ip3q7stXNt_-54-ZCwvNlFon6d2RtyfYPr-H_VtS2L6J-_u0ZL4IiwDKpBzzZvwpZ3xaHoO_QcWaEz6cU4tFyNOfXDLAZ1GYLWPziu2D0at6tkEy6fvlGwe_9mRo",
        "tuning": "Escala: Dórica / Lidia / Mayor",
        "bpm": "72 - 96 BPM",
        "presetName": "OST_AMBIENT_LOOP_V1",
        "isVideogame": True,
        "isAmbientOst": True,
        "subgenres": [
            {
                "id": "medieval_village_forest",
                "label": "Villas & Bosques Tranquilos",
                "prompt": "OST Ambiental & Exploración (Sin Voces) - Peaceful RPG Village & Forest, acoustic lute, wooden flute, soft pizzicato strings, purely instrumental, no vocals, 92 BPM G Major, warm nostalgic exploration atmosphere",
            },
            {
                "id": "mystic_dungeon_ruins",
                "label": "Dungeons & Ruinas Místicas",
                "prompt": "OST Ambiental & Exploración (Sin Voces) - Ancient Mystic Dungeon & Ruins, celesta, solo cello, ambient pad drones, purely instrumental, no vocals, 76 BPM D Dorian, mysterious cavernous exploration atmosphere",
            },
            {
                "id": "peaceful_menu_sanctuary",
                "label": "Menús Tranquilos & Santuarios",
                "prompt": "OST Ambiental & Exploración (Sin Voces) - Calm RPG Main Menu & Sanctuary, concert harp, soft felt piano, warm strings swell, purely instrumental, no vocals, 84 BPM E Minor, serene magical atmosphere",
            },
            {
                "id": "scifi_space_ambient",
                "label": "Exploración Espacial / Sci-Fi Ambient",
                "prompt": "OST Ambiental & Exploración (Sin Voces) - Sci-Fi Space Exploration Ambient, analog modular synth pad, crystalline bell arpeggio, deep sub drone, purely instrumental, no vocals, 80 BPM C Lydian, vast cosmic exploration",
            },
        ],
    },
    {
        "id": "synthwave_darksynth",
        "category": "cyberpunk",
        "tag": "Analog Racks",
        "title": "Synthwave & Darksynth",
        "description": "LinnDrum gated reverbs, bajos secuencias en sierra analógica, pads analógicos Roland Juno-106 con distorsión cinta.",
        "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuA1_7m4cb3eN-_q64O3AQpqTRVR7aR6yO9tXwXn470hoe1XqLmDCXh5uSeu-WmH15RI6Av7laLqU5rtWJBSX9WHFdpFrIJYLmWJ1qqJjU7vYKS8N-0uool1CbZJKndODZIWkrvMlEVxu9ZQs4T6NQ8rDYvzmvodWWCzbsgLVXa0G8TSGTVSUsMcuSNUgrefSdBnznvL7n78Pdg-uWgL8dVT64HGore1K5F92MjgiVg",
        "tuning": "Model: Oberheim OB-Xa",
        "bpm": "118 BPM",
        "presetName": "DARKSYNTH_ARPEGGIO_84",
        "isVideogame": False,
        "subgenres": [
            {
                "id": "80s_neon_drive",
                "label": "80s Neon Drive",
                "prompt": "Synthwave 80s Neon Drive, LinnDrum gated reverb snare, analog arpeggiated bassline, warm Juno-106 pads, nostalgic neon lead, 118 BPM",
            },
            {
                "id": "cyber_outrun",
                "label": "Cyber Outrun",
                "prompt": "Darksynth Cyber Outrun, aggressive sawtooth bass, dystopian brass synths, punchy retro-futuristic drums, 130 BPM",
            },
            {
                "id": "heavy_industrial",
                "label": "Heavy Industrial",
                "prompt": "Heavy Industrial Darksynth, distorted modular synths, metallic percussion, dark cyberpunk atmosphere, 136 BPM",
            },
        ],
    },
    {
        "id": "phonk_drift",
        "category": "trap",
        "tag": "Underground Bass",
        "title": "Phonk & Drift",
        "description": "Cowbells distorsionados Roland TR-808, acapellas picadas de Memphis rap en cinta gastada y sub-bajos aplastados.",
        "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuCdEtiPWr0CVMOZWv1IjyBNmg6jpD9u9KozVks_LRgRnThMYzGVD4HFxV0SRARILps4j4ycLdGrrfcQC3hEGzryerlPQgmHXo15uWE0mF9dDsdUWLQGYn2-33cxHUqhX2JHtq7zBlUkG6tUAR0ElQduOHG2cs73cN0BrvDp8Z9WvlqhzQRVACwX5vI3in4RZnjvFUUK0nyCt6tXIVG8hgh8sTomymh-KhrT4qLxV0I",
        "tuning": "Sidechain: Brutal",
        "bpm": "150 BPM",
        "presetName": "DRIFT_COWBELL_808",
        "isVideogame": False,
        "subgenres": [
            {
                "id": "brazilian_funk_phonk",
                "label": "Brazilian Funk Phonk",
                "prompt": "Brazilian Funk Phonk, distorted cowbell melody, heavy baile funk tamborzão percussion, crushed 808 sub bass, 150 BPM",
            },
            {
                "id": "memphis_drift",
                "label": "Memphis Drift",
                "prompt": "Memphis Drift Phonk, TR-808 cowbells, lo-fi tape saturation, chopped dark vocal samples, aggressive drift bass, 148 BPM",
            },
            {
                "id": "cyber_phonk",
                "label": "Cyber Phonk",
                "prompt": "Cyber Phonk, futuristic metallic cowbells, hard-hitting trap drums, dark reese bass and industrial textures, 155 BPM",
            },
        ],
    },
    {
        "id": "lofi_chillhop",
        "category": "lofi",
        "tag": "Late Night Tape",
        "title": "Lo-Fi & Coding Beats",
        "description": "Pianos Rhodes cálidos con vinilo crepitante, baterías boom-bap relajadas y texturas ambientales nocturnas.",
        "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuBd9vhW2Td4s2ruxgNcFyOQwnzZ7PzGOL86YfaKsK50HzouOblBPKP5IFTbNEFVFZCdyHRvUtg1l_eBxxT6L3AY-O_WFM-tMuVtVtPlaqGe08h6dSjznp7psWJjmQMCnllQzI1kbwp2dEkQ1gGgJR-RJCWwGpuAsxEuAIa435hG9Y7nHpxNAzIApJMjk0pZwG3GYNfK5O14VD0-4UwdZ1tyLdsDm_Uj3OwO8KxfVeo",
        "tuning": "Escala: Maj7 / Min9",
        "bpm": "82 BPM",
        "presetName": "LOFI_TAPE_WARMTH",
        "isVideogame": False,
        "subgenres": [
            {
                "id": "coding_night",
                "label": "Coding Night Beats",
                "prompt": "Lo-Fi Coding Night Beats, warm Fender Rhodes chords, vinyl crackle, dusty boom-bap drums, deep mellow sub bass, 82 BPM",
            },
            {
                "id": "cyber_rain_lofi",
                "label": "Cyberpunk Rain Lo-Fi",
                "prompt": "Cyberpunk Rain Lo-Fi, ambient synth pads, melancholic electric guitar, soft rain texture, chillhop beat, 78 BPM",
            },
        ],
    },
]


def load_studio_catalog() -> dict[str, Any]:
    """Load or initialize the global studio catalog (.studio_catalog.json)."""
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    if CATALOG_FILE.exists():
        try:
            data = json.loads(CATALOG_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                wf_presets = data.get("waveform_presets")
                if not wf_presets or not isinstance(wf_presets, list):
                    wf_presets = get_default_waveform_presets()

                creation_genres = data.get("creation_genres", DEFAULT_CREATION_GENRES)
                # Ensure the new Ambient OST card is auto-migrated into existing catalogs
                if isinstance(creation_genres, list):
                    existing_ids = {g.get("id") for g in creation_genres if isinstance(g, dict)}
                    if "musica_videojuegos" in existing_ids and "ost_ambiental_exploracion" not in existing_ids:
                        ambient_card = next(
                            (g for g in DEFAULT_CREATION_GENRES if g["id"] == "ost_ambiental_exploracion"),
                            None,
                        )
                        if ambient_card:
                            vg_idx = next(
                                (i for i, g in enumerate(creation_genres) if isinstance(g, dict) and g.get("id") == "musica_videojuegos"),
                                len(creation_genres) - 1,
                            )
                            creation_genres = list(creation_genres)
                            creation_genres.insert(vg_idx + 1, ambient_card)

                return {
                    "genre_tags": data.get("genre_tags", DEFAULT_GENRE_TAGS),
                    "creation_categories": data.get("creation_categories", DEFAULT_CREATION_CATEGORIES),
                    "creation_genres": creation_genres,
                    "waveform_presets": wf_presets,
                }
        except Exception:
            pass

    default_catalog = {
        "genre_tags": list(DEFAULT_GENRE_TAGS),
        "creation_categories": list(DEFAULT_CREATION_CATEGORIES),
        "creation_genres": list(DEFAULT_CREATION_GENRES),
        "waveform_presets": get_default_waveform_presets(),
    }
    save_studio_catalog(default_catalog)
    return default_catalog


def save_studio_catalog(catalog: dict[str, Any]) -> dict[str, Any]:
    """Persist the studio catalog to PROJECTS_DIR / .studio_catalog.json."""
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    clean_tags: list[str] = []
    seen_lower: set[str] = set()
    for t in catalog.get("genre_tags", []):
        val = str(t).strip()
        if val and val.lower() not in seen_lower:
            seen_lower.add(val.lower())
            clean_tags.append(val)

    wf_presets = catalog.get("waveform_presets")
    if not wf_presets or not isinstance(wf_presets, list):
        wf_presets = get_default_waveform_presets()

    payload = {
        "genre_tags": clean_tags,
        "creation_categories": catalog.get("creation_categories", DEFAULT_CREATION_CATEGORIES),
        "creation_genres": catalog.get("creation_genres", DEFAULT_CREATION_GENRES),
        "waveform_presets": wf_presets,
    }
    CATALOG_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return payload


def register_genre_tags(new_tags: list[str]) -> list[str]:
    """Ensure any newly used genre tags on a song are added to the global reusable catalog."""
    if not new_tags:
        return load_studio_catalog()["genre_tags"]
    cat = load_studio_catalog()
    existing = cat.get("genre_tags", [])
    seen = {t.lower() for t in existing}
    changed = False
    for tag in new_tags:
        clean = str(tag).strip()
        if clean and clean.lower() not in seen:
            existing.append(clean)
            seen.add(clean.lower())
            changed = True
    if changed:
        cat["genre_tags"] = existing
        save_studio_catalog(cat)
    return existing


