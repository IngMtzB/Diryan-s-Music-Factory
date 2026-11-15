import React, { useState } from 'react';
import { 
  Music, 
  Folder, 
  FolderPlus, 
  Radio, 
  Layers, 
  Check, 
  X,
  Disc3,
  Sparkles,
  Edit2,
  Trash2
} from 'lucide-react';

export default function Sidebar({ 
  playlists = [], 
  unclassifiedCount = 0, 
  totalCount = 0, 
  selectedPlaylist, 
  onSelectPlaylist, 
  onCreatePlaylist,
  onRenamePlaylist,
  onPromptDeletePlaylist,
  onOpenSettings,
  theme = 'dark',
  onToggleTheme,
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  // Editing state
  const [editingPlaylist, setEditingPlaylist] = useState(null); // playlist name
  const [editNameValue, setEditNameValue] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    await onCreatePlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setIsCreating(false);
  };

  const handleStartRename = (e, pl) => {
    e.stopPropagation();
    setEditingPlaylist(pl.name);
    setEditNameValue(pl.name.replace(/_/g, ' '));
  };

  const handleSaveRename = async (e) => {
    e.preventDefault();
    if (!editNameValue.trim() || editNameValue.trim() === editingPlaylist) {
      setEditingPlaylist(null);
      return;
    }
    await onRenamePlaylist(editingPlaylist, editNameValue.trim());
    setEditingPlaylist(null);
  };

  return (
    <aside className="w-64 bg-surface-container-low border-r border-outline-variant/30 flex flex-col h-screen select-none shrink-0 z-30">
      {/* Brand Header matching example.html */}
      <div className="p-5 border-b border-outline-variant/25 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center shadow-inner">
          <span className="material-symbols-outlined text-primary-fixed-dim text-[22px]">
            graphic_eq
          </span>
        </div>
        <div>
          <h1 className="font-headline-sm text-headline-sm tracking-wider text-on-surface leading-tight uppercase font-bold">
            AI MUSIC FACTORY
          </h1>
          <p className="font-label-sm text-label-sm text-primary-fixed tracking-wider flex items-center gap-1 mt-0.5 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
            <span>DIRYAN&apos;S STUDIO</span>
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-space-md py-space-lg space-y-space-xl">
        {/* Main Sections */}
        <div>
          <p className="px-space-sm font-label-sm text-label-sm uppercase tracking-wider text-outline mb-space-sm">
            BIBLIOTECA // ROOT
          </p>
          <div className="space-y-1">
            <button
              onClick={() => onSelectPlaylist(null)}
              className={`w-full flex items-center justify-between px-space-md py-space-sm rounded-lg font-label-md text-label-md uppercase transition-all cursor-pointer ${
                selectedPlaylist === null
                  ? 'bg-primary-container text-on-primary-container font-bold shadow-sm dark:shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">library_music</span>
                <span>Todas las canciones</span>
              </div>
              <span
                className={`font-label-sm text-label-sm px-2 py-0.5 rounded-full ${
                  selectedPlaylist === null
                    ? 'bg-on-primary-container/20 text-on-primary-container'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {totalCount}
              </span>
            </button>

            <button
              onClick={() => onSelectPlaylist('unclassified')}
              className={`w-full flex items-center justify-between px-space-md py-space-sm rounded-lg font-label-md text-label-md uppercase transition-all cursor-pointer ${
                selectedPlaylist === 'unclassified'
                  ? 'bg-primary-container text-on-primary-container font-bold shadow-sm dark:shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">music_note</span>
                <span>Sin Playlist</span>
              </div>
              <span
                className={`font-label-sm text-label-sm px-2 py-0.5 rounded-full ${
                  selectedPlaylist === 'unclassified'
                    ? 'bg-on-primary-container/20 text-on-primary-container'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {unclassifiedCount}
              </span>
            </button>
          </div>
        </div>

        {/* Playlists Section */}
        <div>
          <div className="px-space-sm flex items-center justify-between mb-space-sm">
            <p className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
              PLAYLISTS ({playlists.length})
            </p>
            <button
              onClick={() => setIsCreating(true)}
              className="text-on-surface-variant hover:text-primary-container transition-colors p-1 rounded-lg hover:bg-surface-container-high cursor-pointer"
              title="Nueva Playlist"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>

          {/* New Playlist Input */}
          {isCreating && (
            <form onSubmit={handleCreate} className="px-1 mb-2 flex items-center gap-1.5 animate-fade-in">
              <input
                type="text"
                autoFocus
                placeholder="Nombre de playlist..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="flex-1 bg-surface-container border border-primary-container/50 rounded-lg px-2.5 py-1 font-body-sm text-body-sm text-on-surface focus:outline-none"
              />
              <button
                type="submit"
                className="p-1.5 rounded bg-primary-container text-on-primary-container hover:bg-primary-fixed cursor-pointer"
              >
                <Check className="w-3 h-3 stroke-[3]" />
              </button>
              <button
                type="button"
                onClick={() => { setIsCreating(false); setNewPlaylistName(''); }}
                className="p-1.5 rounded bg-surface-container-high text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </form>
          )}

          {/* Playlist Items */}
          <div className="space-y-1">
            {playlists.length === 0 && !isCreating ? (
              <p className="px-space-sm py-2 font-body-sm text-body-sm text-outline italic">
                Sin playlists activas
              </p>
            ) : (
              playlists.map((pl) => {
                const isSelected = selectedPlaylist === pl.name;
                const isEditing = editingPlaylist === pl.name;

                if (isEditing) {
                  return (
                    <form
                      key={pl.name}
                      onSubmit={handleSaveRename}
                      className="px-2 py-1 flex items-center gap-1.5 bg-surface-container border border-primary-container/50 rounded-lg animate-fade-in"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        className="flex-1 bg-transparent px-1 font-body-sm text-body-sm text-on-surface focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="p-1 rounded bg-primary-container text-on-primary-container cursor-pointer"
                        title="Guardar nombre"
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPlaylist(null)}
                        className="p-1 rounded bg-surface-container-high text-on-surface-variant cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </form>
                  );
                }

                return (
                  <div
                    key={pl.name}
                    onClick={() => onSelectPlaylist(pl.name)}
                    className={`group w-full flex items-center justify-between px-space-md py-space-sm rounded-lg font-label-md text-label-md uppercase transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-surface-container-high text-primary-fixed border border-primary-container/40 shadow-sm'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-1">
                      <span
                        className={`material-symbols-outlined text-[16px] shrink-0 ${
                          isSelected ? 'text-primary-container' : 'text-outline'
                        }`}
                      >
                        queue_music
                      </span>
                      <span className="truncate font-bold">{pl.name.replace(/_/g, ' ')}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant group-hover:hidden">
                        {pl.count}
                      </span>

                      <div className="hidden group-hover:flex items-center gap-1">
                        <button
                          onClick={(e) => handleStartRename(e, pl)}
                          className="p-1 text-on-surface-variant hover:text-primary-fixed rounded hover:bg-surface-container-highest transition-colors cursor-pointer"
                          title="Editar nombre"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPromptDeletePlaylist(pl);
                          }}
                          className="p-1 text-on-surface-variant hover:text-error rounded hover:bg-surface-container-highest transition-colors cursor-pointer"
                          title="Eliminar playlist"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom Settings & Theme Actions + Studio Status */}
      <div className="p-3 bg-surface-container-low border-t border-outline-variant/25 space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-highest border border-outline-variant/30 hover:border-primary-container/50 text-on-surface-variant hover:text-on-surface transition-all cursor-pointer group"
            title="Configuraciones del Estudio (Catálogo de Géneros y Sub-géneros)"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-primary-fixed group-hover:rotate-45 transition-transform duration-300">
                settings
              </span>
              <span className="font-label-md text-label-md uppercase font-bold">
                Configuraciones
              </span>
            </div>
            <span className="material-symbols-outlined text-[14px] text-outline group-hover:text-primary-fixed">
              chevron_right
            </span>
          </button>

          {onToggleTheme && (
            <button
              type="button"
              onClick={(e) => onToggleTheme(e)}
              className="p-2.5 rounded-lg bg-surface-container hover:bg-primary-container/20 border border-outline-variant/30 hover:border-primary-container/60 text-primary-fixed transition-all cursor-pointer shrink-0"
              title={
                theme === 'dark'
                  ? 'Cambiar a Modo Claro (Transición Épica)'
                  : 'Cambiar a Modo Oscuro (Transición Épica)'
              }
            >
              <span className="material-symbols-outlined text-[18px] block">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
          )}
        </div>

        <div className="px-2 pt-1 flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
            <span>LOCAL RENDER ENGINE</span>
          </div>
          <span className="text-primary-fixed font-bold">100% OK</span>
        </div>
      </div>
    </aside>
  );
}
