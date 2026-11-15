import React, { useEffect, useState } from 'react';
import { Video, CheckCircle2, AlertCircle, Sparkles, Loader2 } from 'lucide-react';

export default function RenderModal({
  isOpen,
  jobId,
  onComplete,
  onClose,
}) {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Iniciando renderizado...');
  const [status, setStatus] = useState('running'); // running, completed, failed
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !jobId) return;

    setProgress(0);
    setMessage('Conectando con el motor de renderizado...');
    setStatus('running');
    setError('');

    const eventSource = new EventSource(`/api/render/stream/${jobId}`);

    eventSource.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        setProgress(data.percent || 0);
        setMessage(data.message || 'Procesando fotogramas...');

        if (data.status === 'completed') {
          setStatus('completed');
          setProgress(100);
          eventSource.close();
        } else if (data.status === 'failed') {
          setStatus('failed');
          setError(data.error || 'Error durante el renderizado');
          eventSource.close();
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    });

    eventSource.onerror = () => {
      // Stream completed or disconnected
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [isOpen, jobId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-studio-850 border border-studio-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 text-center">
        {/* Animated Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-studio-900 border border-studio-700 flex items-center justify-center mb-4 relative shadow-inner">
          {status === 'running' && (
            <>
              <div className="absolute inset-0 rounded-2xl border border-brand-cyan/40 animate-ping opacity-30" />
              <Video className="w-8 h-8 text-brand-cyan animate-pulse" />
            </>
          )}
          {status === 'completed' && (
            <CheckCircle2 className="w-9 h-9 text-emerald-400 animate-bounce" />
          )}
          {status === 'failed' && (
            <AlertCircle className="w-9 h-9 text-rose-500" />
          )}
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-white tracking-wide">
          {status === 'running' && 'Renderizando Video Musical'}
          {status === 'completed' && '¡Video Generado con Éxito!'}
          {status === 'failed' && 'Error de Renderizado'}
        </h3>

        <p className="text-xs text-slate-400 mt-1 min-h-[32px] px-2 flex items-center justify-center">
          {error ? error : message}
        </p>

        {/* Progress Bar */}
        <div className="mt-4 mb-2">
          <div className="h-3 w-full bg-studio-900 rounded-full overflow-hidden p-0.5 border border-studio-700/60">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                status === 'failed'
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-brand-pink via-purple-500 to-brand-cyan'
              }`}
              style={{ width: `${Math.min(100, Math.max(2, progress))}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1.5 px-1">
            <span>{status === 'running' ? 'Aceleración GPU/CPU' : status.toUpperCase()}</span>
            <span className="font-bold text-brand-cyan">{progress.toFixed(0)}%</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-6">
          {status === 'completed' && (
            <button
              onClick={() => {
                onComplete?.();
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-studio-900 font-bold text-xs shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all"
            >
              Ver Video en el Estudio
            </button>
          )}

          {status === 'failed' && (
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-studio-700 hover:bg-studio-600 text-white font-bold text-xs transition-colors"
            >
              Cerrar
            </button>
          )}

          {status === 'running' && (
            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-cyan" />
              <span>Generando overlays reactivos al beat...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

