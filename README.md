# 🎶 Diryan's Factory Music — Web Studio

**AI-Driven Music Video Generator with Audio-Reactive Visual Overlays & Futuristic Web Studio**

[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Tailwind-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Powered by Gemini](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev)
[![Powered by Claude](https://img.shields.io/badge/AI-Claude%203.5%20Sonnet-blueviolet)](https://anthropic.com)

---

## 🚀 ¿Qué es Diryan's Factory Music Web Studio?

**Diryan's Factory Music** es una aplicación web de estudio local que transforma ideas de canciones en videos musicales completos con overlays reactivos al beat. La creación y gestión de proyectos se realiza a través de su **Web Studio interactivo** en el navegador (`http://127.0.0.1:8000`).

Describes un concepto y género musical: la app redacta la letra estructurada en 7 secciones, genera el prompt optimizado para Suno AI, genera una carátula cinematográfica con Imagen 3 o DALL-E 3, recibe tu archivo MP3 descargado de Suno y renderiza localmente videos en 16:9 y 9:16 vertical con aceleración por GPU (AMD AMF o CPU libx264).

---

## 🌟 Características Principales

| Característica | Detalle |
|---|---|
| 🌐 **Web Studio Futurista** | Interfaz visual estilo Sci-Fi HUD inspirada en terminales espaciales limpias, con animaciones fluidas y navegación por URL (`?project=...`). |
| 🗂️ **Organización por Playlists** | Crea, renombra y elimina playlists. Al eliminar una playlist, las canciones no se pierden, se conservan en la raíz. |
| 📺 **Dashboard Estilo YouTube** | Tarjetas rectangulares amplias 16:9, menú de 3 puntos interactivo para reasignar playlists y barra de tags de filtro centrada (`Todos`, `Completados`, `Listos para Render`, `Esperando Audio`, etc.). |
| 🎛️ **Dual AI Provider** | Gemini (todo en uno con Gemini Flash + Imagen 3) o Anthropic (Claude 3.5 Sonnet + DALL·E 3). |
| 📝 **Letras & Prompt Suno** | Letras estructuradas (`[Intro]`, `[Verso]`, `[Coro]`, `[Outro]`), prompt musical para Suno AI sin nombres de marcas ni artistas reales (1 clic para copiar) y copy para YouTube/TikTok. |
| 🖼️ **Arte de Fondo en Alta Resolución** | Generado con IA o sube tu propia imagen personalizada. |
| 🎵 **Subida Inteligente de Audio** | Drag & drop con modal de confirmación: nombra el archivo según el título de la canción (`<Titulo>.mp3`), conserva el original o escribe un nombre personalizado. |
| 🌊 **Showcase de Formas de Onda** | Selector compacto con carrusel a la izquierda y visor de ejemplo en lienzo translúcido a la derecha (10 estilos: *Capsule Bars*, *Dot Matrix*, *Neon Ladder*, *Center Soundwave*, *Sine Ribbons*, *Particle Waves*, etc.). |
| 📱 **Formato 9:16 Opcional** | Renderiza 16:9 y 9:16 juntos o deriva la versión vertical 9:16 a demanda en **segundos** desde el 16:9 existente mediante FFmpeg. |
| ⚡ **Progreso en Vivo (SSE)** | Transmisión fotograma a fotograma en tiempo real con FPS y porcentaje de avance. |
| 🔒 **Confirmación de Seguridad** | Diálogo de seguridad obligatorio que solicita escribir `"Eliminar"` para borrar cualquier proyecto o playlist. |

---

## 🛠️ Requisitos Previos

1. **Python 3.11 o superior**
2. **FFmpeg** instalado en el `PATH` del sistema.
3. *(Opcional)* **Controlador AMD Radeon** para aceleración de hardware `h264_amf`.

---

## 📦 Instalación

```powershell
# 1 — Clonar o navegar a la carpeta del proyecto
cd "c:\Users\t18\Documents\personal\Diryan's Music Factory"

# 2 — Activar entorno virtual
.\.venv\Scripts\Activate.ps1

# 3 — Instalar dependencias
pip install -r requirements.txt
```

---

## 🔑 Claves de API (`.env`)

Crea un archivo `.env` en la raíz del proyecto con tus credenciales:

```env
# Modo Gemini (Recomendado)
GEMINI_API_KEY=tu_clave_aqui

# Modo Anthropic + OpenAI (Opcional)
ANTHROPIC_API_KEY=tu_clave_aqui
OPENAI_API_KEY=tu_clave_aqui
```

---

## 🎬 Cómo Iniciar la Aplicación

Puedes iniciar el Web Studio de cualquiera de las siguientes formas:

### Opción 1: Script de Inicio Rápido (Recomendado en Windows)
Haz doble clic sobre el archivo:
```
start_web.bat
```

### Opción 2: Desde la Terminal
```powershell
python main.py
# o también:
python run_web.py
```

El servidor iniciará en **`http://127.0.0.1:8000`** y abrirá automáticamente tu navegador web por defecto.

---

## 🧪 Pruebas Automatizadas

El proyecto cuenta con una suite completa de pruebas unitarias y de integración:

```powershell
pytest tests/
```
