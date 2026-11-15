import React from 'react';
import SongCard from './SongCard';
import FilterBar from './FilterBar';
import { Music, Sparkles } from 'lucide-react';

export default function Dashboard({
  projects = [],
  playlists = [],
  loading = false,
  statusFilter = '',
  onSelectStatus,
  genreFilter = '',
  onSelectGenre,
  availableGenreTags = [],
  onAddNewGenreTag,
  onUpdateGenreTags,
  onOpenProject,
  onMovePlaylist,
  onDeleteProject,
  onNewSong,
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-surface">
      {/* Filter Chips (Status + Musical Genre Tags) */}
      <FilterBar
        activeStatus={statusFilter}
        onSelectStatus={onSelectStatus}
        activeGenre={genreFilter}
        onSelectGenre={onSelectGenre}
        availableGenreTags={availableGenreTags}
        onAddNewGenreTag={onAddNewGenreTag}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-8 pt-6 pb-12">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full border-2 border-primary-container border-t-transparent animate-spin mx-auto mb-3" />
              <p className="font-label-md text-label-md text-on-surface-variant">CARGANDO BIBLIOTECA...</p>
            </div>
          </div>
        ) : projects.length === 0 ? (
          <div className="h-96 flex items-center justify-center text-center">
            <div className="max-w-md bg-surface-container border border-outline-variant/30 rounded-2xl p-8 shadow-2xl animate-fade-scale">
              <div className="w-16 h-16 rounded-2xl bg-surface-container-high text-primary-container flex items-center justify-center mx-auto mb-4 shadow-inner">
                <Music className="w-8 h-8" />
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface">No se encontraron producciones</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                {genreFilter
                  ? `No hay canciones etiquetadas con el género "${genreFilter}".`
                  : 'No hay proyectos en esta categoría o tu biblioteca aún no contiene canciones.'}
              </p>
              <div className="flex items-center justify-center gap-3 mt-6">
                {genreFilter && (
                  <button
                    type="button"
                    onClick={() => onSelectGenre('')}
                    className="px-4 py-2 rounded-lg bg-surface-container-highest text-on-surface font-label-md uppercase cursor-pointer"
                  >
                    Ver todos los géneros
                  </button>
                )}
                <button
                  onClick={onNewSong}
                  className="px-space-xl py-space-sm rounded-lg bg-primary-container text-on-primary-fixed font-headline-sm text-headline-sm font-bold inline-flex items-center gap-space-xs shadow-[0_0_16px_rgba(0,240,255,0.35)] cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Nueva Producción</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-9 animate-fade-scale">
            {projects.map((project) => (
              <SongCard
                key={project.rel_path}
                project={project}
                playlists={playlists}
                availableGenreTags={availableGenreTags}
                onOpen={onOpenProject}
                onMovePlaylist={onMovePlaylist}
                onUpdateGenreTags={onUpdateGenreTags}
                onSelectGenreFilter={onSelectGenre}
                onDelete={onDeleteProject}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
