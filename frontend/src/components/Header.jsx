import React, { useState, useEffect } from 'react';
import { Search, Plus, X, ChevronRight, Sparkles } from 'lucide-react';

export default function Header({
  title = 'Todas las canciones',
  subtitle,
  searchQuery = '',
  onSearchChange,
  onOpenNewSong,
  theme = 'dark',
  onToggleTheme,
}) {
  const [localQuery, setLocalQuery] = useState(searchQuery || '');

  useEffect(() => {
    setLocalQuery(searchQuery || '');
  }, [searchQuery]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onSearchChange(localQuery.trim());
    }
  };

  const handleSearchClick = () => {
    onSearchChange(localQuery.trim());
  };

  const handleClear = () => {
    setLocalQuery('');
    onSearchChange('');
  };

  return (
    <header className="h-16 shrink-0 px-space-xl border-b border-outline-variant/25 bg-surface-container-low/90 backdrop-blur-xl flex items-center justify-between gap-4 sticky top-0 z-20 select-none">
      {/* Title & Technical Context */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-headline-sm text-headline-sm text-on-surface tracking-wider uppercase">
              {title}
            </h2>
            <span className="w-2 h-2 rounded-full bg-primary-container shadow-[0_0_8px_rgba(0,240,255,0.8)] animate-pulse" />
          </div>
          {subtitle && (
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mt-0.5">
              STUDIO LIBRARY // {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Centered Search Bar */}
      <div className="flex-1 max-w-md mx-auto">
        <div className="relative group">
          <button
            type="button"
            onClick={handleSearchClick}
            className="absolute inset-y-0 left-0 pl-3 flex items-center text-on-surface-variant hover:text-primary-container cursor-pointer transition-colors"
            title="Buscar (o presiona Enter)"
          >
            <Search className="w-4 h-4" />
          </button>

          <input
            type="text"
            placeholder="Buscar producción por título, género, concepto... (Enter)"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-surface-container-lowest border border-outline-variant/40 focus:border-primary-container rounded-lg pl-9 pr-9 py-2 font-body-sm text-body-sm text-on-surface placeholder-outline focus:outline-none transition-all shadow-inner"
          />

          {localQuery && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Create New Production Button matching example.html */}
      <div className="flex items-center gap-space-md">
        {onToggleTheme && (
          <button
            type="button"
            onClick={(e) => onToggleTheme(e)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container hover:bg-primary-container/15 border border-outline-variant/30 hover:border-primary-container/60 text-on-surface-variant hover:text-primary-fixed font-label-sm uppercase transition-all cursor-pointer"
            title={theme === 'dark' ? 'Activar Modo Claro' : 'Activar Modo Oscuro'}
          >
            <span className="material-symbols-outlined text-[16px] text-primary-fixed">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
            <span className="hidden lg:inline">
              {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
            </span>
          </button>
        )}

        <div className="hidden xl:flex items-center gap-space-xs px-space-sm py-space-xs rounded bg-surface-container-highest text-primary-fixed font-label-sm text-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
          <span>GPU ENGINE ACTIVE</span>
        </div>

        <button
          onClick={onOpenNewSong}
          className="px-space-lg py-space-sm rounded-lg bg-primary-container text-on-primary-fixed font-headline-sm text-headline-sm font-bold flex items-center gap-space-xs shadow-sm hover:shadow dark:shadow-[0_0_16px_rgba(0,240,255,0.35)] hover:brightness-105 active:scale-95 transition-all cursor-pointer"
          title="Crear Nueva Producción"
        >
          <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
          <span>NUEVA PRODUCCIÓN</span>
        </button>
      </div>
    </header>
  );
}
