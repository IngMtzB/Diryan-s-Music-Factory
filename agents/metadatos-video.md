# Video Metadata & Social Copy Rules (Data.txt)

> **Agent Instruction**: This rulebook defines the exact specifications for generating social metadata, descriptions, and the `Data.txt` file for video releases across YouTube and TikTok.
> **Language Rule**: Although these agent instructions are written in English, all generated content, section labels, headings, and descriptions for `Data.txt` **MUST BE IN SPANISH**. Never use English words for section headers or labels.

---

## 1. Zero English Labels Policy

Never use English labels or section names in `Data.txt`.
- ❌ **FORBIDDEN**: `TITLE:`, `DESCRIPTION:`, `TAGS:`, `CAPTION:`, `SONG:`, `LYRICS:`, `CREDITS:`.
- ✅ **MANDATORY**: Use the Spanish equivalents with emojis shown below.

---

## 2. Section Header Emojis

Every section header and subsection in `Data.txt` must start with an appropriate emoji:

| Field / Section | Mandatory Spanish Label | Notes |
|---|---|---|
| Song Title Header | `🎵 Canción: <Title>` | Optional top header |
| YouTube Title | `📌 Título:` | Engaging, max 100 characters |
| YouTube Description | `📝 Descripción:` | Hook, story, lyrics, credits, CTA, tags |
| Lyrics (within Description) | `🎵 Letra:` | Full song lyrics |
| Credits (within Description) | `🎧 Créditos:` | Exact mandatory format below |
| YouTube Studio Tags | `🏷️ Etiquetas (YouTube Studio, separadas por comas):` | Max 500 chars, comma-separated |
| TikTok Description | `📝 Descripción:` | Short, punchy, viral caption |
| TikTok Hashtags | `🏷️ Hashtags:` | 3 contextual + 2 brand hashtags |

---

## 3. Mandatory Separators

Section headers for platforms MUST strictly use 44 double-line box-drawing characters (`═` × 44):

```text
════════════════════════════════════════════
🎬 YOUTUBE
════════════════════════════════════════════
```

```text
════════════════════════════════════════════
📱 TIKTOK
════════════════════════════════════════════
```

---

## 4. Mandatory Credits Format

The credits in the description must ALWAYS be formatted exactly as:

```text
🎧 Créditos: Música de la 403 Forbiden
Producción: Diryan's Factory Music
```

If musical genre metadata is present, it may follow as:
`Género: <genre>`

---

## 5. Mandatory Lyrics Inclusion

Whenever song lyrics exist (in the spec dictionary or in `02_lyrics.txt`), they **MUST ALWAYS** be included in `Data.txt` under `🎵 Letra:`. Never omit the lyrics when generating or regenerating `Data.txt`.

Structure of YouTube Description:
1. Hook (1–2 punchy lines above "Show more").
2. Story / Track synopsis.
3. `🎵 Letra:` followed by the complete lyrics.
4. `🎧 Créditos: Música de la 403 Forbiden`\n`Producción: Diryan's Factory Music`.
5. Call to action (subscribe, bell, comments).
6. Hashtags.

---

## 6. Hashtag Requirements

1. **YouTube**:
   - 5 contextual technical hashtags matching the specific programming topic (e.g., `#DevOps #Kubernetes #Docker #Backend #Cloud`).
   - Followed ALWAYS at the end by the 2 mandatory brand hashtags: `#corridosenhtml #musicadela403`.

2. **TikTok**:
   - Top 3 contextual hashtags + the 2 mandatory brand hashtags:
   - Example: `#Programacion #Developer #TechLife #corridosenhtml #musicadela403`.

---

## 7. Complete Reference Template

```text
🎵 Canción: El Último Deploy

════════════════════════════════════════════
🎬 YOUTUBE
════════════════════════════════════════════

📌 Título:
El Último Deploy | Electro Corrido Tumbado (Letra)

📝 Descripción:
Cuando tiras a producción un viernes a las 7 PM y la base de datos no levanta. 💀

Una crónica bélica al ritmo de corridos tumbados con requintos eléctricos y sintetizadores...

🎵 Letra:
[Intro]
Música de la cuatro cero tres,
Corridos en ache-te-eme-ele...

[Verso 1]
...

🎧 Créditos: Música de la 403 Forbiden
Producción: Diryan's Factory Music
Género: Electro corrido tumbado

🔔 Suscríbete y activa la campanita para más corridos en HTML. Comenta qué tecnología quieres en la próxima canción.

#DevOps #Docker #Backend #Sysadmin #Cloud #corridosenhtml #musicadela403

🏷️ Etiquetas (YouTube Studio, separadas por comas):
El Último Deploy, Electro corrido tumbado, corridos en html, musica de la 403, Diryan's Factory Music, docker, devops, deploy viernes

════════════════════════════════════════════
📱 TIKTOK
════════════════════════════════════════════

📝 Descripción:
Cuando haces deploy en viernes y se cae producción a las 7 PM 💀🚀

🏷️ Hashtags:
#DevOps #Docker #Backend #corridosenhtml #musicadela403
```

