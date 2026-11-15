import React, { useState, useEffect } from 'react';
import { GENRE_CATEGORIES, GENRE_CARDS } from '../constants/genres';

export default function NewSongModal({
  isOpen,
  onClose,
  playlists = [],
  initialPlaylist = null,
  onCreate,
}) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedGenreId, setSelectedGenreId] = useState(GENRE_CARDS[0].id);
  const [selectedSubgenreId, setSelectedSubgenreId] = useState(GENRE_CARDS[0].subgenres[0].id);
  const [customSubgenreMap, setCustomSubgenreMap] = useState({}); // { [genreId]: string }
  const [editingCustomFor, setEditingCustomFor] = useState(null);

  const [concept, setConcept] = useState('');
  const [styleOverride, setStyleOverride] = useState(GENRE_CARDS[0].subgenres[0].prompt);
  const [playlist, setPlaylist] = useState(initialPlaylist || '');
  const [provider, setProvider] = useState('gemini');
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPlaylist(initialPlaylist || '');
  }, [initialPlaylist, isOpen]);

  if (!isOpen) return null;

  const activeGenreCard = GENRE_CARDS.find((g) => g.id === selectedGenreId) || GENRE_CARDS[0];
  const isVideogameMode = Boolean(activeGenreCard.isVideogame);

  const filteredCards =
    categoryFilter === 'all'
      ? GENRE_CARDS
      : GENRE_CARDS.filter((g) => g.category === categoryFilter);

  const handleSelectGenreAndSub = (card, sub) => {
    setSelectedGenreId(card.id);
    setSelectedSubgenreId(sub.id);
    setStyleOverride(sub.prompt);
  };

  const handleActivateCustomSub = (card) => {
    setSelectedGenreId(card.id);
    setSelectedSubgenreId('custom');
    setEditingCustomFor(card.id);
    const customVal = customSubgenreMap[card.id] || '';
    if (customVal.trim()) {
      setStyleOverride(`${card.title} - ${customVal.trim()}`);
    } else {
      setStyleOverride(`${card.title} - `);
    }
  };

  const handleCustomSubChange = (card, val) => {
    setCustomSubgenreMap((prev) => ({ ...prev, [card.id]: val }));
    setSelectedGenreId(card.id);
    setSelectedSubgenreId('custom');
    setStyleOverride(`${card.title} - ${val}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!concept.trim()) {
      setError('Por favor describe el concepto o temática de la producción.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onCreate({
        concept: concept.trim(),
        style: styleOverride.trim() || activeGenreCard.subgenres[0].prompt,
        playlist: playlist ? playlist : null,
        provider,
        autoGenerate,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Error al crear producción');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-surface border border-outline-variant/40 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-fade-scale">
        {/* Top Modal Header */}
        <div className="px-space-xl py-space-md bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-space-md">
            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-primary-container text-[22px]">
                auto_awesome
              </span>
            </div>
            <div>
              <div className="flex items-center gap-space-xs">
                <span className="font-label-sm text-label-sm text-primary-container uppercase tracking-widest">
                  Production Wizard • Nueva Canción
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
              </div>
              <h2 className="font-headline-md text-headline-md text-on-surface uppercase tracking-tight">
                Crear Nueva Producción Musical con IA
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-space-xl space-y-space-xl">
          {error && (
            <div className="p-space-md rounded-lg bg-error-container/40 border border-error/40 text-on-error-container font-body-sm text-body-sm flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-error text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Genre Synthesis Matrix with Filters & Visual Cards */}
          <section className="space-y-space-md">
            <div className="flex flex-wrap items-end justify-between gap-space-sm">
              <div>
                <div className="flex items-center gap-space-xs">
                  <span className="font-label-sm text-label-sm text-primary-container uppercase tracking-widest">
                    Fase 01 • Sonic Architecture
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-container" />
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {GENRE_CARDS.length} Géneros Calibrados
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface tracking-tight mt-0.5">
                  1. Selecciona Género &amp; Sub-género Visual
                </h3>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-space-xs overflow-x-auto pb-1 max-w-full">
                {GENRE_CATEGORIES.map((cat) => {
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
            </div>

            {/* Genre Visual Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-lg">
              {filteredCards.map((card) => {
                const isCardSelected = selectedGenreId === card.id;
                return (
                  <div
                    key={card.id}
                    onClick={() => {
                      if (!isCardSelected) {
                        handleSelectGenreAndSub(card, card.subgenres[0]);
                      }
                    }}
                    className={`relative rounded-xl p-space-lg flex flex-col justify-between transition-all cursor-pointer overflow-hidden ${
                      isCardSelected
                        ? 'bg-surface-container-high shadow-xl ring-1 ring-primary-container/60'
                        : 'bg-surface-container shadow-md hover:bg-surface-container-high'
                    }`}
                  >
                    {isCardSelected && (
                      <div className="absolute inset-0 bg-gradient-to-b from-primary-container/15 via-transparent to-surface-container-lowest/80 pointer-events-none" />
                    )}

                    <div className="relative z-10 space-y-space-md">
                      <div className="flex items-center justify-between">
                        {isCardSelected ? (
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
                            isCardSelected
                              ? 'text-primary-container material-symbols-filled'
                              : 'text-outline'
                          }`}
                        >
                          {isCardSelected ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                      </div>

                      {/* Card Banner Image */}
                      <div className="h-24 rounded-lg overflow-hidden relative shadow-[0_6px_16px_rgba(0,0,0,0.2)]">
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

                      {/* Sub-genres Pills */}
                      <div className="space-y-space-xs pt-space-xs" onClick={(e) => e.stopPropagation()}>
                        <span className="font-label-sm text-label-sm text-outline uppercase">
                          Sub-géneros:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {card.subgenres.map((sub) => {
                            const isSubActive =
                              isCardSelected && selectedSubgenreId === sub.id;
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => handleSelectGenreAndSub(card, sub)}
                                className={`px-space-sm py-1 rounded font-label-sm text-label-sm transition-all cursor-pointer ${
                                  isSubActive
                                    ? 'bg-primary-container text-on-primary-container font-bold shadow-[0_0_6px_rgba(0,240,255,0.4)]'
                                    : 'bg-surface-container-highest text-on-surface hover:bg-surface-variant'
                                }`}
                              >
                                {sub.label}
                                {isSubActive ? ' • Seleccionado' : ''}
                              </button>
                            );
                          })}

                          {/* + Otro: escribir... button */}
                          <button
                            type="button"
                            onClick={() => handleActivateCustomSub(card)}
                            className={`px-space-sm py-1 rounded font-label-sm text-label-sm transition-colors flex items-center gap-1 cursor-pointer ${
                              isCardSelected && selectedSubgenreId === 'custom'
                                ? 'bg-primary-container text-on-primary-container font-bold shadow-[0_0_6px_rgba(0,240,255,0.4)]'
                                : 'bg-surface-container-lowest text-primary-fixed-dim hover:bg-surface-variant'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[12px]">add</span>
                            <span>Otro: escribir...</span>
                          </button>
                        </div>

                        {/* Custom Sub-genre Inline Input */}
                        {(editingCustomFor === card.id ||
                          (isCardSelected && selectedSubgenreId === 'custom')) && (
                          <input
                            type="text"
                            autoFocus
                            placeholder="Escribe el sub-género personalizado..."
                            value={customSubgenreMap[card.id] || ''}
                            onChange={(e) => handleCustomSubChange(card, e.target.value)}
                            className="mt-1.5 w-full bg-surface-container-lowest text-on-surface font-body-sm text-body-sm rounded px-space-sm py-1 border border-primary-container/50 focus:outline-none"
                          />
                        )}
                      </div>
                    </div>

                    <div className="relative z-10 mt-space-md pt-space-sm flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
                      <span>{card.tuning}</span>
                      <span className={isCardSelected ? 'text-primary-container font-bold' : ''}>
                        {card.bpm}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Video Game Special Mode Notice */}
            {isVideogameMode && (
              <div className="bg-surface-container-high border border-primary-container/40 rounded-xl p-space-md flex items-start gap-space-sm">
                <span className="material-symbols-outlined text-primary-container text-[20px] shrink-0 mt-0.5">
                  sports_esports
                </span>
                <div className="font-body-sm text-body-sm text-on-surface-variant">
                  <strong className="text-primary-fixed">
                    Modo Especial Música para Videojuegos Activo:
                  </strong>{' '}
                  El motor generará el <code className="text-primary">Style of Music</code> (máx.
                  200 caracteres) y la secuencia estructural en{' '}
                  <strong className="text-on-surface">
                    inglés, latín o glossolalia (0% español en lírica)
                  </strong>{' '}
                  con la voz como instrumento legato, contrapunto coral entre paréntesis y arco
                  dinámico de combate en 8 fases hasta <code className="text-primary">[End]</code>.
                </div>
              </div>
            )}

            {/* Fine-Tuning Override Prompt Bar */}
            <div className="bg-surface-container-low rounded-xl p-space-md shadow-inner flex flex-col md:flex-row items-stretch md:items-center gap-space-md">
              <div className="flex items-center gap-space-xs text-primary-container">
                <span className="material-symbols-outlined text-[20px]">tune</span>
                <span className="font-label-md text-label-md uppercase font-bold tracking-wider whitespace-nowrap">
                  Override Prompt:
                </span>
              </div>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={styleOverride}
                  onChange={(e) => setStyleOverride(e.target.value)}
                  placeholder="Escribe el prompt de estilo musical personalizado..."
                  className="w-full bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded px-space-md py-space-sm focus:outline-none focus:ring-1 focus:ring-primary-container/40 transition-colors shadow-inner"
                />
              </div>
            </div>
          </section>

          {/* STEP 2: Concept, Playlist & AI Image/Text Model Selector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl">
            {/* Left 7 Cols: Song Concept / Lore */}
            <div className="lg:col-span-7 space-y-space-sm">
              <label className="flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary-container text-[18px]">
                    edit_note
                  </span>
                  <span>2. Concepto / Historia de la Canción *</span>
                </span>
                <span className="font-label-sm text-label-sm text-primary-fixed uppercase">
                  Prompt Semilla para IA
                </span>
              </label>
              <textarea
                rows={4}
                required
                placeholder={
                  isVideogameMode
                    ? 'Ej. Combate final contra un dios antiguo caído en una catedral sumergida en cenizas, fase 1 solemne con violonchelo solista y fase 2 con coro en latín y percusión ritual...'
                    : 'Ej. Un corrido tumbado sobre un despliegue en viernes a las 11 PM, cae el clúster de Kubernetes y el equipo de guardia levanta los servidores a puro código...'
                }
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant/40 focus:border-primary-container rounded-xl p-space-md font-body-md text-body-md text-on-surface placeholder-outline focus:outline-none transition-colors resize-none"
              />
            </div>

            {/* Right 5 Cols: Playlist & Model Selector (Google Imagen 3 vs Anthropic DALL-E 3) */}
            <div className="lg:col-span-5 space-y-space-md">
              {/* Playlist Selector */}
              <div className="space-y-space-xs">
                <label className="font-label-md text-label-md text-on-surface-variant uppercase flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary-container text-[16px]">
                    queue_music
                  </span>
                  <span>Playlist de Destino</span>
                </label>
                <select
                  value={playlist}
                  onChange={(e) => setPlaylist(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-lg px-space-md py-space-sm font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary-container cursor-pointer"
                >
                  <option value="">Sin Playlist (Raíz)</option>
                  {playlists.map((pl) => (
                    <option key={pl.name} value={pl.name}>
                      📁 {pl.name.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Model Selector Radio Cards */}
              <div className="space-y-space-xs">
                <label className="font-label-md text-label-md text-on-surface-variant uppercase flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary-container text-[16px]">
                    brush
                  </span>
                  <span>Modelo Generador (Letra + Imagen de Fondo)</span>
                </label>
                <div className="grid grid-cols-2 gap-space-sm">
                  <label
                    onClick={() => setProvider('gemini')}
                    className={`cursor-pointer p-space-sm rounded-lg flex flex-col justify-between transition-all ${
                      provider === 'gemini'
                        ? 'bg-primary-container/15 ring-1 ring-primary-container'
                        : 'bg-surface-container hover:bg-surface-container-high'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-label-md text-label-md font-bold ${
                          provider === 'gemini' ? 'text-primary' : 'text-on-surface'
                        }`}
                      >
                        Google + Imagen 3
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
                        ? 'bg-primary-container/15 ring-1 ring-primary-container'
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
              </div>

              {/* Auto-generate toggle */}
              <label className="flex items-center gap-space-sm pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoGenerate}
                  onChange={(e) => setAutoGenerate(e.target.checked)}
                  className="w-4 h-4 rounded bg-surface-container-highest accent-[#00e0ff] cursor-pointer"
                />
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Generar letras, metadatos sociales y arte de fondo automáticamente al iniciar
                </span>
              </label>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-space-md border-t border-outline-variant/30 flex flex-wrap items-center justify-between gap-space-md">
            <div className="flex items-center gap-space-sm text-on-surface-variant font-label-sm text-label-sm">
              <span className="w-2 h-2 rounded-full bg-primary-container" />
              <span>Género: {activeGenreCard.title}</span>
              <span>•</span>
              <span>Modelo: {provider === 'gemini' ? 'Google + Imagen 3' : 'Anthropic + DALL-E 3'}</span>
            </div>

            <div className="flex items-center gap-space-md">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-space-lg py-space-sm rounded-lg bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-md text-label-md transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={loading}
                className="px-space-xl py-space-sm rounded-lg bg-gradient-to-r from-primary-container via-primary-fixed-dim to-secondary-container text-on-primary-fixed font-headline-sm text-headline-sm font-bold flex items-center gap-space-xs shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                <span>{loading ? 'GENERANDO PRODUCCIÓN CON IA...' : 'CREAR NUEVA PRODUCCIÓN'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
