import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = '¿Confirmar eliminación?',
  description = 'Esta acción es permanente y no se puede deshacer.',
  confirmWord = 'Eliminar',
}) {
  const [typedWord, setTypedWord] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTypedWord('');
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMatch = typedWord.trim().toLowerCase() === confirmWord.toLowerCase();

  const handleConfirm = async () => {
    if (!isMatch) return;
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      alert(err.message || 'Error al eliminar');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-[#0e1222] border border-rose-500/40 rounded-2xl w-full max-w-md shadow-2xl shadow-rose-950/40 overflow-hidden animate-fade-scale">
        {/* Header */}
        <div className="px-6 py-4 border-b border-rose-500/20 bg-rose-500/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-white text-sm tracking-wider uppercase">
                {title}
              </h3>
              <p className="text-[10px] font-tech text-rose-400">SYS.DANGER // CONFIRMACIÓN OBLIGATORIA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <p className="text-slate-300 leading-relaxed font-sans">
            {description}
          </p>

          <div className="p-3.5 rounded-xl bg-black/50 border border-white/[0.08] space-y-2">
            <label className="block text-[11px] font-tech text-slate-300">
              Para confirmar, escribe <strong className="text-rose-400 font-bold uppercase">{confirmWord}</strong> abajo:
            </label>
            <input
              type="text"
              autoFocus
              placeholder={`Escribe ${confirmWord}`}
              value={typedWord}
              onChange={(e) => setTypedWord(e.target.value)}
              className="w-full bg-[#070a14] border border-rose-500/30 focus:border-rose-400 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-rose-500/40"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isMatch || loading}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                isMatch && !loading
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 active:scale-95'
                  : 'bg-rose-950/40 text-slate-500 border border-rose-900/40 cursor-not-allowed opacity-50'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{loading ? 'Eliminando...' : 'Eliminar Definitivamente'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

