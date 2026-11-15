import React, { useState, useEffect } from 'react';

const TELEMETRY_STEPS = {
  production: [
    'Inicializando matriz de producción y contenedor SQLite...',
    'Sintetizando arquitectura lírica, fonética y metatags para Suno AI...',
    'Estructurando metadatos sociales para YouTube Studio & TikTok (Data.txt)...',
    'Renderizando arte conceptual 16:9 con zona segura central 9:16...',
    'Calibrando paleta cromática y espectro de ondas...',
  ],
  spec: [
    'Conectando con motor neuronal de composición musical...',
    'Generando estructura lírica, rimas y fonética especializada...',
    'Calculando fórmula de Style of Music (<200 chars) y dirección instrumental...',
    'Compilando metadatos de YouTube y TikTok en español (Data.txt)...',
  ],
  image: [
    'Inicializando motor de difusión visual de alta resolución...',
    'Encuadrando sujeto en zona segura central (compatible 16:9 y 9:16)...',
    'Despejando tercio inferior para visualizador de forma de onda...',
    'Procesando iluminación volumétrica y texturas cinematográficas...',
  ],
  data: [
    'Analizando lírica y estilo acústico del proyecto...',
    'Generando título SEO, descripción con letra completa y etiquetas de YouTube...',
    'Optimizando caption viral y hashtags para TikTok / Reels...',
  ],
};

const MODE_CONFIG = {
  production: {
    badge: 'FULL PRODUCTION SYNTHESIS',
    icon: 'auto_awesome',
    defaultTitle: 'Generando Nueva Producción con IA',
  },
  spec: {
    badge: 'NEURAL LYRICS & STYLE ENGINE',
    icon: 'lyrics',
    defaultTitle: 'Generando Letra, Estilos Suno & Metadatos',
  },
  image: {
    badge: 'VISUAL DIFFUSION ENGINE',
    icon: 'wallpaper',
    defaultTitle: 'Renderizando Arte Visual 16:9 / 9:16',
  },
  data: {
    badge: 'SOCIAL COPY COMPILER',
    icon: 'share_reviews',
    defaultTitle: 'Regenerando Metadatos Sociales (Data.txt)',
  },
};

export default function EpicLoader({
  isOpen,
  mode = 'production', // 'production' | 'spec' | 'image' | 'data'
  title,
  subtitle,
  provider = 'gemini',
  onCancel,
}) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);

  const steps = TELEMETRY_STEPS[mode] || TELEMETRY_STEPS.production;
  const config = MODE_CONFIG[mode] || MODE_CONFIG.production;

  useEffect(() => {
    if (!isOpen) {
      setElapsedMs(0);
      setStepIdx(0);
      return;
    }

    const start = Date.now();
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 100);

    const stepTimer = setInterval(() => {
      setStepIdx((prev) => (prev + 1) % steps.length);
    }, 3200);

    return () => {
      clearInterval(timer);
      clearInterval(stepTimer);
    };
  }, [isOpen, mode, steps.length]);

  if (!isOpen) return null;

  const seconds = (elapsedMs / 1000).toFixed(1);
  const eqBars = Array.from({ length: 28 });

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-surface-container-lowest/88 backdrop-blur-xl animate-fade-scale overflow-hidden select-none">
      {/* Background Tech Grid & Radial Glow */}
      <div className="absolute inset-0 bg-tech-grid opacity-50 pointer-events-none" />
      <div className="absolute w-[560px] h-[560px] rounded-full bg-primary-container/15 blur-[130px] pointer-events-none" />
      <div className="absolute w-[380px] h-[380px] rounded-full bg-tertiary-container/10 blur-[100px] pointer-events-none" />

      {/* Vertical Laser Scan Sweep */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="w-full h-32 bg-gradient-to-b from-transparent via-primary-container/10 to-transparent animate-scan-sweep" />
      </div>

      {/* Main Synthesizer HUD Card */}
      <div className="relative z-10 w-full max-w-xl mx-4 bg-surface-container-low/95 border border-primary-container/40 rounded-lg p-8 shadow-[0_0_80px_rgba(0,224,255,0.18)] overflow-hidden">
        {/* Corner HUD brackets */}
        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-primary-container" />
        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-primary-container" />
        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-primary-container" />
        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-primary-container" />

        {/* Top Telemetry Bar */}
        <div className="flex items-center justify-between border-b border-outline-variant/25 pb-3 mb-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-container animate-ping" />
            <span className="text-[10px] font-label-sm uppercase tracking-widest text-primary-fixed font-bold">
              {config.badge}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-body-sm text-on-surface-variant">
            <span className="px-2 py-0.5 rounded bg-surface-container-highest border border-outline-variant/30 text-on-surface font-semibold uppercase">
              {provider === 'anthropic' ? 'Claude + DALL-E 3' : 'Google + Imagen 3'}
            </span>
            <span className="font-mono text-primary-fixed font-bold tabular-nums">
              {seconds}s
            </span>
          </div>
        </div>

        {/* Central Orbital Reactor Core */}
        <div className="relative flex items-center justify-center my-6 h-44">
          {/* Outer Rotating Ring */}
          <div className="absolute w-44 h-44 rounded-full border border-dashed border-primary-container/40 animate-orbit-cw">
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary-container shadow-[0_0_12px_#00e0ff]" />
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-tertiary-container shadow-[0_0_10px_#fec42e]" />
          </div>

          {/* Middle Counter-Rotating Ring */}
          <div className="absolute w-32 h-32 rounded-full border-2 border-outline-variant/30 border-t-primary-container border-b-tertiary-container animate-orbit-ccw" />

          {/* Inner Pulse Ring */}
          <div className="absolute w-24 h-24 rounded-full bg-primary-container/10 border border-primary-container/50 flex items-center justify-center shadow-[0_0_30px_rgba(0,224,255,0.25)]">
            <span className="material-symbols-outlined text-primary-fixed text-4xl animate-pulse">
              {config.icon}
            </span>
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="text-center space-y-1.5 mb-5">
          <h3 className="font-headline-md font-bold text-on-surface tracking-tight">
            {title || config.defaultTitle}
          </h3>
          {subtitle && (
            <p className="text-body-sm text-on-surface-variant line-clamp-1">
              {subtitle}
            </p>
          )}
        </div>

        {/* Reactive Equalizer Visualizer Strip */}
        <div className="h-10 flex items-end justify-center gap-1 px-4 mb-5 bg-surface-container-lowest/80 rounded border border-outline-variant/20 py-2">
          {eqBars.map((_, i) => {
            const delay = `${(i % 7) * 0.12}s`;
            const duration = `${0.55 + (i % 5) * 0.14}s`;
            const isGold = i % 6 === 0;
            return (
              <div
                key={i}
                style={{
                  animationDelay: delay,
                  animationDuration: duration,
                }}
                className={`w-1.5 h-full rounded-t animate-eq-bar ${
                  isGold
                    ? 'bg-tertiary-container shadow-[0_0_8px_rgba(254,196,46,0.5)]'
                    : 'bg-primary-container shadow-[0_0_8px_rgba(0,224,255,0.5)]'
                }`}
              />
            );
          })}
        </div>

        {/* Active Step Console Log */}
        <div className="bg-surface-container-lowest border border-outline-variant/25 rounded p-3.5 flex items-center gap-3">
          <span className="material-symbols-outlined text-primary-fixed text-[18px] animate-spin">
            progress_activity
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-label-sm uppercase tracking-wider text-outline mb-0.5">
              PROCESO ACTIVO [{stepIdx + 1}/{steps.length}]
            </div>
            <div className="text-body-sm text-on-surface font-medium truncate">
              {steps[stepIdx]}
            </div>
          </div>
        </div>

        {/* Stepper dots */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {steps.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === stepIdx
                  ? 'w-8 bg-primary-container shadow-[0_0_8px_#00e0ff]'
                  : idx < stepIdx
                    ? 'w-3 bg-primary-container/50'
                    : 'w-2 bg-outline-variant/40'
              }`}
            />
          ))}
        </div>

        {/* Cancel Action Button */}
        {onCancel && (
          <div className="mt-5 pt-4 border-t border-outline-variant/25 flex justify-center">
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-2 px-5 py-2 rounded bg-error-container/20 hover:bg-error-container/40 border border-error/50 text-error text-xs font-label-sm uppercase tracking-wider font-bold transition-all cursor-pointer shadow-[0_0_15px_rgba(255,84,73,0.18)]"
            >
              <span className="material-symbols-outlined text-[16px]">cancel</span>
              Cancelar Generación
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

