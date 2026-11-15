# Diryan's Music Factory — Agent Guidelines & Instructions

Bienvenido a las directrices para agentes de IA en el repositorio de **Diryan's Music Factory**.
Este archivo centraliza las reglas de desarrollo y delega a archivos especializados en `./agents/` para cada área del proyecto.

Cualquier agente que trabaje en una tarea específica **DEBE leer y seguir estrictamente las instrucciones en el archivo `.md` correspondiente** antes de generar código o contenido.

---

## 1. Generación de archivo Data.txt para los metadatos sociales
Para la generación, formateo y regeneración del archivo `Data.txt` y metadatos para redes sociales, siempre lee y sigue las instrucciones en el archivo:
👉 **`./agents/metadatos-video.md`**

### Reglas esenciales resumidas:
- **Cero palabras en inglés**: Todos los encabezados, secciones y metadatos se generan exclusivamente en español (nunca uses `TITLE:`, `DESCRIPTION:`, `TAGS:`, `CAPTION:`, `SONG:`).
- **Emojis en cada sección**: Todos los títulos de sección deben incluir emojis (ejemplo: `📌 Título:`, `📝 Descripción:`, `🎵 Letra:`, `🏷️ Etiquetas (YouTube Studio, separadas por comas):`, `🏷️ Hashtags:`).
- **Letra obligatoria**: Si el proyecto cuenta con letra (`lyrics` o `02_lyrics.txt`), SIEMPRE debe agregarse completa en `Data.txt` bajo `🎵 Letra:`.
- **Créditos oficiales invariables**:
  ```text
  🎧 Créditos: Música de la 403 Forbiden
  Producción: Diryan's Factory Music
  ```
- **Separadores obligatorios (44 caracteres `═`)**:
  ```text
  ════════════════════════════════════════════
  🎬 YOUTUBE
  ════════════════════════════════════════════

  ════════════════════════════════════════════
  📱 TIKTOK
  ════════════════════════════════════════════
  ```

---

## 2. Composición visual y generación de imágenes de fondo
Para la creación de prompts de imagen, requisitos de encuadre y generación del fondo (`03_background.png`), siempre lee y sigue las instrucciones en el archivo:
👉 **`./agents/visual-composition.md`** (complementado por `./rules/visual_rules.md`)

### Reglas esenciales resumidas:
- **Compatibilidad 16:9 y 9:16 vertical**: Toda imagen generada en 16:9 DEBE tener sus sujetos y puntos de interés centrados en la zona segura central, de modo que al recortarse al formato 9:16 (TikTok, Reels, Shorts) se vea completa y equilibrada sin cortar personajes ni acción importante.
- **Tercio inferior despejado**: El 25% inferior debe ser oscuro, limpio y sin elementos distractores para permitir la visualización nítida de la forma de onda de audio.
- **Sin texto incrustado**: Nunca pedir al modelo de imagen que genere texto, marcas de agua ni títulos dentro de la imagen.

---

## 3. Formas de onda y renderizado de video
Para algoritmos de renderizado de visualizadores de audio, fidelidad visual y efectos de movimiento, siempre lee y sigue las instrucciones en el archivo:
👉 **`./agents/waveforms-rendering.md`** (complementado por `./rules/motion_rules.md`)

### Reglas esenciales resumidas:
- **La previsualización es la verdad absoluta**: El comportamiento y estética del lienzo interactivo en `frontend/src/components/WaveformPreviewCanvas.jsx` es la fuente de verdad. El video final en `video/renderer.py` debe reflejarlo fielmente.
- **Sine Wave Ribbons (`flowing_ribbons`)**: Cuatro cintas sinusoidales suaves con relleno al fondo al 8% de opacidad y trazo brillante difuso, réplica 1:1 de la previsualización.
- **3D Particle Waves (`particle_waves`)**: Campo ondulatorio 3D limpio. Quedan **prohibidos los puntos dispersos como luciérnagas flotantes** (`_BOKEH_ORBS`).

---

## 4. Letras de canciones, estructura y fonética
Para la generación, rima y fonética en español de las canciones, siempre lee y sigue las instrucciones en el archivo:
👉 **`./agents/lyrics-rules.md`** (complementado por `./rules/lyrics_rules.md`)

### Reglas esenciales resumidas:
- **Estructura estricta de 7 secciones**: `[Intro]`, `[Verso 1]`, `[Verso 2]`, `[Coro]`, `[Verso 3]`, `[Coro]`, `[Outro]`, con un máximo de 4 líneas por sección.
- **Menciones obligatorias en Intro**: *"Música de la cuatro cero tres"* y *"Corridos en ache-te-eme-ele"*.
- **Fonética en español para términos técnicos**: Escribir términos en inglés como suenan en español con tildes (ej. `bac-end`, `ese-cu-ele`, `pi-pi-ay`, `deplóy`, `git-job`, `yábascript`, `dóquer`).

