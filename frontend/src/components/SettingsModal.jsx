import React, { useState, useEffect } from 'react';
import { fetchAiConfig, resetWaveformCatalog } from '../api';
import { GENRE_CATEGORIES, GENRE_CARDS } from '../constants/genres';
import { DEFAULT_WAVEFORM_PRESETS } from '../constants/waveforms';
import WaveDesignerModal from './WaveDesignerModal';

export default function SettingsModal({
  isOpen,
  onClose,
  catalog,
  onUpdateCatalog,
  theme,
  onToggleTheme,
}) {
  const [activeTab, setActiveTab] = useState('creation_genres'); // 'creation_genres' | 'genre_tags' | 'waveforms' | 'appearance'
  const [saving, setSaving] = useState(false);
  const [aiConfig, setAiConfig] = useState(null);

  // Local editable state synced from catalog
  const [categories, setCategories] = useState(GENRE_CATEGORIES);
  const [genreCards, setGenreCards] = useState(GENRE_CARDS);
  const [genreTags, setGenreTags] = useState([]);
  const [waveformPresets, setWaveformPresets] = useState(DEFAULT_WAVEFORM_PRESETS);
  const [designerTargetId, setDesignerTargetId] = useState(null);

  // New Genre Card Form
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardCategory, setNewCardCategory] = useState('regional');
  const [newCardTag, setNewCardTag] = useState('');
  const [newCardDesc, setNewCardDesc] = useState('');
  const [newCardImage, setNewCardImage] = useState('');
  const [newCardTuning, setNewCardTuning] = useState('Afinación: Estándar');
  const [newCardBpm, setNewCardBpm] = useState('130 BPM');
  const [newCardIsVideogame, setNewCardIsVideogame] = useState(false);
  const [newCardIsAmbientOst, setNewCardIsAmbientOst] = useState(false);
  const [newCardSubgenres, setNewCardSubgenres] = useState([
    { id: 'sub_1', label: '', prompt: '' },
  ]);

  // Adding a subgenre to an existing card
  const [addingSubToCardId, setAddingSubToCardId] = useState(null);
  const [subLabelInput, setSubLabelInput] = useState('');
  const [subPromptInput, setSubPromptInput] = useState('');

  // Adding a new filter category
  const [newCategoryLabel, setNewCategoryLabel] = useState('');

  // Adding a new reusable song genre tag
  const [newGenreTagInput, setNewGenreTagInput] = useState('');

  useEffect(() => {
    if (catalog) {
      setCategories(catalog.creation_categories?.length ? catalog.creation_categories : GENRE_CATEGORIES);
      setGenreCards(catalog.creation_genres?.length ? catalog.creation_genres : GENRE_CARDS);
      setGenreTags(catalog.genre_tags || []);
      setWaveformPresets(
        catalog.waveform_presets?.length ? catalog.waveform_presets : DEFAULT_WAVEFORM_PRESETS
      );
    }
  }, [catalog]);

  useEffect(() => {
    if (isOpen) {
      fetchAiConfig()
        .then((cfg) => setAiConfig(cfg))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const persistCatalog = async (nextCategories, nextCards, nextTags, nextWaveforms = waveformPresets) => {
    setSaving(true);
    try {
      await onUpdateCatalog({
        creation_categories: nextCategories,
        creation_genres: nextCards,
        genre_tags: nextTags,
        waveform_presets: nextWaveforms,
      });
    } finally {
      setSaving(false);
    }
  };

  // --- Creation Genre Card Handlers ---
  const handleCreateGenreCard = async (e) => {
    e.preventDefault();
    if (!newCardTitle.trim()) return;

    const cleanSubs = newCardSubgenres
      .filter((s) => s.label.trim())
      .map((s, idx) => ({
        id: `${newCardTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_sub_${Date.now()}_${idx}`,
        label: s.label.trim(),
        prompt: s.prompt.trim() || `${newCardTitle.trim()} - ${s.label.trim()}`,
      }));

    if (cleanSubs.length === 0) {
      cleanSubs.push({
        id: `default_${Date.now()}`,
        label: `${newCardTitle.trim()} Clásico`,
        prompt: `${newCardTitle.trim()}, producción de estudio profesional, ${newCardBpm}`,
      });
    }

    const catObj = categories.find((c) => c.id === newCardCategory);
    const createdCard = {
      id: `genre_${Date.now()}`,
      category: newCardCategory,
      tag: newCardTag.trim() || catObj?.label || 'Custom Engine',
      title: newCardTitle.trim(),
      description:
        newCardDesc.trim() ||
        `Configuración acústica personalizada para ${newCardTitle.trim()}.`,
      image:
        newCardImage.trim() ||
        'https://lh3.googleusercontent.com/aida-public/AB6AXuA1_7m4cb3eN-_q64O3AQpqTRVR7aR6yO9tXwXn470hoe1XqLmDCXh5uSeu-WmH15RI6Av7laLqU5rtWJBSX9WHFdpFrIJYLmWJ1qqJjU7vYKS8N-0uool1CbZJKndODZIWkrvMlEVxu9ZQs4T6NQ8rDYvzmvodWWCzbsgLVXa0G8TSGTVSUsMcuSNUgrefSdBnznvL7n78Pdg-uWgL8dVT64HGore1K5F92MjgiVg',
      tuning: newCardTuning.trim() || 'Escala: Menor',
      bpm: newCardBpm.trim() || '128 BPM',
      presetName: newCardTitle.trim().toUpperCase().replace(/\s+/g, '_'),
      isVideogame: newCardIsVideogame || newCardIsAmbientOst,
      isAmbientOst: newCardIsAmbientOst,
      subgenres: cleanSubs,
    };

    const nextCards = [createdCard, ...genreCards];
    const nextTags = Array.from(
      new Set([...genreTags, createdCard.title, ...cleanSubs.map((s) => s.label)])
    );
    setGenreCards(nextCards);
    setGenreTags(nextTags);
    await persistCatalog(categories, nextCards, nextTags);

    // Reset form
    setNewCardTitle('');
    setNewCardTag('');
    setNewCardDesc('');
    setNewCardImage('');
    setNewCardIsVideogame(false);
    setNewCardIsAmbientOst(false);
    setNewCardSubgenres([{ id: 'sub_1', label: '', prompt: '' }]);
    setIsCreatingCard(false);
  };

  const handleDeleteGenreCard = async (cardId) => {
    const nextCards = genreCards.filter((c) => c.id !== cardId);
    setGenreCards(nextCards);
    await persistCatalog(categories, nextCards, genreTags);
  };

  const handleAddSubgenreToCard = async (cardId) => {
    if (!subLabelInput.trim()) return;
    const nextCards = genreCards.map((c) => {
      if (c.id !== cardId) return c;
      const newSub = {
        id: `sub_${Date.now()}`,
        label: subLabelInput.trim(),
        prompt: subPromptInput.trim() || `${c.title} - ${subLabelInput.trim()}`,
      };
      return {
        ...c,
        subgenres: [...(c.subgenres || []), newSub],
      };
    });
    const nextTags = genreTags.includes(subLabelInput.trim())
      ? genreTags
      : [...genreTags, subLabelInput.trim()];
    setGenreCards(nextCards);
    setGenreTags(nextTags);
    setAddingSubToCardId(null);
    setSubLabelInput('');
    setSubPromptInput('');
    await persistCatalog(categories, nextCards, nextTags);
  };

  const handleDeleteSubgenreFromCard = async (cardId, subId) => {
    const nextCards = genreCards.map((c) => {
      if (c.id !== cardId) return c;
      return {
        ...c,
        subgenres: (c.subgenres || []).filter((s) => s.id !== subId),
      };
    });
    setGenreCards(nextCards);
    await persistCatalog(categories, nextCards, genreTags);
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const clean = newCategoryLabel.trim();
    if (!clean) return;
    const id = clean.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (categories.some((c) => c.id === id)) return;
    const nextCategories = [...categories, { id, label: clean }];
    setCategories(nextCategories);
    setNewCategoryLabel('');
    await persistCatalog(nextCategories, genreCards, genreTags);
  };

  // --- Reusable Song Genre Tag Handlers ---
  const handleAddReusableGenreTag = async (e) => {
    e.preventDefault();
    const clean = newGenreTagInput.trim();
    if (!clean) return;
    if (genreTags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setNewGenreTagInput('');
      return;
    }
    const nextTags = [...genreTags, clean];
    setGenreTags(nextTags);
    setNewGenreTagInput('');
    await persistCatalog(categories, genreCards, nextTags);
  };

  const handleRemoveReusableGenreTag = async (tagToRemove) => {
    const nextTags = genreTags.filter((t) => t !== tagToRemove);
    setGenreTags(nextTags);
    await persistCatalog(categories, genreCards, nextTags);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-surface-container-lowest/80 backdrop-blur-md p-4 animate-fade-scale">
      <div className="bg-surface-container-low border border-outline-variant/30 rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col shadow-[0_24px_70px_rgba(0,0,0,0.65)] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-surface-container border-b border-outline-variant/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary-container/15 border border-primary-container/40 flex items-center justify-center text-primary-fixed">
              <span className="material-symbols-outlined text-[18px]">settings</span>
            </div>
            <div>
              <h2 className="font-headline-md font-bold text-on-surface tracking-tight">
                Configuraciones del Estudio
              </h2>
              <p className="text-[11px] text-on-surface-variant font-body-sm">
                Gestiona tarjetas de Género & Sub-género Visual, catálogo de etiquetas musicales y apariencia
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {saving && (
              <span className="text-label-sm text-primary-fixed uppercase flex items-center gap-1">
                <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                Guardando...
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 bg-surface-container-lowest border-b border-outline-variant/20 flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('creation_genres')}
            className={`px-4 py-3 text-label-md uppercase border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'creation_genres'
                ? 'border-primary-container text-primary-fixed font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">grid_view</span>
            <span>1. Géneros & Sub-géneros de Creación ({genreCards.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('genre_tags')}
            className={`px-4 py-3 text-label-md uppercase border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'genre_tags'
                ? 'border-primary-container text-primary-fixed font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">sell</span>
            <span>Etiquetas de Género Musical ({genreTags.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('waveforms')}
            className={`px-4 py-3 text-label-md uppercase border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'waveforms'
                ? 'border-primary-container text-primary-fixed font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">equalizer</span>
            <span>Formas de Onda ({waveformPresets.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`px-4 py-3 text-label-md uppercase border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'appearance'
                ? 'border-primary-container text-primary-fixed font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">palette</span>
            <span>Tema Visual & Motores IA</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'creation_genres' && (
            <div className="space-y-6">
              {/* Top Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container p-4 rounded border border-outline-variant/20">
                <div>
                  <h3 className="text-headline-sm font-bold text-on-surface">
                    Catálogo de "1. Selecciona Género & Sub-género Visual"
                  </h3>
                  <p className="text-body-sm text-on-surface-variant">
                    Crea nuevas tarjetas de género, agrega sub-géneros con sus prompts acústicos o elimina los que no utilices.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingCard(!isCreatingCard)}
                  className="px-4 py-2 rounded bg-primary-container text-on-primary-fixed font-label-md uppercase font-bold flex items-center gap-1.5 shrink-0 self-start sm:self-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isCreatingCard ? 'close' : 'add'}
                  </span>
                  <span>{isCreatingCard ? 'Cancelar' : 'Nuevo Género Visual'}</span>
                </button>
              </div>

              {/* Create New Genre Card Form */}
              {isCreatingCard && (
                <form
                  onSubmit={handleCreateGenreCard}
                  className="bg-surface-container-lowest border-2 border-primary-container/50 rounded-lg p-5 space-y-4 animate-fade-scale"
                >
                  <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
                    <span className="text-label-md uppercase text-primary-fixed font-bold">
                      Crear Nueva Tarjeta de Género & Sub-géneros
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-label-sm uppercase text-on-surface-variant mb-1">
                        Nombre del Género *
                      </label>
                      <input
                        type="text"
                        required
                        value={newCardTitle}
                        onChange={(e) => setNewCardTitle(e.target.value)}
                        placeholder="Ej: Metal Sinfónico / Industrial"
                        className="w-full bg-surface-container border border-outline-variant/30 rounded px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:border-primary-container"
                      />
                    </div>

                    <div>
                      <label className="block text-label-sm uppercase text-on-surface-variant mb-1">
                        Categoría de Filtro
                      </label>
                      <select
                        value={newCardCategory}
                        onChange={(e) => setNewCardCategory(e.target.value)}
                        className="w-full bg-surface-container border border-outline-variant/30 rounded px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:border-primary-container"
                      >
                        {categories
                          .filter((c) => c.id !== 'all')
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-label-sm uppercase text-on-surface-variant mb-1">
                        Etiqueta Superior (Badge)
                      </label>
                      <input
                        type="text"
                        value={newCardTag}
                        onChange={(e) => setNewCardTag(e.target.value)}
                        placeholder="Ej: Heavy Engine"
                        className="w-full bg-surface-container border border-outline-variant/30 rounded px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:border-primary-container"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-label-sm uppercase text-on-surface-variant mb-1">
                        Descripción Acústica
                      </label>
                      <input
                        type="text"
                        value={newCardDesc}
                        onChange={(e) => setNewCardDesc(e.target.value)}
                        placeholder="Instrumentos principales, atmósfera y textura sonora..."
                        className="w-full bg-surface-container border border-outline-variant/30 rounded px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:border-primary-container"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-label-sm uppercase text-on-surface-variant mb-1">
                          BPM
                        </label>
                        <input
                          type="text"
                          value={newCardBpm}
                          onChange={(e) => setNewCardBpm(e.target.value)}
                          placeholder="140 BPM"
                          className="w-full bg-surface-container border border-outline-variant/30 rounded px-3 py-2 text-body-sm text-on-surface focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-label-sm uppercase text-on-surface-variant mb-1">
                          Escala / Tuning
                        </label>
                        <input
                          type="text"
                          value={newCardTuning}
                          onChange={(e) => setNewCardTuning(e.target.value)}
                          placeholder="Escala: Re Menor"
                          className="w-full bg-surface-container border border-outline-variant/30 rounded px-3 py-2 text-body-sm text-on-surface focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div>
                      <label className="block text-label-sm uppercase text-on-surface-variant mb-1">
                        URL de Imagen de Portada (Opcional)
                      </label>
                      <input
                        type="text"
                        value={newCardImage}
                        onChange={(e) => setNewCardImage(e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-surface-container border border-outline-variant/30 rounded px-3 py-2 text-body-sm text-on-surface focus:outline-none"
                      />
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newCardIsVideogame}
                          onChange={(e) => setNewCardIsVideogame(e.target.checked)}
                          className="w-4 h-4 accent-[#00e0ff]"
                        />
                        <span className="text-body-sm text-on-surface">
                          Activar reglas de <b>Música para Videojuegos Épico/Combate</b> (Inglés/Latín/Glossolalia + Arco OST)
                        </span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newCardIsAmbientOst}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setNewCardIsAmbientOst(checked);
                            if (checked) setNewCardIsVideogame(true);
                          }}
                          className="w-4 h-4 accent-[#00e0ff]"
                        />
                        <span className="text-body-sm text-on-surface">
                          Activar modo <b>OST Ambiental / Exploración (Cero Voces)</b> (Solo bloques <code className="text-primary-fixed">[ ]</code> + <code className="text-primary-fixed">purely instrumental, no vocals</code>)
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Subgenres list builder */}
                  <div className="space-y-2 pt-2 border-t border-outline-variant/20">
                    <div className="flex items-center justify-between">
                      <label className="text-label-sm uppercase text-primary-fixed font-bold">
                        Sub-géneros iniciales
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setNewCardSubgenres((prev) => [
                            ...prev,
                            { id: `sub_${Date.now()}`, label: '', prompt: '' },
                          ])
                        }
                        className="text-label-sm text-primary-fixed hover:underline uppercase flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-xs">add</span>
                        Agregar fila de sub-género
                      </button>
                    </div>

                    {newCardSubgenres.map((sub, idx) => (
                      <div key={sub.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <input
                          type="text"
                          value={sub.label}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewCardSubgenres((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, label: val } : item))
                            );
                          }}
                          placeholder="Nombre del Sub-género (ej: Electro Tumbado)"
                          className="sm:col-span-4 bg-surface-container border border-outline-variant/30 rounded px-2.5 py-1.5 text-body-sm text-on-surface"
                        />
                        <input
                          type="text"
                          value={sub.prompt}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewCardSubgenres((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, prompt: val } : item))
                            );
                          }}
                          placeholder="Prompt acústico para Suno (instrumentos, BPM, vibe)..."
                          className="sm:col-span-7 bg-surface-container border border-outline-variant/30 rounded px-2.5 py-1.5 text-body-sm text-on-surface"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setNewCardSubgenres((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="sm:col-span-1 flex items-center justify-center text-outline hover:text-error"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingCard(false)}
                      className="px-4 py-2 rounded bg-surface-container text-on-surface-variant text-label-sm uppercase"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded bg-primary-container text-on-primary-fixed font-label-sm uppercase font-bold"
                    >
                      Guardar Tarjeta de Género
                    </button>
                  </div>
                </form>
              )}

              {/* Filter Categories Manager */}
              <div className="bg-surface-container p-4 rounded border border-outline-variant/15 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-label-sm uppercase text-outline mr-1">
                    Categorías de Filtro:
                  </span>
                  {categories.map((cat) => (
                    <span
                      key={cat.id}
                      className="px-2.5 py-1 rounded bg-surface-container-lowest border border-outline-variant/25 text-label-sm text-on-surface"
                    >
                      {cat.label}
                    </span>
                  ))}
                </div>
                <form onSubmit={handleAddCategory} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newCategoryLabel}
                    onChange={(e) => setNewCategoryLabel(e.target.value)}
                    placeholder="+ Nueva categoría..."
                    className="bg-surface-container-lowest border border-outline-variant/30 rounded px-2.5 py-1 text-body-sm text-on-surface w-40 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newCategoryLabel.trim()}
                    className="px-2.5 py-1 rounded bg-surface-container-highest hover:bg-primary-container hover:text-on-primary-fixed text-label-sm uppercase font-bold disabled:opacity-40 transition-colors"
                  >
                    Añadir
                  </button>
                </form>
              </div>

              {/* Existing Genre Cards List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {genreCards.map((card) => (
                  <div
                    key={card.id}
                    className="bg-surface-container border border-outline-variant/25 rounded-lg p-4 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3">
                          {card.image && (
                            <img
                              src={card.image}
                              alt={card.title}
                              className="w-12 h-12 rounded object-cover border border-outline-variant/30 shrink-0"
                            />
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-label-sm uppercase text-primary-fixed">
                                {card.tag || card.category}
                              </span>
                              {card.isVideogame && (
                                <span className="px-1.5 py-0.2 rounded bg-tertiary-container/20 text-tertiary text-[9px] font-label-sm uppercase">
                                  OST Mode
                                </span>
                              )}
                            </div>
                            <h4 className="font-headline-sm font-bold text-on-surface">
                              {card.title}
                            </h4>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteGenreCard(card.id)}
                          className="p-1.5 rounded text-outline hover:text-error hover:bg-error-container/20 transition-colors"
                          title="Eliminar tarjeta de género"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>

                      <p className="text-body-sm text-on-surface-variant mb-3">
                        {card.description}
                      </p>

                      {/* Subgenres list inside card */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-label-sm uppercase text-outline">
                            Sub-géneros ({card.subgenres?.length || 0})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingSubToCardId(
                                addingSubToCardId === card.id ? null : card.id
                              );
                              setSubLabelInput('');
                              setSubPromptInput('');
                            }}
                            className="text-[10px] font-label-sm uppercase text-primary-fixed hover:underline flex items-center gap-0.5"
                          >
                            <span className="material-symbols-outlined text-[12px]">add</span>
                            Agregar Sub-género
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {(card.subgenres || []).map((sub) => (
                            <div
                              key={sub.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-lowest border border-outline-variant/25 text-label-sm text-on-surface"
                              title={sub.prompt}
                            >
                              <span>{sub.label}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteSubgenreFromCard(card.id, sub.id)}
                                className="text-outline hover:text-error flex items-center"
                                title="Eliminar sub-género"
                              >
                                <span className="material-symbols-outlined text-[12px]">close</span>
                              </button>
                            </div>
                          ))}
                        </div>

                        {addingSubToCardId === card.id && (
                          <div className="mt-2 p-2.5 rounded bg-surface-container-lowest border border-primary-container/40 space-y-2 animate-fade-scale">
                            <input
                              type="text"
                              value={subLabelInput}
                              onChange={(e) => setSubLabelInput(e.target.value)}
                              placeholder="Nombre del Sub-género..."
                              className="w-full bg-surface-container border border-outline-variant/30 rounded px-2.5 py-1 text-body-sm text-on-surface focus:outline-none"
                              autoFocus
                            />
                            <input
                              type="text"
                              value={subPromptInput}
                              onChange={(e) => setSubPromptInput(e.target.value)}
                              placeholder="Prompt acústico para Suno (opcional)..."
                              className="w-full bg-surface-container border border-outline-variant/30 rounded px-2.5 py-1 text-body-sm text-on-surface focus:outline-none"
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setAddingSubToCardId(null)}
                                className="px-2.5 py-1 rounded text-label-sm text-outline"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddSubgenreToCard(card.id)}
                                className="px-3 py-1 rounded bg-primary-container text-on-primary-fixed font-label-sm uppercase font-bold"
                              >
                                Guardar Sub-género
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-outline-variant/15 flex items-center justify-between text-[10px] text-outline">
                      <span>{card.tuning}</span>
                      <span className="text-primary-fixed font-bold">{card.bpm}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'genre_tags' && (
            <div className="space-y-6">
              <div className="bg-surface-container p-5 rounded-lg border border-outline-variant/20 space-y-4">
                <div>
                  <h3 className="text-headline-sm font-bold text-on-surface">
                    Catálogo Global de Etiquetas de Género Musical
                  </h3>
                  <p className="text-body-sm text-on-surface-variant mt-1">
                    Estas etiquetas son independientes de las Playlists. Una canción puede tener una o más etiquetas de género para buscarla y filtrarla rápidamente. Cualquier género que agregues aquí estará disponible en la lista desplegable de todas las canciones sin necesidad de volver a escribirlo.
                  </p>
                </div>

                {/* Add new genre tag form */}
                <form onSubmit={handleAddReusableGenreTag} className="flex items-center gap-2 max-w-lg">
                  <input
                    type="text"
                    value={newGenreTagInput}
                    onChange={(e) => setNewGenreTagInput(e.target.value)}
                    placeholder="Escribir nuevo género musical (ej: Synthwave, Trap Bélico, Boss Fight)..."
                    className="flex-1 bg-surface-container-lowest border border-outline-variant/30 focus:border-primary-container rounded px-3.5 py-2 text-body-sm text-on-surface focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newGenreTagInput.trim()}
                    className="px-4 py-2 rounded bg-primary-container text-on-primary-fixed font-label-md uppercase font-bold disabled:opacity-40 cursor-pointer"
                  >
                    + Agregar Género
                  </button>
                </form>

                {/* Tags Grid */}
                <div className="pt-3 border-t border-outline-variant/15">
                  <div className="text-label-sm uppercase text-outline mb-3">
                    Géneros disponibles para seleccionar ({genreTags.length}):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {genreTags.map((tag) => (
                      <div
                        key={tag}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-surface-container-lowest border border-outline-variant/30 text-body-sm text-on-surface"
                      >
                        <span className="material-symbols-outlined text-primary-fixed text-[14px]">
                          sell
                        </span>
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveReusableGenreTag(tag)}
                          className="text-outline hover:text-error ml-1 flex items-center"
                          title="Eliminar del catálogo"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'waveforms' && (
            <div className="space-y-5">
              <div className="bg-surface-container p-5 rounded-xl border border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-headline-sm font-bold text-on-surface uppercase">
                    Catálogo Estandarizado de Formas de Onda (1:1 Video Sync)
                  </h3>
                  <p className="text-body-sm text-on-surface-variant mt-1">
                    Crea nuevas ondas visuales, modifica sus parámetros (altura, posición, reflejo de agua, brillo neón, velocidad) o elimina las que no uses.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDesignerTargetId(waveformPresets[0]?.id || 'rounded_mirror')}
                    className="px-4 py-2.5 rounded-lg bg-primary-container text-on-primary-fixed font-headline-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm hover:brightness-105 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">tune</span>
                    <span>Abrir Laboratorio de Ondas</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {waveformPresets.map((wf) => (
                  <div
                    key={wf.id}
                    className="p-4 rounded-xl bg-surface-container border border-outline-variant/30 flex items-center justify-between gap-3 hover:border-primary-container/50 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary-fixed text-[18px]">
                          equalizer
                        </span>
                        <h4 className="font-headline-sm text-sm font-bold text-on-surface truncate uppercase">
                          {wf.name}
                        </h4>
                        <span className="px-2 py-0.5 rounded bg-surface-container-highest text-[10px] font-mono text-on-surface-variant">
                          {wf.engine || wf.params?.engine || 'bars'}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-1 line-clamp-1">
                        {wf.desc}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] font-mono text-outline">
                        <span>Bandas: {wf.params?.bar_count || 48}</span>
                        <span>•</span>
                        <span>Base Y: {Math.round((wf.params?.base_y_ratio || 0.82) * 100)}%</span>
                        <span>•</span>
                        <span>Altura: {Math.round((wf.params?.max_height_ratio || 0.26) * 100)}%</span>
                        {wf.params?.reflection_enabled && (
                          <>
                            <span>•</span>
                            <span className="text-primary-fixed">Reflejo Activo</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setDesignerTargetId(wf.id)}
                        className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-primary-container text-on-surface hover:text-on-primary-fixed text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[15px]">edit</span>
                        <span>Modificar</span>
                      </button>

                      {waveformPresets.length > 1 && (
                        <button
                          type="button"
                          onClick={async () => {
                            const nextList = waveformPresets.filter((p) => p.id !== wf.id);
                            setWaveformPresets(nextList);
                            await persistCatalog(categories, genreCards, genreTags, nextList);
                          }}
                          className="p-1.5 rounded-lg bg-surface-container-high hover:bg-error-container text-on-surface-variant hover:text-on-error-container transition-colors cursor-pointer"
                          title="Eliminar forma de onda"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Theme Switcher Card */}
              <div className="bg-surface-container p-5 rounded-lg border border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-headline-sm font-bold text-on-surface">
                    Modo de Apariencia (Oscuro / Claro con Transición Épica)
                  </h3>
                  <p className="text-body-sm text-on-surface-variant mt-1">
                    Alterna entre el diseño Obsidian Dark (<code>example.html</code>) y el diseño Daylight White (<code>example white.html</code>).
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      if (theme !== 'dark') onToggleTheme(e);
                    }}
                    className={`px-4 py-2.5 rounded border text-label-md uppercase flex items-center gap-2 transition-all cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-primary-container text-on-primary-fixed border-primary-container font-bold shadow-[0_0_15px_rgba(0,224,255,0.25)]'
                        : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">dark_mode</span>
                    <span>Modo Oscuro</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      if (theme !== 'light') onToggleTheme(e);
                    }}
                    className={`px-4 py-2.5 rounded border text-label-md uppercase flex items-center gap-2 transition-all cursor-pointer ${
                      theme === 'light'
                        ? 'bg-primary-container text-on-primary-fixed border-primary-container font-bold shadow-[0_0_15px_rgba(0,224,255,0.25)]'
                        : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">light_mode</span>
                    <span>Modo Claro</span>
                  </button>
                </div>
              </div>

              {/* AI Engines Telemetry */}
              <div className="bg-surface-container p-5 rounded-lg border border-outline-variant/20 space-y-3">
                <h3 className="text-headline-sm font-bold text-on-surface">
                  Estado de Motores de Inteligencia Artificial
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded bg-surface-container-lowest border border-outline-variant/25 flex items-center justify-between">
                    <div>
                      <div className="text-label-md font-bold uppercase text-on-surface">
                        Google + Imagen 3
                      </div>
                      <div className="text-body-sm text-on-surface-variant">
                        {aiConfig?.gemini?.text_model || 'Gemini'} +{' '}
                        {aiConfig?.gemini?.image_model || 'Imagen 3'}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded text-[10px] font-label-sm uppercase font-bold ${
                        aiConfig?.gemini?.available !== false
                          ? 'bg-primary-container/20 text-primary-fixed'
                          : 'bg-error-container/20 text-error'
                      }`}
                    >
                      {aiConfig?.gemini?.available !== false ? 'Activo' : 'Sin API Key'}
                    </span>
                  </div>

                  <div className="p-4 rounded bg-surface-container-lowest border border-outline-variant/25 flex items-center justify-between">
                    <div>
                      <div className="text-label-md font-bold uppercase text-on-surface">
                        Anthropic + DALL-E 3
                      </div>
                      <div className="text-body-sm text-on-surface-variant">
                        {aiConfig?.anthropic?.text_model || 'Claude'} +{' '}
                        {aiConfig?.anthropic?.image_model || 'DALL-E 3'}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded text-[10px] font-label-sm uppercase font-bold ${
                        aiConfig?.anthropic?.available
                          ? 'bg-primary-container/20 text-primary-fixed'
                          : 'bg-surface-container-highest text-outline'
                      }`}
                    >
                      {aiConfig?.anthropic?.available ? 'Activo' : 'Configurable en .env'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-surface-container border-t border-outline-variant/20 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded bg-primary-container text-on-primary-fixed font-label-md uppercase font-bold cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>

      <WaveDesignerModal
        isOpen={Boolean(designerTargetId)}
        onClose={() => setDesignerTargetId(null)}
        waveformPresets={waveformPresets}
        selectedStyleId={designerTargetId || waveformPresets[0]?.id || 'rounded_mirror'}
        onSelectStyle={(nextId) => setDesignerTargetId(nextId)}
        onSavePresets={async (nextList) => {
          setWaveformPresets(nextList);
          await persistCatalog(categories, genreCards, genreTags, nextList);
        }}
        onResetFactoryPresets={async () => {
          const res = await resetWaveformCatalog();
          if (res?.waveform_presets) {
            setWaveformPresets(res.waveform_presets);
          }
          return res;
        }}
      />
    </div>
  );
}

