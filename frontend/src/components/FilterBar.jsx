import React, { useState } from 'react';

const FILTER_TAGS = [
  { id: '', label: 'Todos los Estados' },
  { id: 'COMPLETED', label: 'Completados', emoji: '✅' },
  { id: 'READY_TO_RENDER', label: 'Listos para Render', emoji: '⚡' },
  { id: 'AWAITING_AUDIO', label: 'Esperando Audio', emoji: '🎵' },
  { id: 'UNINITIALIZED', label: 'Por Inicializar', emoji: '📦' },
  { id: 'DRAFT', label: 'Borradores', emoji: '📝' },
];

export default function FilterBar({
  activeStatus,
  onSelectStatus,
  activeGenre = '',
  onSelectGenre,
  availableGenreTags = [],
  onAddNewGenreTag,
}) {
  const [isAddingGenre, setIsAddingGenre] = useState(false);
  const [newGenreName, setNewGenreName] = useState('');

  const handleCreateGenre = async (e) => {
    e.preventDefault();
    const clean = newGenreName.trim();
    if (!clean) return;
    if (onAddNewGenreTag) {
      await onAddNewGenreTag(clean);
    }
    setNewGenreName('');
    setIsAddingGenre(false);
  };

  return (
    <div className="w-full shrink-0 flex flex-col gap-2 py-2.5 px-6 border-b border-outline-variant/25 bg-surface-container-low/95 backdrop-blur-md z-10 shadow-sm">
      {/* Row 1: Production Status Filter */}
      <div className="flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-label-sm uppercase tracking-wider text-outline mr-1 shrink-0">
            ESTADO:
          </span>
          {FILTER_TAGS.map((tag) => {
            const isActive = (activeStatus || '') === tag.id;
            return (
              <button
                key={tag.id}
                onClick={() => onSelectStatus(tag.id)}
                className={`px-2.5 py-1 rounded font-label-sm text-label-sm transition-all whitespace-nowrap flex items-center gap-1 select-none cursor-pointer ${
                  isActive
                    ? 'bg-primary-container text-on-primary-fixed font-bold shadow-sm dark:shadow-[0_0_10px_rgba(0,224,255,0.25)]'
                    : 'bg-surface-container hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tag.emoji && <span className="text-[10px]">{tag.emoji}</span>}
                <span>{tag.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2: Musical Genre Tag Filter + Quick Add Genre */}
      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-outline-variant/15 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-label-sm uppercase tracking-wider text-primary-fixed mr-1 shrink-0 flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">sell</span>
            GÉNERO MUSICAL:
          </span>

          <button
            type="button"
            onClick={() => onSelectGenre && onSelectGenre('')}
            className={`px-2.5 py-1 rounded font-label-sm text-label-sm transition-all whitespace-nowrap cursor-pointer ${
              !activeGenre
                ? 'bg-primary-container text-on-primary-fixed font-bold shadow-sm dark:shadow-[0_0_10px_rgba(0,224,255,0.25)]'
                : 'bg-surface-container hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Todos
          </button>

          {availableGenreTags.map((genre) => {
            const isActive = activeGenre.toLowerCase() === genre.toLowerCase();
            return (
              <button
                key={genre}
                type="button"
                onClick={() =>
                  onSelectGenre && onSelectGenre(isActive ? '' : genre)
                }
                className={`px-2.5 py-1 rounded font-label-sm text-label-sm transition-all whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                  isActive
                    ? 'bg-primary-container text-on-primary-fixed font-bold shadow-sm dark:shadow-[0_0_10px_rgba(0,224,255,0.25)]'
                    : 'bg-surface-container-lowest hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface border border-outline-variant/25'
                }`}
              >
                <span>{genre}</span>
              </button>
            );
          })}

          {/* Add New Genre Tag inline */}
          {!isAddingGenre ? (
            <button
              type="button"
              onClick={() => setIsAddingGenre(true)}
              className="px-2.5 py-1 rounded font-label-sm text-label-sm bg-tertiary-container/15 hover:bg-tertiary-container text-tertiary hover:text-on-tertiary border border-tertiary-container/40 whitespace-nowrap flex items-center gap-1 transition-all cursor-pointer shrink-0"
              title="Agregar un nuevo género musical al catálogo reutilizable"
            >
              <span className="material-symbols-outlined text-[13px]">add</span>
              <span>Nuevo Género</span>
            </button>
          ) : (
            <form
              onSubmit={handleCreateGenre}
              className="flex items-center gap-1 shrink-0 animate-fade-scale"
            >
              <input
                type="text"
                autoFocus
                value={newGenreName}
                onChange={(e) => setNewGenreName(e.target.value)}
                placeholder="Nombre del género..."
                className="bg-surface-container-lowest border border-primary-container rounded px-2 py-0.5 text-body-sm text-on-surface w-36 focus:outline-none"
              />
              <button
                type="submit"
                className="px-2 py-0.5 rounded bg-primary-container text-on-primary-fixed text-label-sm uppercase font-bold cursor-pointer"
              >
                OK
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingGenre(false);
                  setNewGenreName('');
                }}
                className="px-1.5 py-0.5 rounded bg-surface-container-highest text-outline text-label-sm cursor-pointer"
              >
                ✕
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
