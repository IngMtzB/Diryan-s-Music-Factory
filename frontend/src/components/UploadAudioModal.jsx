import React, { useState } from 'react';
import { X, UploadCloud, Music, CheckCircle2 } from 'lucide-react';

export default function UploadAudioModal({
  isOpen,
  onClose,
  file,
  projectTitle = '',
  onConfirmUpload,
}) {
  const [nameMode, setNameMode] = useState('title'); // 'title' | 'original' | 'custom'
  const [customName, setCustomName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !file) return null;

  // Clean candidate title
  const cleanTitle = (projectTitle || 'cancion').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '_');
  const ext = file.name.substring(file.name.lastIndexOf('.')) || '.mp3';
  const titleFilename = `${cleanTitle}${ext}`;

  const handleConfirm = async () => {
    setUploading(true);
    setError('');
    try {
      await onConfirmUpload(file, {
        mode: nameMode,
        customName: customName.trim(),
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Error al subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-studio-850 border border-studio-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-studio-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-cyan/10 border border-brand-cyan/30 flex items-center justify-center text-brand-cyan">
              <UploadCloud className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-base">Confirmar Audio del Proyecto</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-studio-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* File Card */}
          <div className="p-3.5 rounded-xl bg-studio-900 border border-studio-700 flex items-center justify-between">
            <div className="flex items-center gap-3 truncate pr-2">
              <div className="w-8 h-8 rounded-lg bg-studio-800 flex items-center justify-center text-brand-pink shrink-0">
                <Music className="w-4 h-4" />
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-white truncate">{file.name}</p>
                <p className="text-[11px] text-slate-400">{formatFileSize(file.size)}</p>
              </div>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Cada canción mantiene un solo audio activo. Los videos de salida (<code className="text-brand-cyan">16:9</code> y <code className="text-brand-cyan">9:16</code>) adoptarán este mismo nombre.
          </p>

          {/* Options */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-semibold text-slate-300 block">
              ¿Cómo deseas nombrar el archivo de audio?
            </label>

            {/* Option 1: Use song title */}
            <label
              onClick={() => setNameMode('title')}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                nameMode === 'title'
                  ? 'border-brand-cyan bg-brand-cyan/5 text-white'
                  : 'border-studio-700 bg-studio-900/40 text-slate-400 hover:border-studio-600'
              }`}
            >
              <input
                type="radio"
                name="nameMode"
                checked={nameMode === 'title'}
                onChange={() => setNameMode('title')}
                className="mt-0.5 text-brand-cyan focus:ring-brand-cyan/20"
              />
              <div className="text-xs">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  Usar título de la canción <span className="text-[10px] bg-brand-cyan/20 text-brand-cyan px-1.5 py-0.5 rounded font-mono">Recomendado</span>
                </p>
                <p className="text-slate-400 font-mono text-[11px] mt-0.5 truncate">{titleFilename}</p>
              </div>
            </label>

            {/* Option 2: Keep original filename */}
            <label
              onClick={() => setNameMode('original')}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                nameMode === 'original'
                  ? 'border-brand-cyan bg-brand-cyan/5 text-white'
                  : 'border-studio-700 bg-studio-900/40 text-slate-400 hover:border-studio-600'
              }`}
            >
              <input
                type="radio"
                name="nameMode"
                checked={nameMode === 'original'}
                onChange={() => setNameMode('original')}
                className="mt-0.5 text-brand-cyan focus:ring-brand-cyan/20"
              />
              <div className="text-xs">
                <p className="font-semibold text-white">Conservar nombre original</p>
                <p className="text-slate-400 font-mono text-[11px] mt-0.5 truncate">{file.name}</p>
              </div>
            </label>

            {/* Option 3: Custom name */}
            <label
              onClick={() => setNameMode('custom')}
              className={`flex flex-col gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                nameMode === 'custom'
                  ? 'border-brand-cyan bg-brand-cyan/5 text-white'
                  : 'border-studio-700 bg-studio-900/40 text-slate-400 hover:border-studio-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="nameMode"
                  checked={nameMode === 'custom'}
                  onChange={() => setNameMode('custom')}
                  className="text-brand-cyan focus:ring-brand-cyan/20"
                />
                <span className="text-xs font-semibold text-white">
                  Personalizado (Reconstrucción / Versión alternativa)
                </span>
              </div>
              {nameMode === 'custom' && (
                <input
                  type="text"
                  placeholder="Ej. MiCancion_Versión_Remix"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-studio-900 border border-studio-600 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-cyan font-mono"
                />
              )}
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-studio-700/60">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-studio-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={uploading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-brand-cyan to-blue-500 text-studio-900 font-bold text-xs shadow-md shadow-brand-cyan/20 hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
            >
              {uploading ? 'Subiendo...' : 'Confirmar y Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

