import React, { useState, useRef, useEffect } from 'react';
import { 
  MoreVertical, 
  Trash2, 
  Disc, 
  Music, 
  Image as ImageIcon, 
  FileText,
  Check,
  FolderOpen
} from 'lucide-react';
import { getImageUrl, openProjectFolder } from '../api';

export default function SongCard({
  project,
  playlists = [],
  availableGenreTags = [],
  onOpen,
  onMovePlaylist,
  onUpdateGenreTags,
  onSelectGenreFilter,
  onDelete,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showGenrePicker, setShowGenrePicker] = useState(false);
  const [newGenreInput, setNewGenreInput] = useState('');
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef(null);
  const genrePickerRef = useRef(null);

  const songTags = Array.isArray(project.genre_tags) ? project.genre_tags : [];

  // Close menus on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
      if (genrePickerRef.current && !genrePickerRef.current.contains(event.target)) {
        setShowGenrePicker(false);
      }
    }
    if (showMenu || showGenrePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu, showGenrePicker]);

  const handleToggleTag = async (tag) => {
    if (!onUpdateGenreTags) return;
    const exists = songTags.includes(tag);
    const nextTags = exists
      ? songTags.filter((t) => t !== tag)
      : [...songTags, tag];
    await onUpdateGenreTags(project.rel_path, nextTags);
  };

  const handleCreateAndAssignTag = async (e) => {
    e.preventDefault();
    const clean = newGenreInput.trim();
    if (!clean || !onUpdateGenreTags) return;
    if (!songTags.includes(clean)) {
      await onUpdateGenreTags(project.rel_path, [...songTags, clean]);
    }
    setNewGenreInput('');
  };

  const getStatusTag = (status) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-black/80 text-white backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.45)] border border-white/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            Completado
          </span>
        );
      case 'READY_TO_RENDER':
        return (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-black/80 text-white backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.45)] border border-white/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00e0ff] shadow-[0_0_8px_rgba(0,224,255,0.8)]" />
            Listo para Render
          </span>
        );
      case 'AWAITING_AUDIO':
        return (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-black/80 text-white backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.45)] border border-white/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            Esperando Audio
          </span>
        );
      case 'UNINITIALIZED':
        return (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-black/80 text-white backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.45)] border border-white/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            Por Inicializar
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-black/80 text-white backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.45)] border border-white/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
            Borrador
          </span>
        );
    }
  };

  return (
    <div 
      onClick={() => onOpen(project)}
      className="group relative flex flex-col cursor-pointer transition-all duration-300"
    >
      {/* ── YouTube Style Large 16:9 Thumbnail with Dark Drop Shadow ── */}
      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-surface-container-lowest border border-outline-variant/30 shadow-[0_12px_28px_-4px_rgba(0,0,0,0.24),0_6px_12px_-4px_rgba(0,0,0,0.14)] group-hover:shadow-[0_20px_40px_-6px_rgba(0,0,0,0.36),0_10px_20px_-5px_rgba(0,0,0,0.22)] group-hover:scale-[1.015] group-hover:border-primary-container/60 transition-all duration-300">
        {project.has_bg && !imgError ? (
          <img
            src={getImageUrl(project.rel_path)}
            alt={project.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-surface-container-lowest to-surface-container-high text-on-surface-variant">
            <Disc className="w-12 h-12 text-outline animate-spin-slow mb-1 opacity-40" />
            <span className="font-label-sm text-label-sm text-outline">SIN CARÁTULA</span>
          </div>
        )}

        {/* Crisp dark vignette (eliminates milky white fogs over artwork) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/25 pointer-events-none" />

        {/* Top-Left: Status Tag */}
        <div className="absolute top-2.5 left-2.5 pointer-events-none">
          {getStatusTag(project.status)}
        </div>

        {/* Bottom-Right: Video format tag */}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 pointer-events-none">
          {project.has_video_16x9 && (
            <span className="px-2 py-0.5 rounded font-label-sm text-label-sm font-bold bg-black/80 text-[#00e0ff] border border-white/20 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
              16:9
            </span>
          )}
          {project.has_video_9x16 && (
            <span className="px-2 py-0.5 rounded font-label-sm text-label-sm font-bold bg-black/80 text-teal-300 border border-white/20 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
              9:16
            </span>
          )}
          {!project.has_video_16x9 && !project.has_video_9x16 && project.has_audio && (
            <span className="px-2 py-0.5 rounded font-label-sm text-label-sm font-semibold bg-black/80 text-[#00e0ff] border border-white/20 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
              AUDIO READY
            </span>
          )}
        </div>
      </div>

      {/* ── Metadata Section Below Thumbnail ── */}
      <div className="flex items-start gap-3 mt-3 px-1">
        {/* Disc / Icon Avatar */}
        <div className="w-9 h-9 rounded-lg bg-surface-container-high border border-outline-variant/30 flex items-center justify-center text-primary-container shrink-0 mt-0.5 shadow-sm group-hover:border-primary-container/50 transition-colors">
          <span className="material-symbols-outlined text-[18px]">album</span>
        </div>

        {/* Song Info */}
        <div className="flex-1 min-w-0 pr-1">
          <h3 className="font-headline-sm text-headline-sm text-on-surface leading-snug group-hover:text-primary-fixed transition-colors line-clamp-2">
            {project.title}
          </h3>

          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 line-clamp-1">
            {project.concept || project.style}
          </p>

          {/* Musical Genre Tags Row (independent of Playlist) */}
          <div
            className="flex items-center flex-wrap gap-1 mt-1.5 relative"
            ref={genrePickerRef}
            onClick={(e) => e.stopPropagation()}
          >
            {songTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onSelectGenreFilter && onSelectGenreFilter(tag)}
                className="px-1.5 py-0.5 rounded bg-primary-container/15 hover:bg-primary-container text-primary-fixed hover:text-on-primary-fixed border border-primary-container/30 text-[10px] font-label-sm transition-colors cursor-pointer"
                title={`Filtrar por género: ${tag}`}
              >
                #{tag}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowGenrePicker(!showGenrePicker)}
              className="px-1.5 py-0.5 rounded bg-surface-container-highest/70 hover:bg-primary-container/20 text-on-surface-variant hover:text-primary-fixed border border-outline-variant/25 text-[10px] font-label-sm flex items-center gap-0.5 transition-colors cursor-pointer"
              title="Asignar o crear etiquetas de género musical"
            >
              <span className="material-symbols-outlined text-[11px]">sell</span>
              <span>{songTags.length === 0 ? '+ Género' : '+'}</span>
            </button>

            {/* Quick Genre Tag Picker Popover */}
            {showGenrePicker && (
              <div className="absolute left-0 top-6 w-64 bg-surface-container-high border border-primary-container/40 rounded-lg shadow-2xl p-2.5 z-50 space-y-2 animate-fade-scale">
                <div className="flex items-center justify-between border-b border-outline-variant/25 pb-1">
                  <span className="text-[10px] font-label-sm uppercase text-primary-fixed font-bold">
                    Etiquetas de Género Musical
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowGenrePicker(false)}
                    className="text-outline hover:text-on-surface text-xs"
                  >
                    ✕
                  </button>
                </div>

                {/* Select from existing catalog */}
                <div className="max-h-36 overflow-y-auto flex flex-wrap gap-1">
                  {Array.from(new Set([...availableGenreTags, ...songTags])).map((tag) => {
                    const active = songTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleToggleTag(tag)}
                        className={`px-2 py-0.5 rounded text-[10px] font-label-sm transition-all flex items-center gap-1 cursor-pointer ${
                          active
                            ? 'bg-primary-container text-on-primary-fixed font-bold'
                            : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border border-outline-variant/25'
                        }`}
                      >
                        <span>{active ? '✓' : '+'}</span>
                        <span>{tag}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Add new tag to song & catalog */}
                <form onSubmit={handleCreateAndAssignTag} className="flex items-center gap-1 pt-1 border-t border-outline-variant/20">
                  <input
                    type="text"
                    value={newGenreInput}
                    onChange={(e) => setNewGenreInput(e.target.value)}
                    placeholder="Nuevo género..."
                    className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded px-2 py-1 text-[11px] text-on-surface focus:outline-none focus:border-primary-container"
                  />
                  <button
                    type="submit"
                    disabled={!newGenreInput.trim()}
                    className="px-2 py-1 rounded bg-primary-container text-on-primary-fixed text-[10px] font-label-sm uppercase font-bold disabled:opacity-40"
                  >
                    Crear
                  </button>
                </form>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1.5 font-label-sm text-label-sm text-on-surface-variant">
            {project.playlist ? (
              <span className="text-primary-fixed bg-surface-container-highest px-2 py-0.5 rounded truncate max-w-[140px]">
                📁 {project.playlist.replace(/_/g, ' ')}
              </span>
            ) : (
              <span className="text-outline bg-surface-container px-1.5 py-0.5 rounded">
                Sin Playlist
              </span>
            )}

            {/* Asset presence mini icons */}
            <div className="flex items-center gap-1.5 ml-auto">
              <span title={project.has_audio ? 'Audio cargado' : 'Falta audio'}>
                <Music className={`w-3 h-3 ${project.has_audio ? 'text-primary-container' : 'text-outline'}`} />
              </span>
              <span title={project.has_lyrics ? 'Letras generadas' : 'Sin letras'}>
                <FileText className={`w-3 h-3 ${project.has_lyrics ? 'text-primary-fixed' : 'text-outline'}`} />
              </span>
              <span title={project.has_bg ? 'Arte generado' : 'Sin fondo'}>
                <ImageIcon className={`w-3 h-3 ${project.has_bg ? 'text-secondary' : 'text-outline'}`} />
              </span>
            </div>
          </div>
        </div>

        {/* ── 3-Dots Action Menu ── */}
        <div className="relative shrink-0" ref={menuRef} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            title="Opciones de la canción"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div 
              className="absolute right-0 top-8 w-56 bg-surface-container-high border border-outline-variant/40 rounded-xl shadow-2xl py-2 z-50 animate-fade-in font-body-sm text-body-sm"
            >
              <div className="px-3 py-1 font-label-sm text-label-sm uppercase tracking-wider text-outline border-b border-outline-variant/30 mb-1">
                ASIGNAR A PLAYLIST
              </div>

              {/* Option: Root (Sin Playlist) */}
              <button
                onClick={() => {
                  onMovePlaylist(project.rel_path, null);
                  setShowMenu(false);
                }}
                className={`w-full text-left px-3 py-1.5 hover:bg-surface-container-highest flex items-center justify-between transition-colors ${
                  !project.playlist ? 'text-primary-container font-bold' : 'text-on-surface'
                }`}
              >
                <span>Sin Playlist (Raíz)</span>
                {!project.playlist && <Check className="w-3.5 h-3.5 text-primary-container" />}
              </button>

              {/* Existing Playlists */}
              {playlists.map((pl) => {
                const isCurrent = project.playlist === pl.name;
                return (
                  <button
                    key={pl.name}
                    onClick={() => {
                      onMovePlaylist(project.rel_path, pl.name);
                      setShowMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 hover:bg-surface-container-highest flex items-center justify-between transition-colors truncate ${
                      isCurrent ? 'text-primary-fixed font-bold' : 'text-on-surface'
                    }`}
                  >
                    <span className="truncate">📁 {pl.name.replace(/_/g, ' ')}</span>
                    {isCurrent && <Check className="w-3.5 h-3.5 text-primary-fixed shrink-0" />}
                  </button>
                );
              })}

              <div className="border-t border-outline-variant/30 my-1" />

              {/* Option: Open Project Folder */}
              <button
                onClick={async () => {
                  setShowMenu(false);
                  try {
                    await openProjectFolder(project.rel_path);
                  } catch (err) {
                    alert(err.message);
                  }
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-surface-container-highest text-on-surface flex items-center gap-2 transition-colors cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-tertiary-container" />
                <span>Abrir carpeta local</span>
              </button>

              {/* Option: Delete Song */}
              <button
                onClick={() => {
                  onDelete(project.rel_path);
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-error-container/40 text-error flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar canción</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
