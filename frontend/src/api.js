/**
 * frontend/src/api.js — Client API layer for Diryan's Music Factory Web Studio.
 */

const BASE_URL = '/api';

export async function fetchPlaylists() {
  const res = await fetch(`${BASE_URL}/playlists`);
  if (!res.ok) throw new Error('Error al cargar playlists');
  return res.json();
}

export async function createPlaylist(name) {
  const res = await fetch(`${BASE_URL}/playlists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Error al crear playlist');
  return res.json();
}

export async function renamePlaylist(oldName, newName) {
  const res = await fetch(`${BASE_URL}/playlists/${encodeURIComponent(oldName)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_name: newName }),
  });
  if (!res.ok) throw new Error('Error al renombrar playlist');
  return res.json();
}

export async function deletePlaylist(name) {
  const res = await fetch(`${BASE_URL}/playlists/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Error al eliminar playlist');
  return res.json();
}

export async function moveProject(relPath, targetPlaylist) {
  const res = await fetch(`${BASE_URL}/playlists/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rel_path: relPath, target_playlist: targetPlaylist }),
  });
  if (!res.ok) throw new Error('Error al mover proyecto');
  return res.json();
}

export async function fetchCatalog() {
  const res = await fetch(`${BASE_URL}/projects/catalog`);
  if (!res.ok) throw new Error('Error al cargar catálogo de géneros');
  return res.json();
}

export async function updateCatalog(catalogData) {
  const res = await fetch(`${BASE_URL}/projects/catalog`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(catalogData),
  });
  if (!res.ok) throw new Error('Error al actualizar catálogo de géneros');
  return res.json();
}

export async function resetWaveformCatalog() {
  const res = await fetch(`${BASE_URL}/projects/catalog/reset-waveforms`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Error al restaurar formas de onda');
  return res.json();
}

export async function fetchAiConfig() {
  const res = await fetch(`${BASE_URL}/generate/config`);
  if (!res.ok) throw new Error('Error al cargar configuración de IA');
  return res.json();
}

export async function fetchProjects({ playlist, status, genre, q } = {}) {
  const params = new URLSearchParams();
  if (playlist) params.set('playlist', playlist);
  if (status) params.set('status', status);
  if (genre) params.set('genre', genre);
  if (q) params.set('q', q);

  const res = await fetch(`${BASE_URL}/projects?${params.toString()}`);
  if (!res.ok) throw new Error('Error al cargar proyectos');
  return res.json();
}

export async function fetchProject(path) {
  const res = await fetch(`${BASE_URL}/projects/${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error('Error al cargar proyecto');
  return res.json();
}

export async function createProject({ concept, style, playlist, provider, genre_tags, signal }) {
  const res = await fetch(`${BASE_URL}/projects/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ concept, style, playlist, provider, genre_tags }),
    signal,
  });
  if (!res.ok) throw new Error('Error al crear proyecto');
  return res.json();
}

export async function updateSpec(path, specData) {
  const res = await fetch(`${BASE_URL}/projects/${encodeURIComponent(path)}/spec`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(specData),
  });
  if (!res.ok) throw new Error('Error al guardar especificación');
  return res.json();
}

export async function updateLyrics(path, content) {
  const res = await fetch(`${BASE_URL}/projects/${encodeURIComponent(path)}/lyrics`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('Error al guardar letras');
  return res.json();
}

export async function updateDataFile(path, content) {
  const res = await fetch(`${BASE_URL}/projects/${encodeURIComponent(path)}/data`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('Error al guardar metadatos');
  return res.json();
}

export async function uploadAudio(path, file, { mode = 'title', customName = '' } = {}) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mode', mode);
  if (customName) formData.append('custom_name', customName);

  const res = await fetch(`${BASE_URL}/projects/${encodeURIComponent(path)}/upload-audio`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Error al subir archivo de audio');
  return res.json();
}

export async function uploadImage(path, file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BASE_URL}/projects/${encodeURIComponent(path)}/upload-image`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Error al subir carátula');
  return res.json();
}

export async function deleteProject(path) {
  const res = await fetch(`${BASE_URL}/projects/${encodeURIComponent(path)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Error al eliminar proyecto');
  return res.json();
}

export async function openProjectFolder(path) {
  const res = await fetch(`${BASE_URL}/projects/${encodeURIComponent(path)}/open-folder`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al abrir carpeta en el explorador');
  }
  return res.json();
}

export async function extractPalette(path) {
  const res = await fetch(`${BASE_URL}/projects/${encodeURIComponent(path)}/palette`);
  if (!res.ok) throw new Error('Error al extraer paleta');
  return res.json();
}

export async function generateSpec({ relPath, concept, style, provider, existingLyrics, existingStyles, signal }) {
  const res = await fetch(`${BASE_URL}/generate/spec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rel_path: relPath,
      concept,
      style,
      provider,
      existing_lyrics: existingLyrics,
      existing_styles: existingStyles,
    }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al generar spec con IA');
  }
  return res.json();
}

export async function generateImage({ relPath, prompt, provider, signal }) {
  const res = await fetch(`${BASE_URL}/generate/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rel_path: relPath, prompt, provider }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al generar fondo con IA');
  }
  return res.json();
}

export async function generateData({ relPath, provider, lyrics, signal }) {
  const res = await fetch(`${BASE_URL}/generate/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rel_path: relPath, provider, lyrics }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al regenerar Data.txt');
  }
  return res.json();
}

export async function startRender(path, { customSpec, render16x9 = true, render9x16 = false }) {
  const res = await fetch(`${BASE_URL}/render/${encodeURIComponent(path)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      custom_spec: customSpec,
      render_16x9: render16x9,
      render_9x16: render9x16,
      name_mode: 'title',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al iniciar renderizado');
  }
  return res.json();
}

export async function crop9x16(path) {
  const res = await fetch(`${BASE_URL}/render/${encodeURIComponent(path)}/crop-9x16`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al derivar video 9:16');
  }
  return res.json();
}

export function getAudioUrl(path, version) {
  const vParam = version ? `?v=${version}` : '';
  return `${BASE_URL}/media/${encodeURIComponent(path)}/audio${vParam}`;
}

export function getImageUrl(path, version) {
  const vParam = version ? `?v=${version}` : '';
  return `${BASE_URL}/media/${encodeURIComponent(path)}/image${vParam}`;
}

export function getVideo16x9Url(path, version) {
  const vParam = version ? `?v=${version}` : '';
  return `${BASE_URL}/media/${encodeURIComponent(path)}/video-16x9${vParam}`;
}

export function getVideo9x16Url(path, version) {
  const vParam = version ? `?v=${version}` : '';
  return `${BASE_URL}/media/${encodeURIComponent(path)}/video-9x16${vParam}`;
}

