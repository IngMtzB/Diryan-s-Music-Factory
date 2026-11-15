import React, { useState, useEffect, useRef } from 'react';
import { GENRE_CATEGORIES, GENRE_CARDS } from '../constants/genres';
import EpicLoader from './EpicLoader';

export default function CreateProductionView({
  playlists = [],
  initialPlaylist = null,
  catalog,
  onUpdateCatalog,
  onCancel,
  onCreate,
  onOpenSettings,
}) {
  const categories = catalog?.creation_categories?.length
    ? catalog.creation_categories
    : GENRE_CATEGORIES;
  const genreCards = catalog?.creation_genres?.length
    ? catalog.creation_genres
    : GENRE_CARDS;
  const availableGenreTags = catalog?.genre_tags || [];

  // Step 1 state: ONLY cards and filter are shown until user selects a genre/subgenre
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedSubgenre, setSelectedSubgenre] = useState(null);
  const [customSubgenreMap, setCustomSubgenreMap] = useState({});
  const [activeCustomCardId, setActiveCustomCardId] = useState(null);
  const [hasConfirmedGenre, setHasConfirmedGenre] = useState(false);

  // Step 2 state: Concept, Genre Tags, Playlist, AI Engine, Style Override
  const [concept, setConcept] = useState('');
  const [stylePrompt, setStylePrompt] = useState('');
  const [selectedGenreTags, setSelectedGenreTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [playlist, setPlaylist] = useState(initialPlaylist || '');
  const [provider, setProvider] = useState('gemini');
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const abortControllerRef = useRef(null);

  useEffect(() => {
    setPlaylist(initialPlaylist || '');
  }, [initialPlaylist]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const handleCancelProduction = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setSubmitting(false);
    setError('Generación cancelada por el usuario.');
  };

  const filteredCards =
    activeCategory === 'all'
      ? genreCards
      : genreCards.filter((c) => c.category === activeCategory);

  const handleChooseGenreAndSubgenre = (card, sub, customText = '') => {
    setSelectedCard(card);
    setSelectedSubgenre(sub);
    setActiveCustomCardId(null);

    const promptToUse = customText.trim()
      ? `${card.title} - ${customText.trim()}`
      : sub?.prompt || card.title;
    setStylePrompt(promptToUse);

    // Pre-populate genre tags from the chosen card & subgenre if empty
    const initialTags = [];
    if (card.title) initialTags.push(card.title);
    if (customText.trim()) {
      initialTags.push(customText.trim());
    } else if (sub?.label) {
      initialTags.push(sub.label);
    }
    setSelectedGenreTags((prev) => {
      const merged = Array.from(new Set([...prev, ...initialTags]));
      return merged;
    });

    setHasConfirmedGenre(true);
  };

  const handleToggleGenreTag = (tag) => {
    setSelectedGenreTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAddNewGenreTag = async (e) => {
    if (e) e.preventDefault();
    const clean = newTagInput.trim();
    if (!clean) return;

    if (!selectedGenreTags.includes(clean)) {
      setSelectedGenreTags((prev) => [...prev, clean]);
    }

    if (
      onUpdateCatalog &&
      !availableGenreTags.some((t) => t.toLowerCase() === clean.toLowerCase())
    ) {
      await onUpdateCatalog({
        ...catalog,
        genre_tags: [...availableGenreTags, clean],
      });
    }
    setNewTagInput('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!concept.trim()) {
      setError('Por favor escribe el concepto o tema de la canción.');
      return;
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setSubmitting(true);
    setError('');
    try {
      await onCreate({
        concept: concept.trim(),
        style: stylePrompt.trim() || 'Electro corrido tumbado',
        playlist: playlist || null,
        provider,
        genre_tags: selectedGenreTags,
        autoGenerate,
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        setError('Generación cancelada por el usuario.');
      } else {
        setError(err.message || 'Error al crear la producción');
      }
      setSubmitting(false);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface text-on-surface relative animate-fade-scale">
      {/* Super Epic Loader when generating new production */}
      <EpicLoader
        isOpen={submitting}
        mode="production"
        title="Sintetizando Nueva Producción Musical"
        subtitle={concept ? `"${concept}" — ${selectedCard?.title || ''}` : ''}
        provider={provider}
        onCancel={handleCancelProduction}
      />

      {/* Top Navigation Header */}
      <header className="h-16 bg-surface-container-low px-6 flex items-center justify-between border-b border-outline-variant/20 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={hasConfirmedGenre ? () => setHasConfirmedGenre(false) : onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-highest/60 hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface text-label-md uppercase transition-colors border border-outline-variant/20"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>{hasConfirmedGenre ? 'Volver a Géneros' : 'Cancelar'}</span>
          </button>

          <div className="h-5 w-[1px] bg-outline-variant/30" />

          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary-container shadow-[0_0_10px_#00e0ff]" />
            <h1 className="font-headline-md font-bold text-on-surface tracking-tight">
              {!hasConfirmedGenre
                ? '1. Selecciona Género & Sub-género Visual'
                : '2. Configura Concepto, Etiquetas & Motor de IA'}
            </h1>
          </div>
        </div>

        {/* Step Indicator + Manage Genres shortcut */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-surface-container-lowest px-3 py-1.5 rounded border border-outline-variant/20 text-[11px] font-label-sm uppercase">
            <button
              type="button"
              onClick={() => setHasConfirmedGenre(false)}
              className={`flex items-center gap-1.5 transition-colors ${
                !hasConfirmedGenre
                  ? 'text-primary-fixed font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-primary-container text-on-primary-fixed flex items-center justify-center text-[10px] font-bold">
                1
              </span>
              <span>Género Visual</span>
            </button>
            <span className="text-outline">/</span>
            <span
              className={`flex items-center gap-1.5 ${
                hasConfirmedGenre ? 'text-primary-fixed font-bold' : 'text-outline'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  hasConfirmedGenre
                    ? 'bg-primary-container text-on-primary-fixed'
                    : 'bg-surface-container-highest text-outline'
                }`}
              >
                2
              </span>
              <span>Concepto & IA</span>
            </span>
          </div>

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-3 py-1.5 rounded bg-surface-container border border-outline-variant/25 hover:border-primary-container/50 text-on-surface-variant hover:text-primary-fixed text-label-sm uppercase flex items-center gap-1.5 transition-all"
              title="Gestionar catálogo de géneros y subgéneros"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span className="hidden md:inline">Gestionar Géneros</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        {!hasConfirmedGenre ? (
          /* =====================================================================
           * STEP 1: DEDICATED PAGE — ONLY GENRE CARDS & CATEGORY FILTER
           * ===================================================================== */
          <div className="max-w-7xl mx-auto space-y-6 animate-fade-scale">
            {/* Filter Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-low p-5 rounded-lg border border-outline-variant/15">
              <div>
                <span className="text-[10px] font-label-sm uppercase tracking-widest text-primary-fixed block mb-1">
                  PASO 01 // MATRIZ DE SÍNTESIS ACÚSTICA
                </span>
                <h2 className="text-headline-md font-bold text-on-surface">
                  Elige una tarjeta de Género y haz clic en un Sub-género para continuar
                </h2>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 bg-surface-container-lowest p-1.5 rounded border border-outline-variant/20 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1.5 rounded text-label-sm uppercase transition-all ${
                      activeCategory === cat.id
                        ? 'bg-primary-container text-on-primary-fixed font-bold shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Genre Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCards.map((card) => {
                const isSelected = selectedCard?.id === card.id;
                const isWritingCustom = activeCustomCardId === card.id;
                const customVal = customSubgenreMap[card.id] || '';

                return (
                  <div
                    key={card.id}
                    className={`group relative bg-surface-container rounded-lg overflow-hidden transition-all duration-200 flex flex-col justify-between shadow-[0_12px_28px_-4px_rgba(0,0,0,0.22),0_4px_10px_-2px_rgba(0,0,0,0.12)] hover:shadow-[0_20px_40px_-6px_rgba(0,0,0,0.36)] ${
                      isSelected
                        ? 'border-2 border-primary-container shadow-[0_0_30px_rgba(0,224,255,0.25)]'
                        : 'border border-outline-variant/25 hover:border-primary-container/60'
                    }`}
                  >
                    {/* Card Cover Header */}
                    <div>
                      <div className="h-44 relative overflow-hidden bg-black">
                        {card.image ? (
                          <img
                            src={card.image}
                            alt={card.title}
                            className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary-container/20 via-surface-container to-tertiary-container/20" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                          <span className="px-2.5 py-1 rounded bg-black/75 backdrop-blur-md text-[#00e0ff] text-[10px] font-label-sm uppercase border border-white/20">
                            {card.tag || card.category}
                          </span>
                          {card.isAmbientOst ? (
                            <span className="px-2.5 py-1 rounded bg-[#00e0ff] text-black font-bold text-[10px] font-label-sm uppercase shadow">
                              OST Ambiental (Sin Voces • Solo [ ])
                            </span>
                          ) : card.isVideogame ? (
                            <span className="px-2.5 py-1 rounded bg-tertiary-container text-on-tertiary font-bold text-[10px] font-label-sm uppercase shadow">
                              OST Épico (EN / Latin / Glossolalia)
                            </span>
                          ) : null}
                        </div>

                        <div className="absolute bottom-3 left-4 right-4">
                          <h3 className="font-headline-md font-bold text-white leading-tight drop-shadow">
                            {card.title}
                          </h3>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="p-4 pb-2">
                        <p className="text-body-sm text-on-surface-variant line-clamp-2">
                          {card.description}
                        </p>
                      </div>
                    </div>

                    {/* Sub-genres Selector */}
                    <div className="p-4 pt-2 space-y-3">
                      <div className="text-[10px] font-label-sm uppercase tracking-wider text-outline">
                        Selecciona un Sub-género para configurar producción:
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(card.subgenres || []).map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleChooseGenreAndSubgenre(card, sub)}
                            className="px-3 py-1.5 rounded text-label-sm bg-primary-container/15 hover:bg-primary-container text-primary-fixed hover:text-on-primary-fixed border border-primary-container/35 font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>{sub.label}</span>
                            <span className="material-symbols-outlined text-[13px]">
                              arrow_forward
                            </span>
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() =>
                            setActiveCustomCardId(isWritingCustom ? null : card.id)
                          }
                          className={`px-2.5 py-1.5 rounded text-label-sm border transition-all flex items-center gap-1 ${
                            isWritingCustom
                              ? 'bg-tertiary-container text-on-tertiary border-tertiary-container font-bold'
                              : 'bg-surface-container-highest/60 text-on-surface-variant border-outline-variant/30 hover:text-on-surface'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[13px]">edit</span>
                          <span>Otro: escribir...</span>
                        </button>
                      </div>

                      {/* Custom Sub-genre Input */}
                      {isWritingCustom && (
                        <div className="pt-2 flex items-center gap-2 animate-fade-scale">
                          <input
                            type="text"
                            value={customVal}
                            onChange={(e) =>
                              setCustomSubgenreMap((prev) => ({
                                ...prev,
                                [card.id]: e.target.value,
                              }))
                            }
                            placeholder={`Sub-género de ${card.title}...`}
                            className="flex-1 bg-surface-container-lowest border border-primary-container/50 rounded px-3 py-1.5 text-body-sm text-on-surface focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && customVal.trim()) {
                                e.preventDefault();
                                handleChooseGenreAndSubgenre(card, null, customVal);
                              }
                            }}
                          />
                          <button
                            type="button"
                            disabled={!customVal.trim()}
                            onClick={() => handleChooseGenreAndSubgenre(card, null, customVal)}
                            className="px-3 py-1.5 rounded bg-primary-container text-on-primary-fixed font-label-sm uppercase font-bold disabled:opacity-40"
                          >
                            Continuar
                          </button>
                        </div>
                      )}

                      {/* Card Footer */}
                      <div className="pt-3 border-t border-outline-variant/15 flex items-center justify-between text-[11px] text-outline font-body-sm">
                        <span>{card.tuning || 'Studio Preset'}</span>
                        <span className="text-primary-fixed font-bold">{card.bpm || '120 BPM'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* =====================================================================
           * STEP 2: RENDERED ONLY AFTER GENRE & SUB-GENRE IS SELECTED
           * ===================================================================== */
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6 animate-fade-scale">
            {error && (
              <div className="p-3.5 rounded bg-error-container/20 border border-error/40 text-error text-body-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Selected Genre Summary Banner */}
            <div className="bg-surface-container-low border-2 border-primary-container/50 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_0_25px_rgba(0,224,255,0.08)]">
              <div className="flex items-center gap-4">
                {selectedCard?.image && (
                  <img
                    src={selectedCard.image}
                    alt={selectedCard.title}
                    className="w-16 h-16 rounded object-cover border border-primary-container/40 shrink-0"
                  />
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary-fixed text-[10px] font-label-sm uppercase font-bold">
                      Género Seleccionado
                    </span>
                    {selectedCard?.isAmbientOst ? (
                      <span className="px-2 py-0.5 rounded bg-[#00e0ff]/20 border border-[#00e0ff] text-primary-fixed text-[10px] font-label-sm uppercase font-bold">
                        Modo OST Ambiental (Cero Voces • Directivas [ ] • Purely Instrumental)
                      </span>
                    ) : selectedCard?.isVideogame ? (
                      <span className="px-2 py-0.5 rounded bg-tertiary-container text-on-tertiary text-[10px] font-label-sm uppercase font-bold">
                        Modo OST Épico / Combate (Voz como Instrumento: EN / Latín / Glossolalia)
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-headline-md font-bold text-on-surface mt-1">
                    {selectedCard?.title}{' '}
                    <span className="text-primary-fixed">
                      — {selectedSubgenre?.label || customSubgenreMap[selectedCard?.id] || 'Custom'}
                    </span>
                  </h3>
                  <p className="text-body-sm text-on-surface-variant">
                    {selectedCard?.tuning} • {selectedCard?.bpm}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setHasConfirmedGenre(false)}
                className="px-3.5 py-2 rounded bg-surface-container-highest hover:bg-primary-container/20 text-on-surface hover:text-primary-fixed border border-outline-variant/30 text-label-sm uppercase flex items-center gap-1.5 self-start sm:self-center shrink-0 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                <span>Cambiar Género</span>
              </button>
            </div>

            {/* Concept & Parameters Card */}
            <div className="bg-surface-container-low border border-outline-variant/20 rounded-lg p-6 space-y-6">
              {selectedCard?.isVideogame && (
                <div className="p-3.5 rounded-lg bg-surface-container border border-primary-container/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-body-sm text-on-surface-variant">
                    <span className="text-primary-fixed font-bold uppercase text-label-sm block mb-0.5">
                      {selectedCard?.isAmbientOst
                        ? '🌲 Director de Audio AAA — MODO AMBIENTAL / EXPLORACIÓN (CERO VOCES)'
                        : '⚔️ Director de Audio AAA — MODO ÉPICO / COMBATE / TEMA PRINCIPAL'}
                    </span>
                    {selectedCard?.isAmbientOst ? (
                      <span>
                        Cero voces. La caja de Lyrics contendrá <b>EXCLUSIVAMENTE</b> directivas instrumentales entre corchetes{' '}
                        <code className="text-primary-fixed">[ ]</code> con estructura cíclica relajada y{' '}
                        <code className="text-primary-fixed">purely instrumental, no vocals</code> al final de Style of Music.
                      </span>
                    ) : (
                      <span>
                        Voz como instrumento legato (<code className="text-primary-fixed">Lú-mi-na...</code>), contrapunto coral{' '}
                        <code className="text-primary-fixed">(Sanctus!)</code>, cero español y arco de impacto hasta{' '}
                        <code className="text-primary-fixed">[End]</code>.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Concept Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-label-md uppercase text-primary-fixed tracking-wider">
                    Concepto / Historia de la Producción *
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(selectedCard?.isAmbientOst
                      ? [
                          'Villa medieval tranquila al amanecer con mercaderes y río cristalino',
                          'Bosque ancestral de luciérnagas y ruinas élficas en calma',
                          'Menú principal de RPG de fantasía en santuario estelar',
                          'Dungeon místico subterráneo con ecos de cristal y niebla',
                        ]
                      : selectedCard?.isVideogame
                        ? [
                            'Jefe final ancestral en catedral gótica en ruinas',
                            'Combate cibernético contra IA corrupta en órbita',
                            'Ritual nórdico en bosque oscuro antes de la batalla',
                          ]
                        : [
                            'Un programador que hackea la matrix a las 3 AM',
                            'El arquitecto de servidores que tumbó producción en viernes',
                            'Corrido del hacker fantasma de la 403 Forbidden',
                          ]
                    ).map((idea, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setConcept(idea)}
                        className="text-[10px] px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant hover:text-primary-fixed border border-outline-variant/20 transition-colors"
                      >
                        Idea {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder={
                    selectedCard?.isAmbientOst
                      ? 'Ej: Exploración nocturna en una villa medieval junto al bosque, ambiente cálido y nostálgico (Generará 100% directivas instrumentales [ ] sin voces)...'
                      : selectedCard?.isVideogame
                        ? 'Ej: Batalla contra un coloso mecánico en una tormenta de ceniza (Generará voces en latín/inglés/glossolalia y arco dinámico)...'
                        : 'Ej: La historia de un ingeniero de software que sobrevive a un deploy fallido con puro código y café...'
                  }
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 focus:border-primary-container rounded p-3.5 text-body-md text-on-surface placeholder-outline focus:outline-none leading-relaxed"
                  autoFocus
                />
              </div>

              {/* Per-Song Musical Genre Tags (Independent of Playlists) */}
              <div className="space-y-3 pt-2 border-t border-outline-variant/15">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-label-md uppercase text-primary-fixed tracking-wider">
                      Etiquetas de Género Musical (Búsqueda y Clasificación)
                    </label>
                    <p className="text-[11px] text-on-surface-variant">
                      Selecciona una o más etiquetas existentes o agrega una nueva (se guardará en la lista global para no escribirla cada vez).
                    </p>
                  </div>

                  {/* Add new genre tag inline */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNewGenreTag();
                        }
                      }}
                      placeholder="+ Nuevo género musical..."
                      className="bg-surface-container-lowest border border-outline-variant/30 focus:border-primary-container rounded px-2.5 py-1 text-body-sm text-on-surface placeholder-outline focus:outline-none w-48"
                    />
                    <button
                      type="button"
                      onClick={handleAddNewGenreTag}
                      disabled={!newTagInput.trim()}
                      className="px-2.5 py-1 rounded bg-primary-container text-on-primary-fixed font-label-sm uppercase font-bold disabled:opacity-40"
                    >
                      Agregar
                    </button>
                  </div>
                </div>

                {/* Clickable Reusable Genre Tag Pills */}
                <div className="flex flex-wrap gap-1.5 p-3 rounded bg-surface-container-lowest border border-outline-variant/20">
                  {Array.from(new Set([...availableGenreTags, ...selectedGenreTags])).map((tag) => {
                    const active = selectedGenreTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleToggleGenreTag(tag)}
                        className={`px-2.5 py-1 rounded text-label-sm transition-all flex items-center gap-1.5 ${
                          active
                            ? 'bg-primary-container text-on-primary-fixed font-bold shadow-[0_0_10px_rgba(0,224,255,0.2)]'
                            : 'bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/25'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {active ? 'check_circle' : 'sell'}
                        </span>
                        <span>{tag}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Playlist + AI Engine Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-outline-variant/15">
                {/* Playlist Selector */}
                <div>
                  <label className="block text-label-md uppercase text-on-surface-variant mb-2">
                    Destino de Playlist (Carpeta)
                  </label>
                  <select
                    value={playlist}
                    onChange={(e) => setPlaylist(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded px-3 py-2.5 text-body-sm text-on-surface focus:outline-none focus:border-primary-container"
                  >
                    <option value="">Sin Playlist (Raíz de Proyectos)</option>
                    {playlists.map((pl) => (
                      <option key={pl.name} value={pl.name}>
                        📁 {pl.name.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Visual Background AI Model Selector */}
                <div>
                  <label className="block text-label-md uppercase text-on-surface-variant mb-2">
                    Modelo para Imagen de Fondo & Letras
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setProvider('gemini')}
                      className={`px-3 py-2.5 rounded border text-left transition-all flex items-center gap-2 ${
                        provider === 'gemini'
                          ? 'bg-primary-container/15 border-primary-container text-on-surface'
                          : 'bg-surface-container-lowest border-outline-variant/20 text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-primary-fixed text-lg">
                        auto_awesome
                      </span>
                      <div>
                        <div className="text-label-sm font-bold uppercase">Google + Imagen 3</div>
                        <div className="text-[10px] text-outline">Gemini + Imagen 3</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProvider('anthropic')}
                      className={`px-3 py-2.5 rounded border text-left transition-all flex items-center gap-2 ${
                        provider === 'anthropic'
                          ? 'bg-tertiary-container/15 border-tertiary-container text-on-surface'
                          : 'bg-surface-container-lowest border-outline-variant/20 text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-tertiary-container text-lg">
                        psychology
                      </span>
                      <div>
                        <div className="text-label-sm font-bold uppercase">Anthropic + DALL-E 3</div>
                        <div className="text-[10px] text-outline">Claude + DALL-E 3</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Acoustic Style Prompt Override */}
              <div className="pt-2 border-t border-outline-variant/15">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-label-md uppercase text-on-surface-variant">
                    Prompt de Estilo Acústico (Style of Music)
                  </label>
                  <span className="text-[10px] font-label-sm text-outline">
                    Editable antes de generar
                  </span>
                </div>
                <input
                  type="text"
                  value={stylePrompt}
                  onChange={(e) => setStylePrompt(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 focus:border-primary-container rounded px-3 py-2 text-body-sm text-primary-fixed focus:outline-none"
                />
              </div>

              {/* Auto-generate toggle & Submit */}
              <div className="pt-4 border-t border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoGenerate}
                    onChange={(e) => setAutoGenerate(e.target.checked)}
                    className="w-4 h-4 accent-[#00e0ff] rounded"
                  />
                  <span className="text-body-sm text-on-surface">
                    Generar automáticamente <b>Letra</b>, <b>Copy Social (Data.txt)</b> y{' '}
                    <b>Arte Visual 16:9</b> al crear
                  </span>
                </label>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setHasConfirmedGenre(false)}
                    className="px-4 py-2.5 rounded bg-surface-container-highest text-on-surface-variant hover:text-on-surface text-label-md uppercase transition-colors"
                  >
                    Atrás
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 rounded bg-primary-container hover:bg-primary-fixed text-on-primary-fixed font-label-md font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(0,224,255,0.3)] transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">bolt</span>
                    <span>Iniciar Producción</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

