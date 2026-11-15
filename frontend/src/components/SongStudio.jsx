import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  getImageUrl,
  getAudioUrl,
  getVideo16x9Url,
  getVideo9x16Url,
  updateSpec,
  updateLyrics,
  updateDataFile,
  generateSpec,
  generateImage,
  generateData,
  extractPalette,
  uploadImage,
  startRender,
  crop9x16,
  openProjectFolder,
  resetWaveformCatalog,
} from '../api';
import WaveformPreviewCanvas from './WaveformPreviewCanvas';
import WaveDesignerModal from './WaveDesignerModal';
import EpicLoader from './EpicLoader';
import {
  GENRE_CATEGORIES,
  GENRE_CARDS,
  findGenreFromStyle,
  parseDataTxtFields,
} from '../constants/genres';
import {
  DEFAULT_WAVEFORM_PRESETS,
  resolveWaveformPreset,
} from '../constants/waveforms';

const WAVEFORM_STYLES = [
  {
    id: 'rounded_mirror',
    name: 'CAPSULE BARS & REFLECTION',
    desc: 'Barras cápsula con reflejo de agua [Limpio y moderno]',
  },
  {
    id: 'dot_matrix',
    name: 'LED DOT MATRIX',
    desc: 'Matriz de puntos LED tipo concierto y festival rave',
  },
  {
    id: 'neon_ladder',
    name: 'NEON LADDER',
    desc: 'Escalera segmentada con brillo neon volumétrico 3D',
  },
  {
    id: 'center_symmetrical',
    name: 'CENTER SOUNDWAVE',
    desc: 'Onda simétrica central de doble cara con gradiente dinámico',
  },
  {
    id: 'flowing_ribbons',
    name: 'SINE WAVE RIBBONS',
    desc: 'Listones fluidos continuos de ondas senoidales suaves',
  },
  {
    id: 'particle_waves',
    name: '3D PARTICLE WAVES',
    desc: 'Campo ondulatorio 3D limpio reactivo a frecuencias',
  },
  {
    id: 'sharp_spikes',
    name: 'CYBER SPIKES',
    desc: 'Picos poligonales afilados estilo EDM Trap',
  },
  {
    id: 'mirrored_bars',
    name: 'CLASSIC MIRROR',
    desc: 'Barras clásicas espejadas (Bajos al centro)',
  },
  {
    id: 'frequency_bars',
    name: 'FREQUENCY BARS',
    desc: 'Barras clásicas de izquierda a derecha',
  },
  {
    id: 'none',
    name: 'CLEAN (SIN WAVEFORM)',
    desc: 'Solo cámara shake y pulso de brillo reactivo',
  },
];

const PALETTE_PRESETS = [
  { id: 'sunset', name: 'Sunset Fire', colors: ['#FF1744', '#FF6D00', '#FFD600'] },
  { id: 'cyberpunk', name: 'Synthwave Neon', colors: ['#00F0FF', '#B000FF', '#FF2A55'] },
  { id: 'pastel', name: 'Pastel Horizon', colors: ['#FFE66D', '#4ECDC4', '#7B2CBF', '#FF6B6B'] },
  { id: 'studio', name: 'Studio Peak', colors: ['#00E676', '#FFD600', '#FF1744'] },
  { id: 'gold', name: 'Gold & Amber', colors: ['#FFDF00', '#FF8C00'] },
  { id: 'ice', name: 'Glacier Ice', colors: ['#00FFFF', '#FFFFFF'] },
];

// Deterministic waveform heights for the Audio Ingestion Deck player bar
const DECK_WAVEFORM_HEIGHTS = [
  3, 5, 8, 4, 9, 12, 7, 10, 11, 6, 12, 10, 8, 11, 5, 9, 12, 7, 10, 6, 4, 8, 11, 5, 3, 6, 10, 12, 9,
  4, 7, 11, 5, 3, 7, 10, 8, 6, 9, 5,
];

function CopyButton({
  textToCopy,
  label = 'Copiar',
  copiedLabel = '¡Copiado!',
  className = '',
  iconSize = 'text-[14px]',
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(textToCopy || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`transition-all cursor-pointer flex items-center justify-center gap-1 ${className}`}
    >
      <span className={`material-symbols-outlined ${iconSize}`}>
        {copied ? 'check' : 'content_copy'}
      </span>
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
}

/**
 * Renders structured lyrics with stylized section headers like example.html
 */
function FormattedLyricsPreview({ lyrics }) {
  if (!lyrics || !lyrics.trim()) {
    return (
      <div className="py-12 text-center text-on-surface-variant font-body-sm text-body-sm">
        No hay letra generada todavía. Haz clic en <strong>Re-escribir Letra</strong> o{' '}
        <strong>Re-calibrar Prompt</strong> para generarla con IA.
      </div>
    );
  }

  // Split by blank lines into stanzas
  const blocks = lyrics.trim().split(/\n\s*\n/);

  return (
    <div className="space-y-space-md text-on-surface font-body-md text-body-md leading-relaxed">
      {blocks.map((block, idx) => {
        const lines = block.split('\n');
        const firstLine = lines[0]?.trim() || '';
        const isSectionHeader = firstLine.startsWith('[') && firstLine.endsWith(']');
        const headerText = isSectionHeader ? firstLine : null;
        const bodyLines = isSectionHeader ? lines.slice(1) : lines;

        const isChorusOrClimax =
          headerText &&
          /coro|chorus|climax|main theme/i.test(headerText);
        const isIntroOrOutro =
          headerText && /intro|outro|end|break|bridge/i.test(headerText);

        return (
          <div key={idx} className="space-y-1">
            {headerText && (
              <span
                className={`font-label-sm text-label-sm uppercase tracking-widest font-bold block ${
                  isChorusOrClimax
                    ? 'text-secondary'
                    : isIntroOrOutro
                    ? 'text-primary-container'
                    : 'text-primary-fixed'
                }`}
              >
                {headerText}
              </span>
            )}
            <div className={isChorusOrClimax ? 'font-semibold text-primary space-y-0.5' : 'space-y-0.5'}>
              {bodyLines.map((line, lIdx) => {
                const trimmed = line.trim();
                const isMetaOrChoir =
                  (trimmed.startsWith('(') && trimmed.endsWith(')')) ||
                  (trimmed.startsWith('[') && trimmed.endsWith(']'));
                return (
                  <p
                    key={lIdx}
                    className={
                      isMetaOrChoir
                        ? 'text-on-surface-variant italic font-body-sm text-body-sm'
                        : ''
                    }
                  >
                    {line}
                  </p>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SongStudio({
  project,
  playlists = [],
  catalog,
  onUpdateCatalog,
  theme = 'dark',
  onToggleTheme,
  onOpenSettings,
  onBack,
  onMovePlaylist,
  onOpenUploadAudio,
  onTriggerRenderModal,
  onRefreshProject,
}) {
  // Two main views matching example.html: 'wizard' (1. GENRE & AI LYRICS) and 'render-studio' (2. AUDIO HUB & 3. RENDER STUDIO)
  const [activeView, setActiveView] = useState('wizard');

  // Dynamic Catalog from Settings (with fallback to defaults)
  const genreCategories = catalog?.creation_categories?.length
    ? catalog.creation_categories
    : GENRE_CATEGORIES;
  const genreCards = catalog?.creation_genres?.length
    ? catalog.creation_genres
    : GENRE_CARDS;
  const availableGenreTags = catalog?.genre_tags || [];
  const waveformPresets = catalog?.waveform_presets?.length
    ? catalog.waveform_presets
    : DEFAULT_WAVEFORM_PRESETS;

  // Project core fields
  const [title, setTitle] = useState(project.title || '');
  const [concept, setConcept] = useState(project.concept || '');
  const [stylePrompt, setStylePrompt] = useState(project.style || '');
  const [sunoStyles, setSunoStyles] = useState(project.styles_text || '');
  const [lyrics, setLyrics] = useState(project.lyrics_text || '');
  const [dataText, setDataText] = useState(project.data_text || '');
  const [imagePrompt, setImagePrompt] = useState(project.spec?.image_prompt || '');
  const [provider, setProvider] = useState(project.provider || 'gemini');
  const [genreTags, setGenreTags] = useState(
    Array.isArray(project.genre_tags) ? project.genre_tags : []
  );
  const [newGenreTagInput, setNewGenreTagInput] = useState('');

  // Genre Matrix state + Dedicated Page toggle for "1. Selecciona Género & Sub-género Visual"
  const initialGenreMatch = useMemo(
    () => findGenreFromStyle(project.style || project.styles_text || ''),
    [project.style, project.styles_text]
  );
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedGenreId, setSelectedGenreId] = useState(initialGenreMatch.card.id);
  const [selectedSubgenreId, setSelectedSubgenreId] = useState(initialGenreMatch.subgenre.id);
  const [customSubgenreMap, setCustomSubgenreMap] = useState({});
  const [editingCustomFor, setEditingCustomFor] = useState(null);
  const [isSelectingGenrePage, setIsSelectingGenrePage] = useState(false);

  // Studio UI toggles
  const [showImagePromptEditor, setShowImagePromptEditor] = useState(false);
  const [isFullscreenArt, setIsFullscreenArt] = useState(false);
  const [lyricsEditMode, setLyricsEditMode] = useState(false); // false = Formatted Preview (example.html), true = Raw Textarea
  const [socialTab, setSocialTab] = useState('youtube'); // 'youtube' | 'tiktok' | 'raw'

  // Render configuration
  const specWf = project.spec?.render_spec?.waveform || {};
  const specMotion = project.spec?.render_spec?.motion_effects || {};

  const [waveformStyle, setWaveformStyle] = useState(specWf.style || 'center_symmetrical');
  const [waveformParams, setWaveformParams] = useState(specWf.params || null);
  const [isWaveDesignerOpen, setIsWaveDesignerOpen] = useState(false);
  const [primaryColor, setPrimaryColor] = useState(specWf.primary_color || '#00F0FF');
  const [secondaryColor, setSecondaryColor] = useState(specWf.secondary_color || '#FF2A55');
  const [colorMode, setColorMode] = useState(specWf.color_mode || 'horizontal');
  const [paletteColors, setPaletteColors] = useState(
    specWf.palette_colors || ['#00F0FF', '#FF2A55']
  );
  const [shakeIntensity, setShakeIntensity] = useState(specMotion.shake_intensity_px ?? 6);
  const [bgPulse, setBgPulse] = useState(specMotion.background_pulse ?? true);

  // Video output formats (both 16:9 and 9:16 checked by default per example.html)
  const [render16x9, setRender16x9] = useState(true);
  const [render9x16, setRender9x16] = useState(true);

  // Loading & feedback states
  const [saving, setSaving] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState('AUTO-SAVE SYNCED');
  const [generatingSpec, setGeneratingSpec] = useState(false);
  const [generatingArt, setGeneratingArt] = useState(false);
  const [generatingDataState, setGeneratingDataState] = useState(false);
  const [extractingPaletteState, setExtractingPaletteState] = useState(false);
  const [cropping9x16State, setCropping9x16State] = useState(false);
  const [bannerNotice, setBannerNotice] = useState('');

  // Media cache-busting versions
  const [audioVersion, setAudioVersion] = useState(1);
  const [imageVersion, setImageVersion] = useState(1);

  // Audio Player State
  const audioRef = useRef(null);
  const audioSectionRef = useRef(null);
  const renderSectionRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.75);

  useEffect(() => {
    setTitle(project.title || '');
    setConcept(project.concept || '');
    setStylePrompt(project.style || '');
    setSunoStyles(project.styles_text || '');
    setLyrics(project.lyrics_text || '');
    setDataText(project.data_text || '');
    setImagePrompt(project.spec?.image_prompt || '');
    setProvider(project.provider || 'gemini');
    setGenreTags(Array.isArray(project.genre_tags) ? project.genre_tags : []);
    setAudioVersion(Date.now());

    const matched = findGenreFromStyle(project.style || project.styles_text || '');
    setSelectedGenreId(matched.card.id);
    setSelectedSubgenreId(matched.subgenre.id);

    if (project.spec?.render_spec?.waveform) {
      const wf = project.spec.render_spec.waveform;
      if (wf.style) setWaveformStyle(wf.style);
      setWaveformParams(wf.params || null);
      if (wf.primary_color) setPrimaryColor(wf.primary_color);
      if (wf.secondary_color) setSecondaryColor(wf.secondary_color);
      if (wf.color_mode) setColorMode(wf.color_mode);
      if (wf.palette_colors) setPaletteColors(wf.palette_colors);
    } else {
      setWaveformParams(null);
    }
    if (project.spec?.render_spec?.motion_effects) {
      const me = project.spec.render_spec.motion_effects;
      if (me.shake_intensity_px !== undefined) setShakeIntensity(me.shake_intensity_px);
      if (me.background_pulse !== undefined) setBgPulse(me.background_pulse);
    }
  }, [project]);

  // Stop audio on unmount
  useEffect(() => {
    const audioEl = audioRef.current;
    return () => {
      if (audioEl) audioEl.pause();
    };
  }, []);

  const lyricsTimerRef = useRef(null);
  const dataTimerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isGeneratingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (lyricsTimerRef.current) clearTimeout(lyricsTimerRef.current);
      if (dataTimerRef.current) clearTimeout(dataTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const activeGenreCard =
    genreCards.find((g) => g.id === selectedGenreId) || genreCards[0] || GENRE_CARDS[0];
  const isAmbientOstMode =
    Boolean(activeGenreCard.isAmbientOst) ||
    activeGenreCard.id === 'ost_ambiental_exploracion' ||
    (stylePrompt || '').toLowerCase().includes('purely instrumental') ||
    (stylePrompt || '').toLowerCase().includes('ost ambiental');
  const isVideogameMode = Boolean(activeGenreCard.isVideogame) || isAmbientOstMode;

  const filteredGenreCards =
    categoryFilter === 'all'
      ? genreCards
      : genreCards.filter((g) => g.category === categoryFilter);

  // Parse Data.txt into YouTube and TikTok copywriting blocks
  const socialFields = useMemo(
    () => parseDataTxtFields(dataText, title, lyrics),
    [dataText, title, lyrics]
  );

  const ytTagsCount = useMemo(() => {
    if (!socialFields.ytTags) return 0;
    return socialFields.ytTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean).length;
  }, [socialFields.ytTags]);

  // Word count for lyrics
  const lyricsWordCount = useMemo(() => {
    if (!lyrics || !lyrics.trim()) return 0;
    return lyrics
      .trim()
      .split(/\s+/)
      .filter((w) => !w.startsWith('[')).length;
  }, [lyrics]);

  // Pipeline readiness (4 assets: Lyrics, Cover Art, Social Metadata, Audio MP3)
  const hasLyricsReady = Boolean(lyrics && lyrics.trim().length > 0);
  const hasCoverReady = Boolean(project.has_bg);
  const hasSocialReady = Boolean(dataText && dataText.trim().length > 0);
  const hasAudioReady = Boolean(project.has_audio);

  const completedAssetsCount = [
    hasLyricsReady,
    hasCoverReady,
    hasSocialReady,
    hasAudioReady,
  ].filter(Boolean).length;

  const canRenderVideo = hasLyricsReady && hasCoverReady && hasAudioReady;

  // Handlers for Genre & Subgenre selection
  const handleSelectGenreAndSub = (card, sub) => {
    setSelectedGenreId(card.id);
    setSelectedSubgenreId(sub.id);
    setStylePrompt(sub.prompt);
    setIsSelectingGenrePage(false);
  };

  const handleActivateCustomSub = (card) => {
    setSelectedGenreId(card.id);
    setSelectedSubgenreId('custom');
    setEditingCustomFor(card.id);
    const val = customSubgenreMap[card.id] || '';
    setStylePrompt(val ? `${card.title} - ${val}` : `${card.title} - `);
  };

  const handleCustomSubChange = (card, val) => {
    setCustomSubgenreMap((prev) => ({ ...prev, [card.id]: val }));
    setSelectedGenreId(card.id);
    setSelectedSubgenreId('custom');
    setStylePrompt(`${card.title} - ${val}`);
  };

  // Per-song Genre Tags handlers
  const handleToggleSongGenreTag = async (tag) => {
    const nextTags = genreTags.includes(tag)
      ? genreTags.filter((t) => t !== tag)
      : [...genreTags, tag];
    setGenreTags(nextTags);
    try {
      await updateSpec(project.rel_path, { genre_tags: nextTags });
      if (onRefreshProject) onRefreshProject();
    } catch (err) {
      console.error('Error updating genre tags:', err);
    }
  };

  const handleAddNewSongGenreTag = async (e) => {
    if (e) e.preventDefault();
    const clean = newGenreTagInput.trim();
    if (!clean) return;
    const nextTags = genreTags.includes(clean) ? genreTags : [...genreTags, clean];
    setGenreTags(nextTags);
    setNewGenreTagInput('');
    try {
      await updateSpec(project.rel_path, { genre_tags: nextTags });
      if (
        onUpdateCatalog &&
        catalog &&
        !availableGenreTags.some((t) => t.toLowerCase() === clean.toLowerCase())
      ) {
        await onUpdateCatalog({
          ...catalog,
          genre_tags: [...availableGenreTags, clean],
        });
      }
      if (onRefreshProject) onRefreshProject();
    } catch (err) {
      console.error('Error adding genre tag:', err);
    }
  };

  // Auto-save handlers
  const handleLyricsChange = (e) => {
    const val = e.target.value;
    setLyrics(val);
    setAutoSaveState('GUARDANDO...');
    if (lyricsTimerRef.current) clearTimeout(lyricsTimerRef.current);
    lyricsTimerRef.current = setTimeout(async () => {
      try {
        await updateLyrics(project.rel_path, val);
        setAutoSaveState('AUTO-SAVE SYNCED');
      } catch (err) {
        console.error('Auto-save lyrics error:', err);
      }
    }, 1000);
  };

  const handleDataChange = (e) => {
    const val = e.target.value;
    setDataText(val);
    setAutoSaveState('GUARDANDO...');
    if (dataTimerRef.current) clearTimeout(dataTimerRef.current);
    dataTimerRef.current = setTimeout(async () => {
      try {
        await updateDataFile(project.rel_path, val);
        setAutoSaveState('AUTO-SAVE SYNCED');
      } catch (err) {
        console.error('Auto-save Data.txt error:', err);
      }
    }, 1000);
  };

  const handleSaveWaveformPresets = async (nextPresets) => {
    if (!onUpdateCatalog) return;
    await onUpdateCatalog({
      ...(catalog || {}),
      waveform_presets: nextPresets,
    });
  };

  const handleDeleteWaveformPreset = async (targetId) => {
    if (waveformPresets.length <= 1) return;
    const nextPresets = waveformPresets.filter((p) => p.id !== targetId);
    await handleSaveWaveformPresets(nextPresets);
    if (waveformStyle === targetId) {
      const fallback = nextPresets[0];
      setWaveformStyle(fallback.id);
      setWaveformParams(fallback.params || null);
    }
  };

  const handleResetWaveformPresets = async () => {
    const res = await resetWaveformCatalog();
    if (onRefreshProject) await onRefreshProject();
    return res;
  };

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isGeneratingRef.current = false;
    setGeneratingSpec(false);
    setGeneratingArt(false);
    setGeneratingDataState(false);
    setBannerNotice('Generación cancelada por el usuario.');
    setTimeout(() => setBannerNotice(''), 3500);
  };

  const handleSaveStylesAndPrompt = async () => {
    if (isGeneratingRef.current || generatingSpec || generatingArt || generatingDataState) {
      return;
    }
    setSaving(true);
    setAutoSaveState('GUARDANDO...');
    try {
      const resolvedWf = resolveWaveformPreset(waveformStyle, waveformParams, waveformPresets);
      await updateSpec(project.rel_path, {
        title,
        concept,
        style: stylePrompt,
        provider,
        suno_styles: sunoStyles,
        image_prompt: imagePrompt,
        genre_tags: genreTags,
        render_spec: {
          waveform: {
            style: waveformStyle,
            engine: resolvedWf.engine,
            primary_color: primaryColor,
            secondary_color: secondaryColor,
            color_mode: colorMode,
            palette_colors: paletteColors,
            bar_count: resolvedWf.params.bar_count || 48,
            params: resolvedWf.params,
          },
          motion_effects: {
            bass_shake: shakeIntensity > 0,
            shake_intensity_px: shakeIntensity,
            background_pulse: bgPulse,
          },
        },
      });
      if (lyricsTimerRef.current) clearTimeout(lyricsTimerRef.current);
      await updateLyrics(project.rel_path, lyrics);
      if (dataTimerRef.current) clearTimeout(dataTimerRef.current);
      await updateDataFile(project.rel_path, dataText);

      setAutoSaveState('AUTO-SAVE SYNCED');
      setBannerNotice('Proyecto y especificaciones sincronizadas.');
      setTimeout(() => setBannerNotice(''), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenSpec = async () => {
    if (lyricsTimerRef.current) clearTimeout(lyricsTimerRef.current);
    if (dataTimerRef.current) clearTimeout(dataTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    isGeneratingRef.current = true;
    setGeneratingSpec(true);
    try {
      const effectiveStyle =
        stylePrompt || activeGenreCard.subgenres[0]?.prompt || 'Electro corrido tumbado';
      const effectiveConcept = concept || title || project.name.replace(/_/g, ' ');
      const res = await generateSpec({
        relPath: project.rel_path,
        concept: effectiveConcept,
        style: effectiveStyle,
        provider,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (res.spec) {
        setTitle(res.spec.title || title);
        setLyrics(res.spec.lyrics || lyrics);
        setSunoStyles(res.spec.suno_styles || sunoStyles);
        setImagePrompt(res.spec.image_prompt || imagePrompt);
        if (res.data_text) {
          setDataText(res.data_text);
        }
        await onRefreshProject();
        setBannerNotice('Letras, estilo Suno y metadatos regenerados con IA.');
        setTimeout(() => setBannerNotice(''), 3500);
      }
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      alert(err.message);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        isGeneratingRef.current = false;
        setGeneratingSpec(false);
      }
    }
  };

  const handleRegenImage = async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    isGeneratingRef.current = true;
    setGeneratingArt(true);
    try {
      await generateImage({
        relPath: project.rel_path,
        prompt: imagePrompt,
        provider,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setImageVersion(Date.now());
      await onRefreshProject();
      setBannerNotice(
        `Nuevo arte de portada generado con ${
          provider === 'gemini' ? 'Google Imagen 3' : 'DALL-E 3'
        }.`
      );
      setTimeout(() => setBannerNotice(''), 3500);
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      alert(err.message);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        isGeneratingRef.current = false;
        setGeneratingArt(false);
      }
    }
  };

  const handleRegenData = async () => {
    if (lyricsTimerRef.current) clearTimeout(lyricsTimerRef.current);
    if (dataTimerRef.current) clearTimeout(dataTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    isGeneratingRef.current = true;
    setGeneratingDataState(true);
    try {
      if (lyrics) {
        await updateLyrics(project.rel_path, lyrics);
      }
      if (controller.signal.aborted) return;
      const res = await generateData({
        relPath: project.rel_path,
        provider,
        lyrics: lyrics || undefined,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (res.content) {
        setDataText(res.content);
        setBannerNotice('Copywriting para YouTube y TikTok actualizado en Data.txt.');
        setTimeout(() => setBannerNotice(''), 3500);
      }
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      alert(err.message);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        isGeneratingRef.current = false;
        setGeneratingDataState(false);
      }
    }
  };

  const handleExtractPalette = async () => {
    setExtractingPaletteState(true);
    try {
      const res = await extractPalette(project.rel_path);
      if (res.primary && res.secondary) {
        setPrimaryColor(res.primary);
        setSecondaryColor(res.secondary);
        setPaletteColors([res.primary, res.secondary]);
        setBannerNotice(`Colores extraídos del fondo: ${res.primary} & ${res.secondary}`);
        setTimeout(() => setBannerNotice(''), 3000);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setExtractingPaletteState(false);
    }
  };

  const handleStartRender = async () => {
    if (!canRenderVideo) {
      alert(
        'Para desbloquear el renderizado de video, asegúrate de tener: Letra generada, Imagen de fondo y el archivo de Audio (.mp3) cargado.'
      );
      return;
    }
    if (!render16x9 && !render9x16) {
      alert('Selecciona al menos un formato de salida (16:9 o 9:16).');
      return;
    }

    try {
      const resolvedWf = resolveWaveformPreset(waveformStyle, waveformParams, waveformPresets);
      const customSpec = {
        waveform: {
          style: waveformStyle,
          engine: resolvedWf.engine,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          color_mode: colorMode,
          palette_colors: paletteColors,
          bar_count: resolvedWf.params.bar_count || 48,
          params: resolvedWf.params,
        },
        motion_effects: {
          bass_shake: shakeIntensity > 0,
          shake_intensity_px: shakeIntensity,
          background_pulse: bgPulse,
        },
      };

      const res = await startRender(project.rel_path, {
        customSpec,
        render16x9,
        render9x16,
      });

      if (res.job_id) {
        onTriggerRenderModal(res.job_id);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCrop9x16Now = async () => {
    setCropping9x16State(true);
    try {
      const res = await crop9x16(project.rel_path);
      if (res.job_id) {
        onTriggerRenderModal(res.job_id);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setCropping9x16State(false);
    }
  };

  // Audio playback controls
  const togglePlayAudio = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn('Playback error:', err);
        setIsPlaying(false);
      }
    }
  };

  const skipAudio = (deltaSec) => {
    if (!audioRef.current) return;
    const next = Math.max(0, Math.min(duration || 0, audioRef.current.currentTime + deltaSec));
    audioRef.current.currentTime = next;
    setCurrentTime(next);
  };

  const handleVolumeChange = (newVol) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolume(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const activeLoaderMode = generatingSpec
    ? 'spec'
    : generatingArt
      ? 'image'
      : generatingDataState
        ? 'data'
        : null;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface font-body-md text-on-surface antialiased relative">
      {/* Super Epic AI Loader Overlay for Lyrics/Spec, Image, or Social Metadata generation */}
      <EpicLoader
        isOpen={Boolean(activeLoaderMode)}
        mode={activeLoaderMode || 'spec'}
        subtitle={title || concept}
        provider={provider}
        onCancel={handleCancelGeneration}
      />

      {/* Hidden Audio Element so playback works across studio views */}
      {project.has_audio && (
        <audio
          ref={audioRef}
          src={getAudioUrl(project.rel_path, audioVersion)}
          preload="metadata"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
          onLoadedMetadata={() => {
            setDuration(audioRef.current?.duration || 0);
            if (audioRef.current) audioRef.current.volume = volume;
          }}
          onEnded={() => setIsPlaying(false)}
          onError={() => setIsPlaying(false)}
        />
      )}

      {/* TOP WORKSTATION HEADER (Matching example.html <header>) */}
      <header className="h-16 bg-surface-container-low/90 backdrop-blur-xl z-40 flex items-center justify-between px-space-xl border-b border-outline-variant/25 shrink-0">
        <div className="flex items-center gap-space-lg min-w-0">
          {/* Back to Library Button */}
          <button
            type="button"
            onClick={onBack}
            className="px-space-md py-space-xs rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex items-center gap-space-xs font-label-md text-label-md uppercase transition-colors cursor-pointer"
            title="Volver a la biblioteca de proyectos"
          >
            <span className="material-symbols-outlined text-primary-container text-[16px]">
              arrow_back
            </span>
            <span>Biblioteca</span>
          </button>

          {/* Brand & Active Project Pill */}
          <div className="hidden xl:flex items-center gap-space-xs px-space-md py-space-xs rounded bg-surface-container text-on-surface-variant font-label-md text-label-md truncate max-w-xs">
            <span className="material-symbols-outlined text-primary-fixed-dim text-[14px]">
              album
            </span>
            <span className="text-on-surface font-body-sm text-body-sm truncate">
              Project: {title || project.name}
            </span>
          </div>

          {/* 3-Step Workstation Breadcrumb Nav (example.html) */}
          <nav className="flex items-center gap-space-xs font-label-sm text-label-sm">
            <button
              type="button"
              onClick={() => setActiveView('wizard')}
              className={`px-space-sm py-space-xs rounded transition-colors cursor-pointer ${
                activeView === 'wizard'
                  ? 'bg-surface-container text-primary-fixed font-bold shadow-[0_0_8px_rgba(0,224,255,0.2)]'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              1. GENRE &amp; AI LYRICS
            </button>
            <span className="text-outline-variant font-body-sm text-body-sm">/</span>
            <button
              type="button"
              onClick={() => {
                setActiveView('render-studio');
                setTimeout(() => {
                  audioSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 50);
              }}
              className={`px-space-sm py-space-xs rounded transition-colors cursor-pointer flex items-center gap-1 ${
                activeView === 'render-studio'
                  ? 'bg-surface-container text-primary-fixed font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span>2. ASSETS &amp; AUDIO HUB</span>
              {hasAudioReady && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container" />
              )}
            </button>
            <span className="text-outline-variant font-body-sm text-body-sm">/</span>
            <button
              type="button"
              onClick={() => {
                setActiveView('render-studio');
                setTimeout(() => {
                  renderSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 50);
              }}
              className={`px-space-sm py-space-xs rounded transition-colors cursor-pointer ${
                activeView === 'render-studio'
                  ? 'bg-surface-container text-primary-fixed font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              3. VIDEO RENDER STUDIO
            </button>
          </nav>
        </div>

        {/* Right Telemetry & Folder Actions */}
        <div className="flex items-center gap-space-md">
          {onToggleTheme && (
            <button
              type="button"
              onClick={(e) => onToggleTheme(e)}
              className="px-2.5 h-8 flex items-center gap-1 rounded bg-surface-container hover:bg-primary-container/15 border border-outline-variant/30 text-primary-fixed font-label-sm uppercase transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            >
              <span className="material-symbols-outlined text-[15px]">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
              <span className="hidden lg:inline">
                {theme === 'dark' ? 'Claro' : 'Oscuro'}
              </span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-space-xs px-space-sm py-space-xs rounded bg-surface-container-highest text-primary-fixed font-label-sm text-label-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
            <span>GPU ENGINE ACTIVE</span>
          </div>

          <div className="flex items-center gap-space-xs">
            <button
              type="button"
              onClick={async () => {
                try {
                  await openProjectFolder(project.rel_path);
                } catch (err) {
                  alert(err.message);
                }
              }}
              className="px-space-sm h-8 flex items-center gap-1 rounded bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors font-label-sm text-label-sm cursor-pointer"
              title="Abrir carpeta del proyecto en el explorador"
            >
              <span className="material-symbols-outlined text-[16px] text-tertiary-container">
                folder_open
              </span>
              <span className="hidden md:inline">CARPETA</span>
            </button>

            <button
              type="button"
              onClick={handleSaveStylesAndPrompt}
              disabled={saving}
              className="px-space-sm h-8 flex items-center gap-1 rounded bg-primary-container/15 hover:bg-primary-container text-primary-fixed hover:text-on-primary-fixed transition-colors font-label-sm text-label-sm font-bold cursor-pointer"
              title="Guardar todos los cambios"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              <span className="hidden md:inline">{saving ? 'GUARDANDO...' : 'GUARDAR'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Banner Notification */}
      {bannerNotice && (
        <div className="bg-primary-container/15 border-b border-primary-container/30 px-space-xl py-2 font-body-sm text-body-sm text-primary-fixed flex items-center justify-between shrink-0">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[16px] text-primary-container">
              check_circle
            </span>
            <span>{bannerNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerNotice('')}
            className="text-primary-fixed hover:text-on-surface cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* MAIN SCROLLABLE WORKSTATION AREA */}
      <main className="flex-1 overflow-y-auto w-full bg-surface">
        {/* =====================================================================
            VIEW 1: PRODUCTION WIZARD (1. GENRE & AI LYRICS)
           ===================================================================== */}
        {activeView === 'wizard' && (
          <div className="flex flex-col w-full">
            {/* Sub-Header Metabar / Context Control + Musical Genre Tags */}
            <section className="w-full bg-surface-container-low px-space-xl py-space-md shadow-sm border-b border-outline-variant/20 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-space-md max-w-[1720px] mx-auto">
                <div className="flex items-center gap-space-lg flex-wrap min-w-0">
                  <div className="flex items-center gap-space-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary-container shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={handleSaveStylesAndPrompt}
                      placeholder="Título de la Producción..."
                      className="font-headline-md text-headline-md text-on-surface uppercase tracking-tight bg-transparent border-b border-transparent focus:border-primary-container focus:outline-none px-1"
                    />
                    <span className="px-space-sm py-0.5 rounded bg-surface-container-highest text-primary-fixed font-label-sm text-label-sm uppercase">
                      {activeGenreCard.bpm} • {activeGenreCard.tuning}
                    </span>
                  </div>

                  {/* Playlist Selector in Metabar */}
                  <div className="flex items-center gap-space-xs bg-surface-container px-space-md py-space-xs rounded">
                    <span className="material-symbols-outlined text-outline text-[16px]">
                      queue_music
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                      Playlist:
                    </span>
                    <select
                      value={project.playlist || ''}
                      onChange={(e) => {
                        const target = e.target.value || null;
                        if (onMovePlaylist) onMovePlaylist(project.rel_path, target);
                      }}
                      className="bg-transparent font-body-md text-body-md text-on-surface font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="" className="bg-surface-container-lowest text-on-surface">
                        Sin Playlist (Raíz)
                      </option>
                      {playlists.map((pl) => (
                        <option
                          key={pl.name}
                          value={pl.name}
                          className="bg-surface-container-lowest text-on-surface"
                        >
                          {pl.name.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-space-md">
                  <div className="flex items-center gap-space-xs bg-surface-container-highest px-space-sm py-1 rounded text-primary font-label-sm text-label-sm">
                    <span className="material-symbols-outlined text-primary-container text-[14px]">
                      bolt
                    </span>
                    <span>PRESET: {activeGenreCard.presetName}</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-space-xs bg-surface-container px-space-sm py-1 rounded text-on-surface-variant font-label-sm text-label-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-container" />
                    <span>{autoSaveState}</span>
                  </div>
                </div>
              </div>

              {/* Per-Song Musical Genre Tags Row (Independent from Playlists) */}
              <div className="max-w-[1720px] mx-auto pt-2 border-t border-outline-variant/15 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="text-[10px] font-label-sm uppercase tracking-wider text-primary-fixed flex items-center gap-1 mr-1">
                    <span className="material-symbols-outlined text-[14px]">sell</span>
                    ETIQUETAS DE GÉNERO MUSICAL:
                  </span>
                  {Array.from(new Set([...availableGenreTags, ...genreTags])).map((tag) => {
                    const isTagged = genreTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleToggleSongGenreTag(tag)}
                        className={`px-2 py-0.5 rounded text-[10px] font-label-sm transition-all flex items-center gap-1 cursor-pointer ${
                          isTagged
                            ? 'bg-primary-container text-on-primary-fixed font-bold shadow-[0_0_8px_rgba(0,224,255,0.25)]'
                            : 'bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/25'
                        }`}
                        title={
                          isTagged
                            ? 'Quitar etiqueta de género de esta canción'
                            : 'Asignar etiqueta de género a esta canción'
                        }
                      >
                        <span>{isTagged ? '✓' : '+'}</span>
                        <span>{tag}</span>
                      </button>
                    );
                  })}
                </div>

                <form
                  onSubmit={handleAddNewSongGenreTag}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={newGenreTagInput}
                    onChange={(e) => setNewGenreTagInput(e.target.value)}
                    placeholder="+ Crear nuevo género musical..."
                    className="bg-surface-container-lowest border border-outline-variant/30 focus:border-primary-container rounded px-2.5 py-1 text-body-sm text-on-surface w-48 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newGenreTagInput.trim()}
                    className="px-2.5 py-1 rounded bg-primary-container text-on-primary-fixed font-label-sm uppercase font-bold disabled:opacity-40 cursor-pointer"
                  >
                    Agregar
                  </button>
                </form>
              </div>
            </section>

            {/* Main Workstation Layout Container */}
            <div className="w-full max-w-[1720px] mx-auto px-space-xl py-space-xl space-y-space-xl">
              {isSelectingGenrePage ? (
                /* =================================================================
                 * DEDICATED PAGE FOR "1. Selecciona Género & Sub-género Visual"
                 * ONLY CARDS AND CATEGORY FILTER ARE SHOWN UNTIL SELECTED
                 * ================================================================= */
                <section className="space-y-space-lg animate-fade-scale">
                  <div className="flex flex-wrap items-center justify-between gap-space-md bg-surface-container-low p-space-lg rounded-xl border border-outline-variant/20">
                    <div>
                      <div className="flex items-center gap-space-xs">
                        <span className="font-label-sm text-label-sm text-primary-container uppercase tracking-widest">
                          1. Selecciona Género &amp; Sub-género Visual
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-container" />
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          {genreCards.length} Géneros Calibrados
                        </span>
                      </div>
                      <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-1">
                        Haz clic en un Sub-género para confirmar y volver al Concepto &amp; Letras
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Genre Filter Buttons */}
                      <div className="flex items-center gap-space-xs overflow-x-auto max-w-full bg-surface-container-lowest p-1.5 rounded-lg border border-outline-variant/20">
                        {genreCategories.map((cat) => {
                          const isActive = categoryFilter === cat.id;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setCategoryFilter(cat.id)}
                              className={`px-space-md py-1 rounded font-label-md text-label-md transition-colors cursor-pointer ${
                                isActive
                                  ? 'bg-primary-container text-on-primary-container font-bold shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-bright'
                              }`}
                            >
                              {cat.label}
                            </button>
                          );
                        })}
                      </div>

                      {onOpenSettings && (
                        <button
                          type="button"
                          onClick={onOpenSettings}
                          className="px-3 py-1.5 rounded bg-surface-container hover:bg-surface-container-highest border border-outline-variant/30 text-on-surface-variant hover:text-primary-fixed font-label-sm uppercase flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">settings</span>
                          <span>Editar Catálogo</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsSelectingGenrePage(false)}
                        className="px-3.5 py-1.5 rounded bg-primary-container text-on-primary-fixed font-label-sm uppercase font-bold cursor-pointer"
                      >
                        Continuar con {activeGenreCard.title} →
                      </button>
                    </div>
                  </div>

                  {/* Genre Cards Grid (Dedicated View) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-lg">
                    {filteredGenreCards.map((card) => {
                      const isCardActive = selectedGenreId === card.id;
                      return (
                        <div
                          key={card.id}
                          onClick={() => {
                            if (card.subgenres?.[0]) {
                              handleSelectGenreAndSub(card, card.subgenres[0]);
                            }
                          }}
                          className={`relative rounded-xl p-space-lg flex flex-col justify-between transition-all cursor-pointer overflow-hidden ${
                            isCardActive
                              ? 'bg-surface-container-high shadow-xl ring-2 ring-primary-container'
                              : 'bg-surface-container shadow-md hover:bg-surface-container-high border border-outline-variant/20'
                          }`}
                        >
                          {isCardActive && (
                            <div className="absolute inset-0 bg-gradient-to-b from-primary-container/15 via-transparent to-surface-container-lowest/80 pointer-events-none" />
                          )}

                          <div className="relative z-10 space-y-space-md">
                            <div className="flex items-center justify-between">
                              {isCardActive ? (
                                <span className="px-space-sm py-0.5 rounded bg-primary-container text-on-primary-container font-label-sm text-label-sm font-bold uppercase tracking-wider shadow-[0_0_8px_rgba(0,240,255,0.5)]">
                                  ACTIVO • PRINCIPAL
                                </span>
                              ) : (
                                <span className="px-space-sm py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm uppercase">
                                  {card.tag}
                                </span>
                              )}
                              <span
                                className={`material-symbols-outlined text-[20px] ${
                                  isCardActive
                                    ? 'text-primary-container material-symbols-filled'
                                    : 'text-outline'
                                }`}
                              >
                                {isCardActive ? 'check_circle' : 'radio_button_unchecked'}
                              </span>
                            </div>

                            <div className="h-36 rounded-lg overflow-hidden relative shadow-[0_8px_20px_rgba(0,0,0,0.25)]">
                              <div
                                className="bg-cover bg-center w-full h-full transform hover:scale-105 transition-transform duration-500"
                                style={{ backgroundImage: `url('${card.image}')` }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
                              <div className="absolute bottom-2 left-2">
                                <span className="font-headline-sm text-headline-sm uppercase text-white font-bold drop-shadow">
                                  {card.title}
                                </span>
                              </div>
                            </div>

                            <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                              {card.description}
                            </p>

                            <div
                              className="space-y-space-xs pt-space-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="font-label-sm text-label-sm text-outline uppercase">
                                Selecciona un Sub-género:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {(card.subgenres || []).map((sub) => {
                                  const isSubSelected =
                                    isCardActive && selectedSubgenreId === sub.id;
                                  return (
                                    <button
                                      key={sub.id}
                                      type="button"
                                      onClick={() => handleSelectGenreAndSub(card, sub)}
                                      className={`px-space-sm py-1 rounded font-label-sm text-label-sm transition-all cursor-pointer ${
                                        isSubSelected
                                          ? 'bg-primary-container text-on-primary-container font-bold shadow-[0_0_6px_rgba(0,240,255,0.4)]'
                                          : 'bg-surface-container-highest text-on-surface hover:bg-primary-container hover:text-on-primary-fixed'
                                      }`}
                                    >
                                      {sub.label}
                                      {isSubSelected ? ' • Seleccionado' : ''}
                                    </button>
                                  );
                                })}

                                <button
                                  type="button"
                                  onClick={() => handleActivateCustomSub(card)}
                                  className={`px-space-sm py-1 rounded font-label-sm text-label-sm transition-colors flex items-center gap-1 cursor-pointer ${
                                    isCardActive && selectedSubgenreId === 'custom'
                                      ? 'bg-primary-container text-on-primary-container font-bold shadow-[0_0_6px_rgba(0,240,255,0.4)]'
                                      : 'bg-surface-container-lowest text-primary-fixed-dim hover:bg-surface-variant'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[12px]">add</span>
                                  <span>+ Otro: escribir...</span>
                                </button>
                              </div>

                              {(editingCustomFor === card.id ||
                                (isCardActive && selectedSubgenreId === 'custom')) && (
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    placeholder="Escribe el sub-género personalizado..."
                                    value={customSubgenreMap[card.id] || ''}
                                    onChange={(e) => handleCustomSubChange(card, e.target.value)}
                                    className="flex-1 bg-surface-container-lowest text-on-surface font-body-sm text-body-sm rounded px-space-sm py-1 border border-primary-container/50 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setIsSelectingGenrePage(false)}
                                    className="px-2.5 py-1 rounded bg-primary-container text-on-primary-fixed font-label-sm uppercase font-bold"
                                  >
                                    OK
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="relative z-10 mt-space-md pt-space-sm flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
                            <span>{card.tuning}</span>
                            <span className={isCardActive ? 'text-primary-container font-bold' : ''}>
                              {card.bpm}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <>
                  {/* COMPACT SELECTED GENRE SUMMARY BAR + CONCEPT & OVERRIDE */}
                  <section className="space-y-space-md">
                    <div className="bg-surface-container-low border border-outline-variant/25 rounded-xl p-space-md flex flex-wrap items-center justify-between gap-space-md">
                      <div className="flex items-center gap-space-md">
                        {activeGenreCard.image && (
                          <img
                            src={activeGenreCard.image}
                            alt={activeGenreCard.title}
                            className="w-14 h-14 rounded-lg object-cover border border-primary-container/40 shrink-0"
                          />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary-fixed font-label-sm text-[10px] uppercase font-bold">
                              1. Género &amp; Sub-género Activo
                            </span>
                            {isAmbientOstMode ? (
                              <span className="px-2 py-0.5 rounded bg-[#00e0ff]/20 border border-[#00e0ff] text-primary-fixed font-label-sm text-[10px] uppercase font-bold">
                                Reglas OST Ambiental (Sin Voces • Solo [ ] • Purely Instrumental)
                              </span>
                            ) : isVideogameMode ? (
                              <span className="px-2 py-0.5 rounded bg-tertiary-container text-on-tertiary font-label-sm text-[10px] uppercase font-bold">
                                Reglas OST Épico (EN / Latín / Glossolalia)
                              </span>
                            ) : null}
                          </div>
                          <h2 className="font-headline-md text-headline-md text-on-surface font-bold mt-0.5">
                            {activeGenreCard.title}{' '}
                            <span className="text-primary-fixed">
                              •{' '}
                              {activeGenreCard.subgenres?.find((s) => s.id === selectedSubgenreId)
                                ?.label ||
                                customSubgenreMap[activeGenreCard.id] ||
                                'Personalizado'}
                            </span>
                          </h2>
                          <p className="font-body-sm text-body-sm text-on-surface-variant">
                            {activeGenreCard.description}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsSelectingGenrePage(true)}
                        className="px-space-lg py-space-sm rounded-lg bg-surface-container-highest hover:bg-primary-container text-on-surface hover:text-on-primary-fixed border border-primary-container/40 font-label-md text-label-md uppercase font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                      >
                        <span className="material-symbols-outlined text-[16px]">grid_view</span>
                        <span>1. Selecciona Género &amp; Sub-género Visual</span>
                      </button>
                    </div>

                    {/* Video Game Special Rules Active Banner */}
                    {isVideogameMode && (
                      <div className="bg-surface-container-high border border-primary-container/40 rounded-xl p-space-md flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
                        <div className="flex items-start gap-space-sm">
                          <span className="material-symbols-outlined text-primary-container text-[22px] mt-0.5">
                            {isAmbientOstMode ? 'forest' : 'sports_esports'}
                          </span>
                          <div className="font-body-sm text-body-sm text-on-surface-variant">
                            <span className="text-primary-fixed font-bold uppercase tracking-wider block">
                              {isAmbientOstMode
                                ? 'Modo Ambiental / Exploración Activo: OST Sin Voces (CORE RULES)'
                                : 'Modo Épico / Combate Activo: Música para Videojuegos (CORE RULES)'}
                            </span>
                            {isAmbientOstMode ? (
                              <span>
                                1. Cero español (100% Inglés) • 2. <b>Cero voces</b>: caja de Lyrics{' '}
                                <b>EXCLUSIVAMENTE</b> con directivas instrumentales entre corchetes{' '}
                                <code className="text-primary">[ ]</code> • 3. En Style of Music siempre
                                al final:{' '}
                                <code className="text-primary">purely instrumental, no vocals</code> • 4.
                                Pacing cíclico relajado (<code className="text-primary">[Intro]</code> →{' '}
                                <code className="text-primary">[Theme A]</code> →{' '}
                                <code className="text-primary">[Theme B]</code> →{' '}
                                <code className="text-primary">[Bridge]</code> →{' '}
                                <code className="text-primary">[Outro: Loopable Fade]</code> →{' '}
                                <code className="text-primary">[End]</code>).
                              </span>
                            ) : (
                              <span>
                                1. Cero español en lírica/tags (Inglés, Latín o Glossolalia) • 2. Voz
                                como instrumento legato (<code className="text-primary">Lú-mi-na...</code>
                                ) • 3. Contrapunto coral <code className="text-primary">(Sanctus!)</code> •
                                4. Control orquestal <code className="text-primary">[ ]</code> • 5. Arco
                                dinámico en 8 secciones hasta <code className="text-primary">[End]</code>.
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="px-space-sm py-1 rounded bg-primary-container/20 text-primary-fixed font-label-sm text-label-sm uppercase shrink-0">
                          {isAmbientOstMode ? 'Instrumental • Max 200 Chars' : 'Style Max 200 Chars'}
                        </span>
                      </div>
                    )}

                    {/* Fine-Tuning Override Input Prompt & Concept Bar */}
                    <div className="bg-surface-container-low rounded-xl p-space-md shadow-inner space-y-space-sm">
                      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-space-md">
                        <div className="flex items-center gap-space-xs text-primary-container min-w-[155px]">
                          <span className="material-symbols-outlined text-[20px]">tune</span>
                          <span className="font-label-md text-label-md uppercase font-bold tracking-wider whitespace-nowrap">
                            Override Prompt:
                          </span>
                        </div>
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={stylePrompt}
                            onChange={(e) => setStylePrompt(e.target.value)}
                            onBlur={handleSaveStylesAndPrompt}
                            placeholder="Escribe el prompt de estilo musical personalizado..."
                            className="w-full bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded px-space-md py-space-sm focus:outline-none focus:bg-surface-container transition-colors shadow-inner"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleRegenSpec}
                          disabled={generatingSpec}
                          className="px-space-lg py-space-sm rounded bg-surface-container-highest hover:bg-surface-bright text-primary-fixed font-label-md text-label-md uppercase tracking-wider flex items-center justify-center gap-space-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <span
                            className={`material-symbols-outlined text-[16px] ${
                              generatingSpec ? 'animate-spin' : ''
                            }`}
                          >
                            sync
                          </span>
                          <span>
                            {generatingSpec ? 'Calibrando con IA...' : 'Re-calibrar Prompt'}
                          </span>
                        </button>
                      </div>

                      {/* Concept / Theme Row */}
                      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-space-md pt-1">
                        <div className="flex items-center gap-space-xs text-secondary min-w-[155px]">
                          <span className="material-symbols-outlined text-[18px]">psychology</span>
                          <span className="font-label-md text-label-md uppercase font-bold tracking-wider whitespace-nowrap">
                            Concepto / Tema:
                          </span>
                        </div>
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={concept}
                            onChange={(e) => setConcept(e.target.value)}
                            onBlur={handleSaveStylesAndPrompt}
                            placeholder="Describe la historia, temática o lore del track..."
                            className="w-full bg-surface-container-lowest text-on-surface-variant focus:text-on-surface font-body-sm text-body-sm rounded px-space-md py-1.5 focus:outline-none focus:bg-surface-container transition-colors shadow-inner"
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* STEP 2 & 3: Two-Column Bento Layout (AI Art & Lyrics Generator) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl">
                {/* Left Column: Visual Synthesis Studio (5 Cols) */}
                <div className="lg:col-span-5 space-y-space-lg">
                  {/* Module Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-space-xs">
                      <span className="w-2 h-2 rounded-full bg-secondary-container" />
                      <h3 className="font-headline-md text-headline-md text-on-surface tracking-tight">
                        AI Album Cover Studio
                      </h3>
                    </div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                      16:9 &amp; 9:16 Safe Zone
                    </span>
                  </div>

                  {/* Model Selector Radio Cards */}
                  <div className="grid grid-cols-2 gap-space-sm">
                    <label
                      onClick={() => setProvider('gemini')}
                      className={`cursor-pointer p-space-sm rounded-lg flex flex-col justify-between relative transition-all ${
                        provider === 'gemini'
                          ? 'bg-primary-container/10 ring-1 ring-primary-container/50'
                          : 'bg-surface-container hover:bg-surface-container-high'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-label-md text-label-md font-bold ${
                            provider === 'gemini' ? 'text-primary' : 'text-on-surface'
                          }`}
                        >
                          Google Imagen 3
                        </span>
                        <span
                          className={`w-3 h-3 rounded-full ${
                            provider === 'gemini'
                              ? 'bg-primary-container shadow-[0_0_6px_rgba(0,240,255,1)]'
                              : 'bg-surface-variant'
                          }`}
                        />
                      </div>
                      <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                        Ultra Photorealism &amp; Prompt Adherence
                      </span>
                    </label>

                    <label
                      onClick={() => setProvider('anthropic')}
                      className={`cursor-pointer p-space-sm rounded-lg flex flex-col justify-between transition-all ${
                        provider === 'anthropic'
                          ? 'bg-primary-container/10 ring-1 ring-primary-container/50'
                          : 'bg-surface-container hover:bg-surface-container-high'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-label-md text-label-md font-bold ${
                            provider === 'anthropic' ? 'text-primary' : 'text-on-surface'
                          }`}
                        >
                          Anthropic + DALL-E 3
                        </span>
                        <span
                          className={`w-3 h-3 rounded-full ${
                            provider === 'anthropic'
                              ? 'bg-primary-container shadow-[0_0_6px_rgba(0,240,255,1)]'
                              : 'bg-surface-variant'
                          }`}
                        />
                      </div>
                      <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                        Artistic, Hyper-Stylized &amp; Cinema
                      </span>
                    </label>
                  </div>

                  {/* Visual Cover Showcase */}
                  <div className="relative bg-surface-container-lowest rounded-xl overflow-hidden shadow-2xl p-space-sm aspect-square flex flex-col justify-end">
                    {project.has_bg ? (
                      <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
                        style={{
                          backgroundImage: `url('${getImageUrl(project.rel_path, imageVersion)}')`,
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-on-surface-variant p-6 text-center">
                        <span className="material-symbols-outlined text-[48px] text-outline mb-2">
                          image
                        </span>
                        <p className="font-headline-sm text-headline-sm text-on-surface">
                          Sin Portada Generada
                        </p>
                        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                          Haz clic en &ldquo;Regenerar Arte&rdquo; abajo o sube una imagen propia.
                        </p>
                      </div>
                    )}

                    {/* Holographic HUD Overlay Elements */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
                    <div className="absolute top-4 left-4 flex items-center gap-space-xs bg-black/75 text-white backdrop-blur-md px-space-sm py-1 rounded border border-white/15 shadow-lg">
                      <span className="material-symbols-outlined text-[#00e0ff] text-[14px]">
                        auto_awesome
                      </span>
                      <span className="font-label-sm text-label-sm text-neutral-200 uppercase">
                        {provider === 'gemini' ? 'Google Imagen 3' : 'DALL-E 3'} • Safe Zone 16:9 /
                        9:16
                      </span>
                    </div>

                    <div className="absolute top-4 right-4 flex items-center gap-1">
                      <label
                        title="Subir imagen propia desde tu equipo"
                        className="w-8 h-8 rounded bg-black/75 border border-white/15 backdrop-blur-md flex items-center justify-center text-white hover:text-[#00e0ff] transition-colors cursor-pointer shadow-lg"
                      >
                        <span className="material-symbols-outlined text-[16px]">upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              await uploadImage(project.rel_path, file);
                              setImageVersion(Date.now());
                              onRefreshProject();
                            }
                          }}
                        />
                      </label>
                      {project.has_bg && (
                        <button
                          type="button"
                          onClick={() => setIsFullscreenArt(true)}
                          className="w-8 h-8 rounded bg-surface-container-lowest/80 backdrop-blur-md flex items-center justify-center text-on-surface hover:text-primary-container transition-colors cursor-pointer"
                          title="Vista en pantalla completa"
                        >
                          <span className="material-symbols-outlined text-[16px]">fullscreen</span>
                        </button>
                      )}
                    </div>

                    {/* Bottom Meta bar inside artwork */}
                    <div className="relative z-10 bg-surface-container-low/90 backdrop-blur-md p-space-md rounded-lg space-y-space-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-label-sm text-primary-fixed uppercase font-bold truncate pr-2">
                          {title || project.name} • MASTER ART
                        </span>
                        <span className="font-label-sm text-label-sm text-outline shrink-0">
                          03_background.png
                        </span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                        Prompt: &ldquo;{imagePrompt || 'Sin prompt visual definido...'}&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Collapsible Image Prompt Editor */}
                  {showImagePromptEditor && (
                    <div className="bg-surface-container-low rounded-xl p-space-md space-y-space-xs border border-primary-container/30">
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-label-sm text-primary-fixed uppercase">
                          Prompt Visual de Escena (16:9 y 9:16 Centrado)
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowImagePromptEditor(false)}
                          className="text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm cursor-pointer"
                        >
                          Cerrar
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                        onBlur={handleSaveStylesAndPrompt}
                        placeholder="Describe la escena visual centrada con el 25% inferior oscuro..."
                        className="w-full bg-surface-container-lowest rounded p-space-sm font-body-sm text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
                      />
                    </div>
                  )}

                  {/* Action regenerate button & prompt adjustments */}
                  <div className="flex items-center gap-space-sm">
                    <button
                      type="button"
                      onClick={handleRegenImage}
                      disabled={generatingArt}
                      className="flex-1 py-space-sm px-space-md rounded-lg bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-md text-label-md flex items-center justify-center gap-space-xs transition-colors shadow cursor-pointer disabled:opacity-50"
                    >
                      <span
                        className={`material-symbols-outlined text-primary-container text-[18px] ${
                          generatingArt ? 'animate-spin' : ''
                        }`}
                      >
                        brush
                      </span>
                      <span>
                        {generatingArt
                          ? 'Generando Arte con IA...'
                          : `Regenerar Arte (${
                              provider === 'gemini' ? 'Google Imagen 3' : 'DALL-E 3'
                            })`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowImagePromptEditor((v) => !v)}
                      className={`p-space-sm rounded-lg transition-colors cursor-pointer ${
                        showImagePromptEditor
                          ? 'bg-primary-container text-on-primary-container'
                          : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                      }`}
                      title="Editar Prompt de Imagen"
                    >
                      <span className="material-symbols-outlined text-[18px]">tune</span>
                    </button>
                  </div>

                  {/* Mini Audio Spectral Visualizer Decor */}
                  <div className="bg-surface-container-low rounded-xl p-space-md space-y-space-xs">
                    <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
                      <span>Spectral Harmonic Distribution</span>
                      <span className="text-primary-container">Stereo Field OK</span>
                    </div>
                    <div className="h-8 flex items-end gap-1 px-1">
                      <span className="flex-1 bg-surface-variant h-2 rounded-t" />
                      <span className="flex-1 bg-surface-variant h-4 rounded-t" />
                      <span className="flex-1 bg-primary-container h-6 rounded-t shadow-[0_0_6px_rgba(0,240,255,0.4)]" />
                      <span className="flex-1 bg-primary-container h-7 rounded-t shadow-[0_0_6px_rgba(0,240,255,0.4)]" />
                      <span className="flex-1 bg-primary-container h-5 rounded-t" />
                      <span className="flex-1 bg-secondary h-8 rounded-t shadow-[0_0_6px_rgba(255,42,85,0.4)]" />
                      <span className="flex-1 bg-primary-container h-6 rounded-t" />
                      <span className="flex-1 bg-surface-variant h-3 rounded-t" />
                      <span className="flex-1 bg-surface-variant h-4 rounded-t" />
                      <span className="flex-1 bg-surface-variant h-2 rounded-t" />
                      <span className="flex-1 bg-primary-container h-5 rounded-t" />
                      <span className="flex-1 bg-surface-variant h-3 rounded-t" />
                    </div>
                  </div>
                </div>

                {/* Right Column: Lyrics Studio & Suno Technical Prompter (7 Cols) */}
                <div className="lg:col-span-7 space-y-space-lg">
                  {/* Section Header with Quick Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-space-sm">
                    <div className="flex items-center gap-space-xs">
                      <span className="w-2 h-2 rounded-full bg-primary-container" />
                      <h3 className="font-headline-md text-headline-md text-on-surface tracking-tight">
                        Lyrics &amp; Suno AI Prompt Generator
                      </h3>
                    </div>
                    <div className="flex items-center gap-space-xs">
                      <button
                        type="button"
                        onClick={() => setLyricsEditMode((v) => !v)}
                        className={`px-space-sm py-1 rounded font-label-sm text-label-sm flex items-center gap-1 transition-colors cursor-pointer ${
                          lyricsEditMode
                            ? 'bg-primary-container/20 text-primary-fixed border border-primary-container/40'
                            : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                        <span>{lyricsEditMode ? 'Ver Vista Formateada' : 'Editar Texto'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRegenSpec}
                        disabled={generatingSpec}
                        className="px-space-sm py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
                        <span>{generatingSpec ? 'Generando...' : 'Re-escribir Letra'}</span>
                      </button>

                      <CopyButton
                        textToCopy={lyrics}
                        label="Copiar Letra"
                        copiedLabel="¡Letra Copiada!"
                        className="px-space-md py-1 rounded bg-primary-container text-on-primary-container font-label-sm text-label-sm font-bold shadow-[0_0_8px_rgba(0,240,255,0.4)]"
                      />
                    </div>
                  </div>

                  {/* Suno AI Quick Copy Prompt Box (Pro Technical Specs) */}
                  <div className="bg-surface-container-highest rounded-xl p-space-md shadow-md space-y-space-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-space-xs">
                        <span className="material-symbols-outlined text-primary-container text-[16px]">
                          code
                        </span>
                        <span className="font-label-md text-label-md text-primary font-bold uppercase">
                          Suno AI Style Prompt (Listo para Pegar)
                        </span>
                        {isVideogameMode && (
                          <span className="font-label-sm text-label-sm text-on-surface-variant">
                            ({(sunoStyles || '').length}/200 chars)
                          </span>
                        )}
                      </div>
                      <CopyButton
                        textToCopy={sunoStyles}
                        label="Copiar Estilo"
                        copiedLabel="¡Estilo Copiado!"
                        iconSize="text-[12px]"
                        className="px-space-sm py-0.5 rounded bg-surface-container text-primary-container hover:bg-primary-container hover:text-on-primary-container font-label-sm text-label-sm uppercase font-semibold"
                      />
                    </div>
                    <textarea
                      rows={2}
                      value={sunoStyles}
                      onChange={(e) => setSunoStyles(e.target.value)}
                      onBlur={handleSaveStylesAndPrompt}
                      placeholder="[Corridos tumbados, electro brass, 145 bpm, aggressive requinto, deep 808 sub bass...]"
                      className="w-full p-space-sm rounded bg-surface-container-lowest font-body-sm text-body-sm text-primary-fixed focus:outline-none focus:ring-1 focus:ring-primary-container/40 resize-none"
                    />
                  </div>

                  {/* Suno Instructions Warning Banner */}
                  <div className="bg-surface-container-low rounded-lg p-space-md flex items-start gap-space-sm shadow-sm">
                    <span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">
                      info
                    </span>
                    <div className="text-on-surface-variant font-body-sm text-body-sm">
                      <span className="text-on-surface font-semibold">Paso Manual Requerido:</span>{' '}
                      Copia el estilo técnico y la letra a Suno AI. Cuando tu track esté generado,
                      descarga el audio (.mp3 o .wav) y avanza a la siguiente pestaña{' '}
                      <button
                        type="button"
                        onClick={() => setActiveView('render-studio')}
                        className="text-primary-container font-semibold hover:underline cursor-pointer"
                      >
                        &ldquo;Audio Hub&rdquo;
                      </button>{' '}
                      para subir el MP3 y desbloquear el renderizado de video.
                    </div>
                  </div>

                  {/* Full Lyrics Editor / Preview Panel */}
                  <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-2xl relative space-y-space-md max-h-[480px] overflow-y-auto border border-outline-variant/20">
                    {/* Sticky Top Bar inside Lyrics Panel with Prominent Copy Lyrics Button */}
                    <div className="sticky top-0 z-10 bg-surface-container-lowest/95 backdrop-blur-md pb-space-sm border-b border-outline-variant/20 flex items-center justify-between gap-2">
                      <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary-fixed font-bold flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px]">lyrics</span>
                        <span>Letra de la Canción (02_lyrics.txt)</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <CopyButton
                          textToCopy={lyrics}
                          label="Copiar Letra"
                          copiedLabel="¡Letra Copiada al Portapapeles!"
                          iconSize="text-[14px]"
                          className="px-3 py-1 rounded bg-primary-container text-on-primary-fixed font-label-sm text-label-sm uppercase font-bold shadow-[0_0_12px_rgba(0,224,255,0.3)] hover:brightness-110"
                        />
                      </div>
                    </div>

                    {lyricsEditMode ? (
                      <textarea
                        rows={16}
                        value={lyrics}
                        onChange={handleLyricsChange}
                        placeholder={
                          isVideogameMode
                            ? '[Intro]\n[Solo cello and dark ritual percussion]\n\n[Vocal Intro / Verse 1: Ethereal Soprano Vocalise]\nLú-mi-na... vé-la-ri...\n(Sanctus!)'
                            : '[Intro]\nMúsica de la cuatro cero tres,\nCorridos en ache-te-eme-ele...\n\n[Verso 1]\n...'
                        }
                        className="w-full bg-surface-container-low/60 rounded-lg p-space-md text-on-surface font-body-md text-body-md leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary-container/50 resize-y"
                      />
                    ) : (
                      <div onDoubleClick={() => setLyricsEditMode(true)} title="Doble clic para editar letra">
                        <FormattedLyricsPreview lyrics={lyrics} />
                      </div>
                    )}

                    {/* Bottom quick stats + Copy button inside lyric box */}
                    <div className="sticky bottom-0 bg-surface-container-lowest/95 backdrop-blur-md pt-space-xs flex flex-wrap items-center justify-between gap-2 text-on-surface-variant font-label-sm text-label-sm border-t border-outline-variant/20">
                      <span>{lyricsWordCount} Palabras • Doble clic para editar en vivo</span>
                      <div className="flex items-center gap-3">
                        <span className="text-primary-container font-semibold hidden sm:inline">
                          {isVideogameMode
                            ? 'Arco Dinámico OST (Inglés / Latín / Glossolalia)'
                            : 'Estructura Óptima para Suno v3.5 / v4'}
                        </span>
                        <CopyButton
                          textToCopy={lyrics}
                          label="Copiar Letra"
                          copiedLabel="¡Copiada!"
                          iconSize="text-[12px]"
                          className="px-2.5 py-0.5 rounded bg-surface-container-highest hover:bg-primary-container text-primary-fixed hover:text-on-primary-fixed font-label-sm text-label-sm uppercase font-bold"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 4: Social Media Copy-Paste Engine (Bento Box Full Width) */}
              <section className="bg-surface-container rounded-xl p-space-xl shadow-lg space-y-space-lg">
                <div className="flex flex-wrap items-center justify-between gap-space-sm">
                  <div>
                    <div className="flex items-center gap-space-xs">
                      <span className="w-2 h-2 rounded-full bg-primary-fixed-dim" />
                      <span className="font-label-sm text-label-sm text-primary-fixed-dim uppercase tracking-wider">
                        Social Copy Automation
                      </span>
                    </div>
                    <h3 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-0.5">
                      Motor de Copywriting para Redes &amp; Lanzamiento
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-space-sm">
                    <button
                      type="button"
                      onClick={handleRegenData}
                      disabled={generatingDataState}
                      className="px-space-md py-1 rounded bg-surface-container-high hover:bg-surface-bright text-primary-fixed font-label-md text-label-md flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <span
                        className={`material-symbols-outlined text-[15px] ${
                          generatingDataState ? 'animate-spin' : ''
                        }`}
                      >
                        autorenew
                      </span>
                      <span>
                        {generatingDataState ? 'Regenerando...' : 'Regenerar Copy Social'}
                      </span>
                    </button>

                    {/* Platform Tabs */}
                    <div className="flex items-center gap-1 bg-surface-container-lowest p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setSocialTab('youtube')}
                        className={`px-space-md py-1 rounded font-label-md text-label-md flex items-center gap-1 transition-colors cursor-pointer ${
                          socialTab === 'youtube'
                            ? 'bg-surface-container-high text-primary-container font-bold shadow'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">smart_display</span>
                        <span>YouTube</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSocialTab('tiktok')}
                        className={`px-space-md py-1 rounded font-label-md text-label-md flex items-center gap-1 transition-colors cursor-pointer ${
                          socialTab === 'tiktok'
                            ? 'bg-surface-container-high text-primary-container font-bold shadow'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">phone_iphone</span>
                        <span>TikTok</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSocialTab('raw')}
                        className={`px-space-md py-1 rounded font-label-md text-label-md flex items-center gap-1 transition-colors cursor-pointer ${
                          socialTab === 'raw'
                            ? 'bg-surface-container-high text-primary-container font-bold shadow'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">description</span>
                        <span>Data.txt</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* YouTube Content Pane */}
                {socialTab === 'youtube' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
                    {/* Col 1: Titulo Optimizado */}
                    <div className="bg-surface-container-low rounded-lg p-space-md space-y-space-sm flex flex-col justify-between shadow-sm">
                      <div className="space-y-space-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-label-sm text-label-sm text-outline uppercase font-bold">
                            Título Optimizado (SEO &amp; CTR)
                          </span>
                          <span className="font-label-sm text-label-sm text-primary-container">
                            {socialFields.ytTitle.length} / 100 Caracteres
                          </span>
                        </div>
                        <p className="font-body-md text-body-md text-on-surface font-semibold bg-surface-container-lowest p-space-sm rounded">
                          {socialFields.ytTitle}
                        </p>
                      </div>
                      <CopyButton
                        textToCopy={socialFields.ytTitle}
                        label="Copiar Título"
                        copiedLabel="¡Título Copiado!"
                        className="w-full py-1.5 rounded bg-surface-container-highest hover:bg-surface-bright text-on-surface font-label-md text-label-md"
                      />
                    </div>

                    {/* Col 2: Descripcion Completa */}
                    <div className="bg-surface-container-low rounded-lg p-space-md space-y-space-sm flex flex-col justify-between shadow-sm">
                      <div className="space-y-space-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-label-sm text-label-sm text-outline uppercase font-bold">
                            Descripción con Letras &amp; Créditos
                          </span>
                          <span className="font-label-sm text-label-sm text-primary-container">
                            Completo
                          </span>
                        </div>
                        <div className="font-body-sm text-body-sm text-on-surface-variant bg-surface-container-lowest p-space-sm rounded max-h-28 overflow-y-auto whitespace-pre-wrap leading-normal">
                          {socialFields.ytDesc}
                        </div>
                      </div>
                      <CopyButton
                        textToCopy={socialFields.ytDesc}
                        label="Copiar Descripción"
                        copiedLabel="¡Descripción Copiada!"
                        className="w-full py-1.5 rounded bg-surface-container-highest hover:bg-surface-bright text-on-surface font-label-md text-label-md"
                      />
                    </div>

                    {/* Col 3: Tags Comma-Separated */}
                    <div className="bg-surface-container-low rounded-lg p-space-md space-y-space-sm flex flex-col justify-between shadow-sm">
                      <div className="space-y-space-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-label-sm text-label-sm text-outline uppercase font-bold">
                            Tags para YouTube Studio
                          </span>
                          <span className="font-label-sm text-label-sm text-primary-container">
                            {ytTagsCount} Tags Listos
                          </span>
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant bg-surface-container-lowest p-space-sm rounded max-h-28 overflow-y-auto">
                          {socialFields.ytTags}
                        </p>
                      </div>
                      <CopyButton
                        textToCopy={socialFields.ytTags}
                        label="Copiar Tags Separados"
                        copiedLabel="¡Tags Copiados!"
                        className="w-full py-1.5 rounded bg-surface-container-highest hover:bg-surface-bright text-on-surface font-label-md text-label-md"
                      />
                    </div>
                  </div>
                )}

                {/* TikTok Content Pane */}
                {socialTab === 'tiktok' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
                    <div className="bg-surface-container-low rounded-lg p-space-md space-y-space-sm flex flex-col justify-between shadow-sm">
                      <div className="space-y-space-xs">
                        <span className="font-label-sm text-label-sm text-outline uppercase font-bold">
                          Caption Viral TikTok
                        </span>
                        <p className="font-body-md text-body-md text-on-surface bg-surface-container-lowest p-space-sm rounded whitespace-pre-wrap">
                          {socialFields.ttCaption}
                        </p>
                      </div>
                      <CopyButton
                        textToCopy={`${socialFields.ttCaption}\n\n${socialFields.ttHashtags}`}
                        label="Copiar Caption + Hashtags"
                        copiedLabel="¡Caption Copiado!"
                        className="w-full py-1.5 rounded bg-surface-container-highest hover:bg-surface-bright text-on-surface font-label-md text-label-md"
                      />
                    </div>

                    <div className="bg-surface-container-low rounded-lg p-space-md space-y-space-sm flex flex-col justify-between shadow-sm">
                      <div className="space-y-space-xs">
                        <span className="font-label-sm text-label-sm text-outline uppercase font-bold">
                          Trending Hashtag Cluster
                        </span>
                        <p className="font-body-md text-body-md text-primary-fixed bg-surface-container-lowest p-space-sm rounded">
                          {socialFields.ttHashtags}
                        </p>
                      </div>
                      <CopyButton
                        textToCopy={socialFields.ttHashtags}
                        label="Copiar Hashtags"
                        copiedLabel="¡Hashtags Copiados!"
                        className="w-full py-1.5 rounded bg-surface-container-highest hover:bg-surface-bright text-on-surface font-label-md text-label-md"
                      />
                    </div>
                  </div>
                )}

                {/* Raw Data.txt Editor Pane */}
                {socialTab === 'raw' && (
                  <div className="bg-surface-container-low rounded-lg p-space-md space-y-space-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm text-label-sm text-outline uppercase font-bold">
                        Archivo Data.txt Completo (Edición en Vivo)
                      </span>
                      <CopyButton
                        textToCopy={dataText}
                        label="Copiar Todo Data.txt"
                        copiedLabel="¡Data.txt Copiado!"
                        className="px-space-md py-1 rounded bg-surface-container-highest hover:bg-surface-bright text-on-surface font-label-sm text-label-sm"
                      />
                    </div>
                    <textarea
                      rows={10}
                      value={dataText}
                      onChange={handleDataChange}
                      className="w-full bg-surface-container-lowest rounded p-space-md font-body-sm text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
                    />
                  </div>
                )}
              </section>

              {/* STEP 5: Sticky Footer Workflow Navigation Bar */}
              <div className="w-full bg-surface-container-lowest/90 backdrop-blur-xl rounded-xl p-space-lg shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-space-md border border-outline-variant/25">
                <div className="flex items-center gap-space-lg">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-8 h-8 rounded-full bg-primary-container/20 flex items-center justify-center text-primary-container">
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                    </div>
                    <div>
                      <div className="font-label-sm text-label-sm text-outline uppercase font-bold">
                        Estado del Pipeline
                      </div>
                      <div className="font-headline-sm text-headline-sm text-on-surface">
                        Assets Creativos Listos ({completedAssetsCount}/4)
                      </div>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        hasLyricsReady ? 'bg-primary-container' : 'bg-outline'
                      }`}
                    />
                    <span>{hasLyricsReady ? 'Letra generada' : 'Sin letra'}</span>
                    <span className="text-outline-variant">•</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        hasCoverReady ? 'bg-primary-container' : 'bg-outline'
                      }`}
                    />
                    <span>{hasCoverReady ? 'Cover Art listo' : 'Sin Cover Art'}</span>
                    <span className="text-outline-variant">•</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        hasAudioReady ? 'bg-primary-container' : 'bg-tertiary-container'
                      }`}
                    />
                    <span>
                      {hasAudioReady ? 'Audio .mp3 vinculado' : 'Esperando audio .mp3 en Hub'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-space-md w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleSaveStylesAndPrompt}
                    disabled={saving}
                    className="px-space-lg py-space-sm rounded-lg bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-md text-label-md transition-colors cursor-pointer"
                  >
                    {saving ? 'Guardando...' : 'Guardar Borrador'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView('render-studio')}
                    className="px-space-xl py-space-sm rounded-lg bg-gradient-to-r from-primary-container via-primary-fixed-dim to-secondary-container text-on-primary-fixed font-headline-sm text-headline-sm font-bold flex items-center gap-space-xs shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                  >
                    <span>Continuar a Audio Hub &amp; Render Studio</span>
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </button>
                </div>
              </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            VIEW 2: AUDIO HUB & VIDEO RENDER STUDIO (example.html part 2)
           ===================================================================== */}
        {activeView === 'render-studio' && (
          <div className="flex flex-col w-full">
            <div className="p-space-xl space-y-space-xl max-w-[1720px] mx-auto w-full">
              {/* Top Telemetry & Track Production Header */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-md p-space-lg rounded-xl bg-surface-container-low shadow-xl">
                <div className="flex flex-wrap items-center gap-space-md">
                  <div className="flex items-center gap-space-xs px-space-md py-space-xs rounded-lg bg-surface-container-high text-primary-fixed">
                    <span className="material-symbols-outlined text-[18px] text-primary-container animate-pulse">
                      radio_button_checked
                    </span>
                    <span className="font-label-lg text-label-lg uppercase tracking-wider">
                      TRACK ACTIVE
                    </span>
                  </div>
                  <div>
                    <h1 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">
                      Producción: &ldquo;{title || project.name}&rdquo;
                    </h1>
                    <p className="font-body-sm text-body-sm text-on-surface-variant flex flex-wrap items-center gap-space-xs mt-0.5">
                      <span className="text-primary-container">Género:</span>{' '}
                      {activeGenreCard.title}
                      <span className="text-outline-variant">•</span>
                      <span className="text-secondary">BPM:</span> {activeGenreCard.bpm}
                      <span className="text-outline-variant">•</span>
                      <span className="text-primary-fixed">Master:</span> {activeGenreCard.tuning}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-space-sm w-full lg:w-auto">
                  <button
                    type="button"
                    onClick={() => setActiveView('wizard')}
                    className="px-space-md py-space-xs rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex items-center gap-space-xs text-body-sm font-body-sm transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary-container">
                      arrow_back
                    </span>
                    <span>Volver a Géneros &amp; Letras</span>
                  </button>
                  <div
                    className={`px-space-md py-space-xs rounded-lg font-label-md text-label-md flex items-center gap-space-xs ${
                      canRenderVideo
                        ? 'bg-surface-container-highest text-primary-fixed'
                        : 'bg-surface-container text-tertiary-fixed'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        canRenderVideo ? 'bg-primary-container' : 'bg-tertiary-container'
                      }`}
                    />
                    <span>
                      {canRenderVideo
                        ? 'MOTOR DE RENDER DESBLOQUEADO'
                        : 'SUBE EL AUDIO .MP3 PARA DESBLOQUEAR RENDER'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3: Suno Audio Ingestion & Verification Deck */}
              <div
                ref={audioSectionRef}
                className="grid grid-cols-1 xl:grid-cols-12 gap-space-xl"
              >
                {/* Audio Drop & Suno File Player (8 Cols) */}
                <div className="xl:col-span-8 flex flex-col gap-space-lg p-space-xl rounded-xl bg-surface-container-lowest shadow-2xl">
                  <div className="flex flex-wrap items-center justify-between gap-space-sm">
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-primary-container text-[24px]">
                        graphic_eq
                      </span>
                      <div>
                        <span className="font-label-sm text-label-sm text-primary-fixed-dim uppercase tracking-widest block">
                          PASO 03 // AUDIO INGESTION
                        </span>
                        <h2 className="font-headline-sm text-headline-sm text-on-surface">
                          Suno AI MP3 Integration Deck
                        </h2>
                      </div>
                    </div>
                    <span className="font-label-sm text-label-sm px-space-sm py-space-xs rounded bg-surface-container-high text-primary-fixed">
                      Suno AI v3.5 / v4 / v4.5 COMPATIBLE
                    </span>
                  </div>

                  {/* Loaded Audio Player Deck (if audio exists) */}
                  {project.has_audio ? (
                    <div className="p-space-lg rounded-xl bg-surface-container-low flex flex-col gap-space-md shadow-inner">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-space-sm">
                        <div className="flex items-center gap-space-md min-w-0">
                          <div className="w-12 h-12 rounded-lg bg-primary-container/10 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-primary-container text-[24px]">
                              audio_file
                            </span>
                          </div>
                          <div className="min-w-0">
                            <span className="font-headline-sm text-headline-sm text-on-surface truncate block">
                              {project.audio_name || '03_song.mp3'}
                            </span>
                            <span className="font-label-sm text-label-sm text-on-surface-variant">
                              48kHz • 320kbps • Audio Master Vinculado al Proyecto
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-space-xs shrink-0 self-end md:self-auto">
                          <span className="font-label-md text-label-md px-space-sm py-space-xs rounded bg-surface-container-highest text-primary-fixed">
                            SYNC TIME: {formatTime(duration)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'audio/*';
                              input.onchange = (e) => {
                                const selected = e.target.files?.[0];
                                if (selected) onOpenUploadAudio(selected);
                              };
                              input.click();
                            }}
                            className="px-space-md py-space-xs rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center gap-space-xs transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              swap_horiz
                            </span>
                            <span>Reemplazar</span>
                          </button>
                        </div>
                      </div>

                      {/* Interactive Glowing Waveform Track */}
                      <div className="space-y-space-xs">
                        <div
                          onClick={(e) => {
                            if (!audioRef.current || !duration) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const ratio = Math.max(
                              0,
                              Math.min(1, (e.clientX - rect.left) / rect.width)
                            );
                            const nextTime = ratio * duration;
                            audioRef.current.currentTime = nextTime;
                            setCurrentTime(nextTime);
                          }}
                          className="relative h-14 w-full bg-surface-container-lowest rounded-lg p-2 flex items-center justify-between gap-[3px] overflow-hidden group cursor-pointer"
                          title="Haz clic para adelantar o retroceder en la pista"
                        >
                          {/* Visual Simulated Symmetrical Audio Scrubber */}
                          <div
                            className="absolute inset-y-0 left-0 bg-primary-container/10 pointer-events-none transition-all"
                            style={{ width: `${progressPct}%` }}
                          />
                          <div
                            className="absolute inset-y-0 w-[2px] bg-primary-container shadow-[0_0_8px_rgba(0,240,255,0.8)] z-10 transition-all"
                            style={{ left: `${progressPct}%` }}
                          />
                          {/* Waveform Bars Array */}
                          {DECK_WAVEFORM_HEIGHTS.map((h, i) => {
                            const barPct = (i / DECK_WAVEFORM_HEIGHTS.length) * 100;
                            const isPlayed = barPct <= progressPct;
                            return (
                              <span
                                key={i}
                                style={{ height: `${h * 3.5}px` }}
                                className={`w-1 rounded-full transition-colors ${
                                  isPlayed
                                    ? 'bg-primary-container shadow-[0_0_4px_rgba(0,240,255,0.4)]'
                                    : 'bg-outline-variant'
                                }`}
                              />
                            );
                          })}
                        </div>

                        {/* Transport playback controls */}
                        <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs">
                          <div className="flex items-center gap-space-sm">
                            <button
                              type="button"
                              onClick={() => skipAudio(-10)}
                              className="w-9 h-9 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                              title="Retroceder 10 segundos"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                replay_10
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={togglePlayAudio}
                              className="w-10 h-10 rounded-lg bg-primary-container text-on-primary-container font-bold flex items-center justify-center shadow-[0_0_12px_rgba(0,240,255,0.4)] transition-transform active:scale-95 cursor-pointer"
                              title={isPlaying ? 'Pausar' : 'Reproducir'}
                            >
                              <span className="material-symbols-outlined text-[22px]">
                                {isPlaying ? 'pause' : 'play_arrow'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => skipAudio(10)}
                              className="w-9 h-9 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                              title="Adelantar 10 segundos"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                forward_10
                              </span>
                            </button>
                            <span className="font-label-md text-label-md text-primary-fixed ml-space-sm">
                              {formatTime(currentTime)} / {formatTime(duration)}
                            </span>
                          </div>

                          <div className="flex items-center gap-space-sm">
                            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                              volume_up
                            </span>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={volume}
                              onChange={(e) => handleVolumeChange(Number(e.target.value))}
                              className="w-24 h-1.5 accent-[#00e0ff] bg-surface-container-highest rounded-full cursor-pointer"
                            />
                            <span className="font-label-sm text-label-sm text-on-surface-variant w-8">
                              {Math.round(volume * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Drag & Drop Zone for Suno MP3 */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const droppedFile = e.dataTransfer.files?.[0];
                      if (droppedFile) onOpenUploadAudio(droppedFile);
                    }}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'audio/*';
                      input.onchange = (e) => {
                        const selected = e.target.files?.[0];
                        if (selected) onOpenUploadAudio(selected);
                      };
                      input.click();
                    }}
                    className={`rounded-xl border-2 border-dashed transition-all cursor-pointer flex items-center justify-between gap-space-md ${
                      project.has_audio
                        ? 'p-space-md bg-surface-container-low/50 border-outline-variant/40 hover:border-primary-container/60 text-on-surface-variant'
                        : 'p-space-xl bg-surface-container-low border-primary-container/40 hover:border-primary-container text-on-surface'
                    }`}
                  >
                    <div className="flex items-center gap-space-md">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary-fixed-dim shrink-0">
                        <span className="material-symbols-outlined text-[22px]">cloud_upload</span>
                      </div>
                      <div>
                        <span className="font-headline-sm text-headline-sm text-on-surface block">
                          {project.has_audio
                            ? 'Arrastra un nuevo .mp3 desde Suno para actualizar la pista'
                            : 'Arrastra aquí el archivo .mp3 descargado de Suno AI'}
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">
                          Se te preguntará si deseas renombrarlo a{' '}
                          <code className="text-primary">{title || project.name}.mp3</code> o
                          conservar el nombre original.
                        </span>
                      </div>
                    </div>
                    <span className="font-label-sm text-label-sm px-space-md py-space-sm rounded bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container transition-colors shrink-0">
                      SUBIR MP3 SUNO
                    </span>
                  </div>
                </div>

                {/* Asset Pipeline Checklist & Validation Card (4 Cols) */}
                <div className="xl:col-span-4 flex flex-col justify-between p-space-xl rounded-xl bg-surface-container-lowest shadow-2xl">
                  <div className="space-y-space-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-space-xs">
                        <span className="material-symbols-outlined text-primary-container text-[20px]">
                          checklist_rtl
                        </span>
                        <span className="font-label-sm text-label-sm text-primary-fixed-dim uppercase tracking-wider">
                          PIPELINE CHECKLIST
                        </span>
                      </div>
                      <span className="font-label-sm text-label-sm px-space-sm py-[2px] rounded bg-primary-container/10 text-primary-fixed">
                        {completedAssetsCount}/4 COMPLETADO
                      </span>
                    </div>
                    <p className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      Validación de Assets
                    </p>
                    <div className="space-y-space-sm pt-space-xs">
                      <div className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low">
                        <div className="flex items-center gap-space-sm">
                          <span
                            className={`material-symbols-outlined text-[18px] ${
                              hasLyricsReady ? 'text-primary-container' : 'text-outline'
                            }`}
                          >
                            {hasLyricsReady ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <span className="font-body-sm text-body-sm text-on-surface">
                            Letra IA Generada (02_lyrics.txt)
                          </span>
                        </div>
                        <span className="font-label-sm text-label-sm text-on-surface-variant font-bold">
                          {hasLyricsReady ? '100% OK' : 'FALTA'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low">
                        <div className="flex items-center gap-space-sm">
                          <span
                            className={`material-symbols-outlined text-[18px] ${
                              hasCoverReady ? 'text-primary-container' : 'text-outline'
                            }`}
                          >
                            {hasCoverReady ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <span className="font-body-sm text-body-sm text-on-surface">
                            Portada Hi-Res (03_background.png)
                          </span>
                        </div>
                        <span className="font-label-sm text-label-sm text-on-surface-variant font-bold">
                          {hasCoverReady ? '100% OK' : 'FALTA'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low">
                        <div className="flex items-center gap-space-sm">
                          <span
                            className={`material-symbols-outlined text-[18px] ${
                              hasSocialReady ? 'text-primary-container' : 'text-outline'
                            }`}
                          >
                            {hasSocialReady ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <span className="font-body-sm text-body-sm text-on-surface">
                            Metadatos &amp; Copy (Data.txt)
                          </span>
                        </div>
                        <span className="font-label-sm text-label-sm text-on-surface-variant font-bold">
                          {hasSocialReady ? '100% OK' : 'FALTA'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low">
                        <div className="flex items-center gap-space-sm">
                          <span
                            className={`material-symbols-outlined text-[18px] ${
                              hasAudioReady ? 'text-primary-container' : 'text-tertiary-container'
                            }`}
                          >
                            {hasAudioReady ? 'check_circle' : 'pending'}
                          </span>
                          <span className="font-body-sm text-body-sm text-on-surface">
                            Audio Suno Vinculado (.mp3)
                          </span>
                        </div>
                        <span
                          className={`font-label-sm text-label-sm font-bold ${
                            hasAudioReady ? 'text-secondary' : 'text-tertiary-fixed'
                          }`}
                        >
                          {hasAudioReady ? 'LOCKED' : 'SUBIR MP3'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-space-lg p-space-md rounded-lg bg-surface-container text-on-surface flex items-center gap-space-md">
                    <span className="material-symbols-outlined text-primary-container text-[24px]">
                      {canRenderVideo ? 'rocket_launch' : 'lock'}
                    </span>
                    <div className="leading-tight">
                      <span className="font-label-md text-label-md text-primary-fixed uppercase tracking-wider block">
                        {canRenderVideo ? 'Estudio Listo para Render' : 'Creación de Video en Espera'}
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        {canRenderVideo
                          ? 'Personaliza abajo las frecuencias reactivas y los formatos 16:9 y 9:16.'
                          : 'Completa los assets previos y sube el .mp3 de Suno para habilitar la creación del video.'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Video Output Format Selector (Formatos de Video de Salida) */}
              <div
                ref={renderSectionRef}
                className="p-space-xl rounded-xl bg-surface-container-lowest shadow-2xl space-y-space-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-space-sm">
                  <div className="flex items-center gap-space-sm">
                    <span className="material-symbols-outlined text-secondary text-[22px]">
                      video_settings
                    </span>
                    <h2 className="font-headline-sm text-headline-sm text-on-surface uppercase tracking-wider">
                      Formatos de Video de Salida
                    </h2>
                  </div>
                  <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-primary-fixed bg-surface-container-high px-space-md py-space-xs rounded-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
                    <span>0 TOKENS DE IA • RENDERIZADO 100% LOCAL GPU (FFMPEG HW ACCEL)</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg pt-space-xs">
                  {/* Card 1: Horizontal 16:9 */}
                  <label
                    className={`relative p-space-lg rounded-xl transition-all cursor-pointer shadow-lg flex items-start gap-space-md group ${
                      render16x9
                        ? 'bg-surface-container ring-1 ring-primary-container/50'
                        : 'bg-surface-container-low hover:bg-surface-container'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={render16x9}
                      onChange={(e) => setRender16x9(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded bg-surface-container-highest text-primary-container accent-[#00F0FF] cursor-pointer"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-space-xs">
                        <span className="material-symbols-outlined text-primary-container text-[18px]">
                          desktop_windows
                        </span>
                        <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                          Horizontal 16:9 (YouTube / Full HD)
                        </span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                        1920×1080 con audio-reactividad completa multi-banda, beat shake sub-bajo e
                        iluminación rim-light 3D adaptada a monitores panorámicos.
                      </p>
                      <div className="flex items-center gap-space-xs pt-space-xs">
                        <span className="font-label-sm text-label-sm px-space-xs py-[2px] rounded bg-surface-container-high text-primary-fixed">
                          1080p 60FPS
                        </span>
                        <span className="font-label-sm text-label-sm px-space-xs py-[2px] rounded bg-surface-container-high text-on-surface-variant">
                          Bitrate: 18 Mbps
                        </span>
                      </div>
                    </div>
                  </label>

                  {/* Card 2: Vertical 9:16 */}
                  <label
                    className={`relative p-space-lg rounded-xl transition-all cursor-pointer shadow-lg flex items-start gap-space-md group ${
                      render9x16
                        ? 'bg-surface-container ring-1 ring-primary-container/50'
                        : 'bg-surface-container-low hover:bg-surface-container'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={render9x16}
                      onChange={(e) => setRender9x16(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded bg-surface-container-highest text-primary-container accent-[#00F0FF] cursor-pointer"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-space-xs">
                        <span className="material-symbols-outlined text-secondary text-[18px]">
                          stay_current_portrait
                        </span>
                        <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                          Vertical 9:16 (TikTok / Reels / Shorts)
                        </span>
                        <span className="font-label-sm text-label-sm px-space-xs py-[1px] rounded bg-secondary-container/20 text-secondary">
                          Recomendado
                        </span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                        Recorte vertical centrado 1080×1920 optimizado con HUD dinámico para
                        retención en feeds móviles y redes sociales verticales.
                      </p>
                      <div className="flex items-center gap-space-xs pt-space-xs">
                        <span className="font-label-sm text-label-sm px-space-xs py-[2px] rounded bg-surface-container-high text-secondary">
                          VIRAL FORMAT
                        </span>
                        <span className="font-label-sm text-label-sm px-space-xs py-[2px] rounded bg-surface-container-high text-on-surface-variant">
                          Auto Smart-Crop
                        </span>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Waveform Style Visualizer Studio (Presets + Live Reactive Canvas Preview) */}
              <div className="p-space-xl rounded-xl bg-surface-container-lowest shadow-2xl space-y-space-lg">
                <div className="flex flex-wrap items-center justify-between gap-space-sm">
                  <div className="flex items-center gap-space-sm">
                    <span className="material-symbols-outlined text-primary-container text-[24px]">
                      equalizer
                    </span>
                    <div>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface uppercase tracking-wider">
                        Estilo de Forma de Onda (Visualizer 1:1)
                      </h2>
                      <p className="text-[11px] text-on-surface-variant">
                        Estandarizado 1:1 con el motor de video MP4. Crea, modifica o elimina tus propias ondas.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="font-label-sm text-label-sm text-on-surface-variant">
                      SELECCIONADO //{' '}
                      <span className="text-primary-fixed font-bold uppercase">
                        {waveformPresets.find((p) => p.id === waveformStyle)?.name || waveformStyle}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsWaveDesignerOpen(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-primary-container text-on-primary-fixed font-headline-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm hover:brightness-105 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">tune</span>
                      <span>+ Crear / Editar Ondas</span>
                    </button>
                  </div>
                </div>

                {/* Main Visualizer Grid (Presets Left, Canvas Preview Right) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl">
                  {/* Left: Presets Column (5 Cols) */}
                  <div className="lg:col-span-5 flex flex-col gap-space-sm max-h-[420px] overflow-y-auto pr-1">
                    {waveformPresets.map((ws) => {
                      const isSelected = waveformStyle === ws.id;
                      return (
                        <div
                          key={ws.id}
                          onClick={() => {
                            setWaveformStyle(ws.id);
                            setWaveformParams(ws.params || null);
                          }}
                          className={`p-space-md rounded-xl cursor-pointer transition-colors flex items-center justify-between group border ${
                            isSelected
                              ? 'bg-surface-container-high border-primary-container/60 shadow-lg'
                              : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/20'
                          }`}
                        >
                          <div className="space-y-0.5 pr-2 min-w-0 flex-1">
                            <span
                              className={`font-headline-sm text-headline-sm block truncate transition-colors ${
                                isSelected
                                  ? 'text-primary-fixed font-bold'
                                  : 'text-on-surface group-hover:text-primary-fixed'
                              }`}
                            >
                              {ws.name}
                            </span>
                            <span
                              className={`font-body-sm text-body-sm line-clamp-1 ${
                                isSelected ? 'text-on-surface' : 'text-on-surface-variant'
                              }`}
                            >
                              {ws.desc}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setWaveformStyle(ws.id);
                                setWaveformParams(ws.params || null);
                                setIsWaveDesignerOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-surface-container hover:bg-primary-container/20 text-on-surface-variant hover:text-primary-fixed transition-colors cursor-pointer"
                              title="Modificar parámetros de esta onda"
                            >
                              <span className="material-symbols-outlined text-[15px]">edit</span>
                            </button>
                            {waveformPresets.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteWaveformPreset(ws.id);
                                }}
                                className="p-1.5 rounded-lg bg-surface-container hover:bg-error-container/30 text-on-surface-variant hover:text-error transition-colors cursor-pointer"
                                title="Eliminar esta onda"
                              >
                                <span className="material-symbols-outlined text-[15px]">delete</span>
                              </button>
                            )}
                            <span
                              className={`w-3.5 h-3.5 rounded-full ml-1 ${
                                isSelected
                                  ? 'bg-primary-container shadow-[0_0_8px_rgba(0,224,255,1)]'
                                  : 'bg-outline-variant'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right: Real-time Visualizer Canvas Monitor (7 Cols) */}
                  <div className="lg:col-span-7 flex flex-col justify-between bg-surface-container-low rounded-xl p-space-md">
                    <WaveformPreviewCanvas
                      backgroundImageUrl={getImageUrl(project.rel_path, imageVersion)}
                      hasBg={project.has_bg}
                      waveformStyle={waveformStyle}
                      waveformParams={waveformParams}
                      waveformCatalog={waveformPresets}
                      primaryColor={primaryColor}
                      secondaryColor={secondaryColor}
                      colorMode={colorMode}
                      paletteColors={paletteColors}
                      shakeIntensity={shakeIntensity}
                      bgPulse={bgPulse}
                      onSaveSpec={handleSaveStylesAndPrompt}
                      onOpenWaveDesigner={() => setIsWaveDesignerOpen(true)}
                    />
                  </div>
                </div>
              </div>

              {/* Color Palette & Motion Tuning Controls Section */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl">
                {/* Palette Matrix (6 Cols) */}
                <div className="lg:col-span-6 p-space-xl rounded-xl bg-surface-container-lowest shadow-2xl flex flex-col justify-between space-y-space-lg">
                  <div className="space-y-space-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-space-xs">
                        <span className="material-symbols-outlined text-secondary text-[22px]">
                          palette
                        </span>
                        <h3 className="font-headline-sm text-headline-sm text-on-surface uppercase tracking-wider">
                          Paleta de Colores
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={handleExtractPalette}
                        disabled={extractingPaletteState}
                        className="font-label-sm text-label-sm px-space-md py-space-xs rounded bg-surface-container-high hover:bg-surface-container-highest text-primary-container flex items-center gap-space-xs transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
                        <span>
                          {extractingPaletteState ? 'Extrayendo...' : 'Extraer del fondo'}
                        </span>
                      </button>
                    </div>

                    {/* Color Preset Chips */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-sm">
                      {PALETTE_PRESETS.map((p) => {
                        const isCurrent =
                          primaryColor.toLowerCase() === p.colors[0].toLowerCase();
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setPrimaryColor(p.colors[0]);
                              setSecondaryColor(p.colors[p.colors.length - 1]);
                              setPaletteColors(p.colors);
                            }}
                            className={`p-space-sm rounded-lg flex items-center gap-space-sm transition-colors text-left cursor-pointer ${
                              isCurrent
                                ? 'bg-surface-container-high shadow-md'
                                : 'bg-surface-container-low hover:bg-surface-container'
                            }`}
                          >
                            <div className="flex -space-x-1 shrink-0">
                              {p.colors.slice(0, 2).map((c, idx) => (
                                <span
                                  key={idx}
                                  className="w-3.5 h-3.5 rounded-full"
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                            <span
                              className={`font-label-sm text-label-sm truncate ${
                                isCurrent ? 'text-primary-fixed font-bold' : 'text-on-surface'
                              }`}
                            >
                              {p.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hex Color Code Pickers */}
                  <div className="grid grid-cols-2 gap-space-md pt-space-sm">
                    <div className="p-space-md rounded-lg bg-surface-container-low flex items-center justify-between">
                      <div>
                        <span className="font-label-sm text-label-sm text-on-surface-variant block">
                          Color Primario
                        </span>
                        <input
                          type="text"
                          value={primaryColor}
                          onChange={(e) => {
                            setPrimaryColor(e.target.value);
                            setPaletteColors([e.target.value, secondaryColor]);
                          }}
                          className="w-24 bg-transparent font-headline-sm text-headline-sm text-primary-fixed font-mono font-bold focus:outline-none"
                        />
                      </div>
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => {
                          setPrimaryColor(e.target.value);
                          setPaletteColors([e.target.value, secondaryColor]);
                        }}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                    </div>

                    <div className="p-space-md rounded-lg bg-surface-container-low flex items-center justify-between">
                      <div>
                        <span className="font-label-sm text-label-sm text-on-surface-variant block">
                          Color Secundario
                        </span>
                        <input
                          type="text"
                          value={secondaryColor}
                          onChange={(e) => {
                            setSecondaryColor(e.target.value);
                            setPaletteColors([primaryColor, e.target.value]);
                          }}
                          className="w-24 bg-transparent font-headline-sm text-headline-sm text-secondary font-mono font-bold focus:outline-none"
                        />
                      </div>
                      <input
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => {
                          setSecondaryColor(e.target.value);
                          setPaletteColors([primaryColor, e.target.value]);
                        }}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                    </div>
                  </div>
                </div>

                {/* Motion & Dynamics Tuning (6 Cols) */}
                <div className="lg:col-span-6 p-space-xl rounded-xl bg-surface-container-lowest shadow-2xl flex flex-col justify-between space-y-space-lg">
                  <div className="space-y-space-md">
                    <div className="flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-primary-container text-[22px]">
                        tune
                      </span>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface uppercase tracking-wider">
                        Efectos de Movimiento &amp; Física
                      </h3>
                    </div>

                    {/* Bass Shake Intensity Slider */}
                    <div className="space-y-space-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-body-sm text-body-sm text-on-surface">
                          Intensidad Bass Shake (Sub-bajo 20-150 Hz)
                        </span>
                        <span className="font-label-md text-label-md text-primary-fixed font-bold bg-surface-container-high px-2 py-0.5 rounded">
                          {shakeIntensity} px
                        </span>
                      </div>

                      <input
                        type="range"
                        min="0"
                        max="12"
                        step="0.5"
                        value={shakeIntensity}
                        onChange={(e) => setShakeIntensity(Number(e.target.value))}
                        className="w-full h-2 accent-[#00e0ff] bg-surface-container-highest rounded-full cursor-pointer"
                      />

                      {/* Segmented Interval Toggles */}
                      <div className="grid grid-cols-4 gap-space-xs pt-space-xs">
                        {[
                          { label: '0px (Fijo)', val: 0 },
                          { label: '3px (Suave)', val: 3 },
                          { label: '6px (Medio)', val: 6 },
                          { label: '12px (Hardcore)', val: 12 },
                        ].map((item) => {
                          const isActive = Math.round(shakeIntensity) === item.val;
                          return (
                            <button
                              key={item.val}
                              type="button"
                              onClick={() => setShakeIntensity(item.val)}
                              className={`py-space-xs rounded font-label-sm text-label-sm text-center transition-colors cursor-pointer ${
                                isActive
                                  ? 'bg-surface-container-high text-primary-fixed font-bold'
                                  : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant'
                              }`}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Reactive Beat Brightness Glow Pulse Toggle */}
                    <label className="p-space-md rounded-lg bg-surface-container-low flex items-center justify-between cursor-pointer hover:bg-surface-container transition-colors">
                      <div className="space-y-0.5">
                        <span className="font-body-md text-body-md text-on-surface font-semibold block">
                          Pulso de brillo reactivo al beat
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant block">
                          Genera flash difuso bloom en frecuencias de bombo y bajo
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={bgPulse}
                        onChange={(e) => setBgPulse(e.target.checked)}
                        className="w-5 h-5 rounded bg-surface-container-highest text-primary-container accent-[#00F0FF] cursor-pointer"
                      />
                    </label>
                  </div>

                  {/* Master Render Button inside motion deck */}
                  <button
                    type="button"
                    onClick={handleStartRender}
                    disabled={!canRenderVideo}
                    className={`w-full py-space-md px-space-xl rounded-xl font-headline-sm text-headline-sm font-bold flex items-center justify-center gap-space-sm transition-all ${
                      canRenderVideo
                        ? 'bg-gradient-to-r from-secondary to-primary-container hover:opacity-95 text-surface-container-lowest shadow-[0_0_24px_rgba(0,240,255,0.4)] active:scale-[0.99] cursor-pointer'
                        : 'bg-surface-container-high text-on-surface-variant opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[24px]">videocam</span>
                    <span>
                      {canRenderVideo
                        ? `INICIAR RENDERIZADO DE VIDEOS (${
                            render16x9 && render9x16
                              ? '16:9 + 9:16'
                              : render16x9
                              ? '16:9'
                              : '9:16'
                          })`
                        : 'SUBE EL AUDIO .MP3 PARA HABILITAR EL RENDERIZADO'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Output Renders Queue & Vault (Videos Generados) */}
              <div className="p-space-xl rounded-xl bg-surface-container-lowest shadow-2xl space-y-space-lg">
                <div className="flex flex-wrap items-center justify-between gap-space-sm">
                  <div className="flex items-center gap-space-sm">
                    <span className="material-symbols-outlined text-primary-container text-[24px]">
                      video_library
                    </span>
                    <h2 className="font-headline-sm text-headline-sm text-on-surface uppercase tracking-wider">
                      Videos Generados &amp; Cola de Exportación
                    </h2>
                  </div>
                  <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px] text-primary-container">
                      folder_special
                    </span>
                    <span>ALMACENAMIENTO LOCAL: /projects/{project.rel_path}/</span>
                  </div>
                </div>

                {/* Video Render Cards Array */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
                  {/* Video 1: 16:9 Landscape YouTube */}
                  <div className="p-space-lg rounded-xl bg-surface-container-low flex flex-col gap-space-md shadow-lg">
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-label-sm text-label-sm px-space-sm py-[2px] rounded uppercase ${
                          project.has_video_16x9
                            ? 'bg-primary-container/20 text-primary-fixed'
                            : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        {project.has_video_16x9 ? 'COMPLETADO 100%' : 'PENDIENTE DE RENDER'}
                      </span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        1920×1080 • 16:9
                      </span>
                    </div>

                    {project.has_video_16x9 ? (
                      <video
                        controls
                        src={getVideo16x9Url(project.rel_path)}
                        className="w-full rounded-lg aspect-video bg-black shadow-lg"
                      />
                    ) : (
                      <div className="aspect-video rounded-lg bg-surface-container-lowest border border-dashed border-outline-variant/40 flex flex-col items-center justify-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-[36px] text-outline mb-1">
                          movie
                        </span>
                        <span className="font-body-sm text-body-sm">
                          Video 16:9 no generado todavía
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs">
                      <div>
                        <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                          Video 16:9 Landscape (YouTube)
                        </h4>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          {project.video_16x9_name || `${title || project.name}_16x9.mp4`}
                        </p>
                      </div>

                      {project.has_video_16x9 && (
                        <a
                          href={getVideo16x9Url(project.rel_path)}
                          download={`${title || project.name}_16x9.mp4`}
                          className="px-space-md py-space-xs rounded-lg bg-primary-container text-on-primary-container font-label-md text-label-md font-bold flex items-center gap-space-xs shadow-md transition-colors hover:bg-primary-fixed"
                        >
                          <span className="material-symbols-outlined text-[16px]">download</span>
                          <span>DESCARGAR MP4</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Video 2: 9:16 Portrait TikTok / Shorts */}
                  <div className="p-space-lg rounded-xl bg-surface-container-low flex flex-col justify-between gap-space-md shadow-lg">
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-label-sm text-label-sm px-space-sm py-[2px] rounded uppercase ${
                          project.has_video_9x16
                            ? 'bg-secondary-container/30 text-secondary'
                            : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        {project.has_video_9x16 ? 'COMPLETADO 100%' : 'PENDIENTE / ON-DEMAND'}
                      </span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        1080×1920 • 9:16
                      </span>
                    </div>

                    {project.has_video_9x16 ? (
                      <div className="max-w-[210px] mx-auto w-full">
                        <video
                          controls
                          src={getVideo9x16Url(project.rel_path)}
                          className="w-full rounded-lg aspect-[9/16] bg-black shadow-lg"
                        />
                      </div>
                    ) : (
                      <div className="flex-1 min-h-[200px] rounded-lg bg-surface-container-lowest border border-dashed border-outline-variant/40 flex flex-col items-center justify-center p-6 text-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-[36px] text-outline mb-1">
                          stay_current_portrait
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface font-semibold">
                          Video 9:16 Portrait (TikTok / Reels)
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant mt-1 max-w-xs">
                          Puedes generarlo junto con el 16:9 o recortarlo al instante si ya tienes
                          el video horizontal.
                        </span>
                        {project.has_video_16x9 && (
                          <button
                            type="button"
                            onClick={handleCrop9x16Now}
                            disabled={cropping9x16State}
                            className="mt-4 px-space-md py-space-xs rounded-lg bg-secondary text-on-secondary font-label-md text-label-md font-bold flex items-center gap-space-xs shadow-md hover:bg-secondary-fixed transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[16px]">crop</span>
                            <span>
                              {cropping9x16State
                                ? 'Recortando 9:16...'
                                : 'Generar 9:16 desde 16:9 Ahora'}
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs">
                      <div>
                        <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                          Video 9:16 Portrait (TikTok / Reels)
                        </h4>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          {project.video_9x16_name || `${title || project.name}_9x16.mp4`}
                        </p>
                      </div>

                      {project.has_video_9x16 && (
                        <a
                          href={getVideo9x16Url(project.rel_path)}
                          download={`${title || project.name}_9x16.mp4`}
                          className="px-space-md py-space-xs rounded-lg bg-secondary text-on-secondary font-label-md text-label-md font-bold flex items-center gap-space-xs shadow-md transition-colors hover:bg-secondary-fixed"
                        >
                          <span className="material-symbols-outlined text-[16px]">download</span>
                          <span>DESCARGAR MP4</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Fullscreen Art Lightbox Modal */}
      {isFullscreenArt && project.has_bg && (
        <div
          onClick={() => setIsFullscreenArt(false)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-lg flex items-center justify-center p-6 cursor-zoom-out"
        >
          <img
            src={getImageUrl(project.rel_path, imageVersion)}
            alt={title}
            className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
          />
          <button
            type="button"
            onClick={() => setIsFullscreenArt(false)}
            className="fixed top-6 right-6 w-10 h-10 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}

      {/* Interactive Wave Designer & Catalog Manager Modal */}
      <WaveDesignerModal
        isOpen={isWaveDesignerOpen}
        onClose={() => setIsWaveDesignerOpen(false)}
        waveformPresets={waveformPresets}
        selectedStyleId={waveformStyle}
        onSelectStyle={(nextId, nextParams) => {
          setWaveformStyle(nextId);
          setWaveformParams(nextParams || null);
        }}
        onSavePresets={handleSaveWaveformPresets}
        onResetFactoryPresets={handleResetWaveformPresets}
        backgroundImageUrl={getImageUrl(project.rel_path, imageVersion)}
        hasBg={project.has_bg}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        colorMode={colorMode}
        paletteColors={paletteColors}
      />
    </div>
  );
}
