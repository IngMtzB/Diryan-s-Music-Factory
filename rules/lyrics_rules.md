# Reglas de Letra, Estructura y Estilos Musicales

## 1. ESTILOS / TAGS MUSICALES (Suno / Udio)
- Traduce el estilo musical base a tags genéricos y descriptivos para la IA generadora de música.
- **REGLA DE COPYRIGHT (ESTRICTA)**: Está **estrictamente prohibido** usar nombres de artistas reales o marcas registradas (ej. Peso Pluma, Xavi, Natanael Cano, Junior H, Fuerza Regida, etc.).
- Si el usuario menciona o pide el estilo de un artista, deduce sus características musicales y escribe los tags correspondientes (ej. *"corridos tumbados, requinto rápido, tololoche, brass, trompetas belicas, voz masculina rasposa, sierreño, bajo quinto, percusión acústica"*).

## 2. ESTRUCTURA EXACTA DE LA CANCIÓN
La letra DEBE seguir obligatoriamente esta estructura y nombres de sección:

```
[Intro]
[Verso 1]
[Verso 2]
[Coro]
[Verso 3]
[Coro]
[Outro]
```

### Reglas de Estrofas y Líneas (Crucial para el modelo de voz)
- **Estructura corta**: Cada sección (intro, versos, coros, outro) **NO DEBE TENER MÁS DE 4 LÍNEAS**. Esto es indispensable para que el modelo de voz de Suno/Udio no se sature ni corte frases.
- **Rima rica**: Prohibido usar rimas pobres o repetir la misma palabra al final del verso (ej. NO rimes "trabajando aquí" con "sigues aquí"). Usa esquemas AABB o ABAB con consonantes o asonantes ricas.

### Fonética para la IA (Términos en Inglés)
- Escribe los términos técnicos en inglés **exactamente como se deben pronunciar en español** para que el modelo de voz los cante con perfecta dicción:
  - Ejemplos: `bac-end` (backend), `fron-end` (frontend), `ese-cu-ele` (SQL), `pi-pi-ay` o `a-pi` (API), `deplóy` (deploy), `git-job` (GitHub), `yábascript` (JavaScript), `paiton` (Python), `dóquer` (Docker), `bóg` (bug), `claúd` (cloud), `cúbernetes` (Kubernetes), `servér` (server).

### Menciones Obligatorias
En el `[Intro]`, DEBES incluir obligatoriamente las siguientes dos frases escritas exactamente así:
- `"Música de la cuatro cero tres"`
- `"Corridos en ache-te-eme-ele"`

Ejemplo de [Intro] válido (máximo 4 líneas):
```
[Intro]
Compa, súbale al requinto y prenda la consola,
Música de la cuatro cero tres,
Corridos en ache-te-eme-ele pa' que suene recio,
¡Puro código bélico, viejo!
```

## 3. HASHTAGS
- Genera 5 hashtags contextuales sobre la temática técnica de la canción (ej. `#Programacion #Developer #Backend #SoftwareEngineer #DevLife`).
- Incluye **SIEMPRE al final** estos dos hashtags obligatorios: `#corridosenhtml #musicadela403`.
