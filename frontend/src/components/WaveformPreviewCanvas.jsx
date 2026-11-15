import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, RefreshCw, X, Sparkles, Check } from 'lucide-react';
import { resolveWaveformPreset } from '../constants/waveforms';

export default function WaveformPreviewCanvas({
  backgroundImageUrl,
  hasBg = false,
  waveformStyle = 'rounded_mirror',
  waveformParams = null,
  waveformCatalog = null,
  primaryColor = '#00E5FF',
  secondaryColor = '#FF2A55',
  colorMode = 'horizontal',
  paletteColors = ['#00E5FF', '#FF2A55'],
  shakeIntensity = 6,
  bgPulse = true,
  onSaveSpec,
  onOpenWaveDesigner,
  compact = false,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [bgImage, setBgImage] = useState(null);
  const [isPlayingAnim, setIsPlayingAnim] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastConfig, setLastConfig] = useState(null);
  const [needsRegeneration, setNeedsRegeneration] = useState(false);

  const animFrameRef = useRef(null);
  const renderFrameRef = useRef(null);
  const timeRef = useRef(0);
  const lastTimestampRef = useRef(null);
  const cancelGenRef = useRef(false);

  const activePreset = resolveWaveformPreset(waveformStyle, waveformParams, waveformCatalog);
  const activeParams = activePreset.params;

  // Load the background image
  useEffect(() => {
    if (!hasBg || !backgroundImageUrl) {
      setBgImage(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = backgroundImageUrl;
    img.onload = () => {
      setBgImage(img);
    };
    img.onerror = () => {
      setBgImage(null);
    };
  }, [backgroundImageUrl, hasBg]);

  // Check if current spec differs from last generated preview
  useEffect(() => {
    const currentConfigStr = JSON.stringify({
      waveformStyle,
      activeParams,
      primaryColor,
      secondaryColor,
      colorMode,
      paletteColors,
      shakeIntensity,
      bgPulse,
      hasBg,
    });

    if (lastConfig && lastConfig !== currentConfigStr) {
      setNeedsRegeneration(true);
    }
  }, [
    waveformStyle,
    activeParams,
    primaryColor,
    secondaryColor,
    colorMode,
    paletteColors,
    shakeIntensity,
    bgPulse,
    hasBg,
    lastConfig,
  ]);

  // Generation sequence
  const handleGenerate = () => {
    if (compact) return;
    cancelGenRef.current = false;
    setIsGenerating(true);
    setProgress(0);

    const startTime = Date.now();
    const duration = 500;

    const interval = setInterval(() => {
      if (cancelGenRef.current) {
        clearInterval(interval);
        setIsGenerating(false);
        setProgress(0);
        return;
      }

      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      if (pct >= 100) {
        clearInterval(interval);
        setIsGenerating(false);
        setNeedsRegeneration(false);
        setLastConfig(
          JSON.stringify({
            waveformStyle,
            activeParams,
            primaryColor,
            secondaryColor,
            colorMode,
            paletteColors,
            shakeIntensity,
            bgPulse,
            hasBg,
          })
        );
      }
    }, 40);
  };

  const handleCancel = () => {
    cancelGenRef.current = true;
    setIsGenerating(false);
    setProgress(0);
  };

  // Initial auto-generation on mount
  useEffect(() => {
    if (!compact) {
      handleGenerate();
    }
    return () => {
      cancelGenRef.current = true;
    };
  }, [compact]);

  // Main canvas render loop (synchronized 1:1 with video/renderer.py)
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const t = timeRef.current;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Background
    let shakeX = 0;
    let shakeY = 0;
    if (shakeIntensity > 0 && isPlayingAnim) {
      shakeX = Math.sin(t * 14) * (shakeIntensity * 0.4);
      shakeY = Math.cos(t * 11) * (shakeIntensity * 0.3);
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    if (bgImage && bgImage.complete && bgImage.naturalWidth > 0) {
      const hRatio = width / bgImage.width;
      const vRatio = height / bgImage.height;
      const ratio = Math.max(hRatio, vRatio);
      const centerShiftX = (width - bgImage.width * ratio) / 2;
      const centerShiftY = (height - bgImage.height * ratio) / 2;
      ctx.drawImage(
        bgImage,
        0,
        0,
        bgImage.width,
        bgImage.height,
        centerShiftX,
        centerShiftY,
        bgImage.width * ratio,
        bgImage.height * ratio
      );
    } else {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#070a14');
      grad.addColorStop(0.5, '#0d1326');
      grad.addColorStop(1, '#05070e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const radial1 = ctx.createRadialGradient(
        width * 0.3,
        height * 0.4,
        10,
        width * 0.3,
        height * 0.4,
        300
      );
      radial1.addColorStop(0, primaryColor + '25');
      radial1.addColorStop(1, 'transparent');
      ctx.fillStyle = radial1;
      ctx.fillRect(0, 0, width, height);

      const radial2 = ctx.createRadialGradient(
        width * 0.7,
        height * 0.6,
        10,
        width * 0.7,
        height * 0.6,
        350
      );
      radial2.addColorStop(0, secondaryColor + '20');
      radial2.addColorStop(1, 'transparent');
      ctx.fillStyle = radial2;
      ctx.fillRect(0, 0, width, height);
    }

    // Vignette overlay (also applied 1:1 in video/renderer.py)
    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      width * 0.25,
      width / 2,
      height / 2,
      width * 0.7
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    // Beat pulse flash if enabled
    if (bgPulse && isPlayingAnim) {
      const pulseVal = Math.max(0, Math.sin(t * 8)) ** 4 * 0.08;
      ctx.fillStyle = `rgba(255, 255, 255, ${pulseVal})`;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();

    // 2. Parametric Waveform Drawing (1:1 parity with video/renderer.py)
    const engine = activeParams.engine || waveformStyle;
    if (engine !== 'none' && waveformStyle !== 'none') {
      const nBars = Math.max(12, Math.min(128, Number(activeParams.bar_count) || 48));
      const rawAmplitudes = [];

      for (let i = 0; i < nBars; i++) {
        const norm = i / nBars;
        const bassBoost = Math.exp(-norm * 2.8) * 0.65;
        const midEnergy = Math.sin(norm * Math.PI) * 0.35;
        const harmonic = Math.sin(t * 4 + i * 0.35) * 0.18 + Math.cos(t * 6 + i * 0.2) * 0.12;
        const beatPunch = Math.max(0, Math.sin(t * 4.5)) ** 3 * (i < Math.floor(nBars * 0.25) ? 0.4 : 0.1);

        let amp = bassBoost + midEnergy + harmonic + beatPunch + 0.08;
        if (!isPlayingAnim) {
          amp = bassBoost + midEnergy + 0.15;
        }
        rawAmplitudes.push(Math.min(1.0, Math.max(0.04, amp)));
      }

      // Symmetry reordering matching _reorder_center_symmetry in video/renderer.py
      let displayAmps = rawAmplitudes;
      const symmetry =
        activeParams.symmetry ||
        (engine === 'center_symmetrical' || waveformStyle === 'mirrored_bars' ? 'center' : 'none');

      if (symmetry === 'center') {
        const half = Math.floor(nBars / 2);
        const reordered = [];
        for (let i = 0; i < half; i++) reordered.push(rawAmplitudes[half - 1 - i]);
        for (let i = 0; i < half; i++) reordered.push(rawAmplitudes[i]);
        while (reordered.length < nBars) {
          reordered.push(rawAmplitudes[reordered.length - 1] || 0.05);
        }
        displayAmps = reordered;
      }

      // Prepare gradient matching _build_gradient_map in video/renderer.py
      const effectiveColorMode =
        colorMode === 'auto' ? activeParams.default_color_mode || 'horizontal' : colorMode;

      let wfGradient;
      if (effectiveColorMode === 'vertical') {
        wfGradient = ctx.createLinearGradient(0, height, 0, height * 0.45);
        wfGradient.addColorStop(0, primaryColor);
        wfGradient.addColorStop(1, secondaryColor);
      } else {
        wfGradient = ctx.createLinearGradient(width * 0.1, 0, width * 0.9, 0);
        if (paletteColors && paletteColors.length > 2) {
          paletteColors.forEach((c, idx) => {
            wfGradient.addColorStop(idx / (paletteColors.length - 1), c);
          });
        } else {
          wfGradient.addColorStop(0, primaryColor);
          wfGradient.addColorStop(1, secondaryColor);
        }
      }

      ctx.save();
      drawStandardizedWaveform(
        ctx,
        width,
        height,
        displayAmps,
        activeParams,
        wfGradient,
        primaryColor,
        secondaryColor,
        paletteColors,
        t
      );
      ctx.restore();
    }

    if (isPlayingAnim) {
      const now = performance.now();
      const dt = lastTimestampRef.current ? Math.min(0.05, (now - lastTimestampRef.current) / 1000) : 1 / 60;
      lastTimestampRef.current = now;
      timeRef.current += dt;
      animFrameRef.current = requestAnimationFrame(() => {
        if (renderFrameRef.current) renderFrameRef.current();
      });
    } else {
      lastTimestampRef.current = null;
    }
  }, [
    bgImage,
    waveformStyle,
    activeParams,
    primaryColor,
    secondaryColor,
    colorMode,
    paletteColors,
    shakeIntensity,
    bgPulse,
    isPlayingAnim,
  ]);

  useEffect(() => {
    renderFrameRef.current = renderFrame;
  }, [renderFrame]);

  // Start / stop loop
  useEffect(() => {
    if (isPlayingAnim) {
      lastTimestampRef.current = performance.now();
      animFrameRef.current = requestAnimationFrame(() => {
        if (renderFrameRef.current) renderFrameRef.current();
      });
    } else {
      renderFrame();
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlayingAnim, renderFrame]);

  return (
    <div className="flex flex-col justify-between h-full relative" ref={containerRef}>
      {/* 16:9 Aspect Ratio Canvas Viewport */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-black/80 border border-white/10 shadow-[0_12px_28px_rgba(0,0,0,0.35)] flex items-center justify-center group select-none">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="w-full h-full object-cover transition-opacity duration-300"
        />

        {/* Tech Corner Brackets */}
        <div className="absolute top-2.5 left-2.5 text-[#00e0ff] font-mono text-sm opacity-60 pointer-events-none">
          ⌜
        </div>
        <div className="absolute top-2.5 right-2.5 text-[#00e0ff] font-mono text-sm opacity-60 pointer-events-none">
          ⌝
        </div>
        <div className="absolute bottom-2.5 left-2.5 text-[#00e0ff] font-mono text-sm opacity-60 pointer-events-none">
          ⌞
        </div>
        <div className="absolute bottom-2.5 right-2.5 text-[#00e0ff] font-mono text-sm opacity-60 pointer-events-none">
          ⌟
        </div>

        {/* Badges on preview */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md border border-white/15 text-[10px] font-label-sm text-white font-bold tracking-wider uppercase flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: primaryColor }}
            />
            PREVIEW 1:1 // {activePreset.name || waveformStyle.toUpperCase()}
          </span>

          {!compact && needsRegeneration && !isGenerating && (
            <span className="px-2 py-0.5 rounded bg-amber-400/90 text-black text-[10px] font-bold tracking-wider uppercase shadow animate-pulse">
              Cambios pendientes
            </span>
          )}
        </div>

        {/* Play/Pause Animation Toggle */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlayingAnim(!isPlayingAnim)}
            className="px-2.5 py-1 rounded-md bg-black/75 hover:bg-black/90 backdrop-blur-md border border-white/15 text-[10px] font-bold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition-all"
            title={isPlayingAnim ? 'Pausar animación' : 'Reproducir animación'}
          >
            {isPlayingAnim ? (
              <>
                <Pause className="w-3 h-3 text-[#00e0ff]" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-emerald-400 fill-current" />
                <span>Animar</span>
              </>
            )}
          </button>
        </div>

        {/* ── LOCALIZED LOADING SCREEN ONLY OVER PREVIEW ── */}
        {!compact && isGenerating && (
          <div className="absolute inset-0 z-30 bg-[#070b16]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-scale">
            <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: primaryColor, borderTopColor: 'transparent' }}
              />
              <div
                className="absolute inset-2 rounded-full border border-dashed border-b-transparent animate-spin-slow opacity-60"
                style={{ borderColor: secondaryColor }}
              />
              <Sparkles className="w-6 h-6 text-[#00e0ff] animate-pulse" />
            </div>

            <div className="text-center max-w-xs mb-4">
              <h4 className="font-headline-sm font-bold text-sm text-white uppercase tracking-wider mb-1">
                Sincronizando Preview 1:1
              </h4>
              <p className="text-[11px] font-label-sm text-slate-400">
                MOTOR // {activePreset.name} ({activeParams.bar_count} BANDAS)
              </p>
            </div>

            <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden mb-4 relative">
              <div
                className="h-full rounded-full transition-all duration-75 ease-out shadow-sm"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
                }}
              />
            </div>

            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 hover:text-white text-xs font-bold tracking-wide transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancelar</span>
            </button>
          </div>
        )}
      </div>

      {/* Action Footer Bar */}
      {!compact && (
        <div className="mt-3 pt-3 border-t border-outline-variant/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`px-4 py-2 rounded-xl font-headline-sm font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 ${
                needsRegeneration
                  ? 'bg-primary-container text-on-primary-fixed shadow-md scale-[1.02]'
                  : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/40'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'Calculando...' : 'Refrescar Preview'}</span>
            </button>

            {onOpenWaveDesigner && (
              <button
                type="button"
                onClick={onOpenWaveDesigner}
                className="px-3.5 py-2 rounded-xl bg-primary-container/15 hover:bg-primary-container text-primary-fixed hover:text-on-primary-fixed border border-primary-container/40 font-headline-sm font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">tune</span>
                <span>Personalizar Onda</span>
              </button>
            )}

            {onSaveSpec && (
              <button
                type="button"
                onClick={onSaveSpec}
                className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-on-surface-variant hover:text-on-surface font-headline-sm font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 text-primary-fixed" />
                <span>Guardar Specs</span>
              </button>
            )}
          </div>

          <div className="text-right">
            <span className="text-[10px] font-label-sm text-on-surface-variant block">
              PARIDAD 1:1 CON VIDEO // {activeParams.bar_count} BANDAS
            </span>
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block border border-black/20"
                style={{ backgroundColor: primaryColor }}
                title={`Primario: ${primaryColor}`}
              />
              <span
                className="w-2.5 h-2.5 rounded-full inline-block border border-black/20"
                style={{ backgroundColor: secondaryColor }}
                title={`Secundario: ${secondaryColor}`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── STANDARDIZED PARAMETRIC WAVEFORM RENDERER (1:1 WITH video/renderer.py) ──

function drawStandardizedWaveform(ctx, w, h, displayAmps, params, gradient, c1, c2, paletteColors, t) {
  const scale = h / 720.0;
  const n = displayAmps.length;
  const engine = params.engine || 'rounded_mirror';

  const baseY = Math.round(h * (Number(params.base_y_ratio) || 0.82));
  const maxBarH = h * (Number(params.max_height_ratio) || 0.26);
  const gapDiv = Math.max(1.5, Number(params.gap_divisor) || 5.0);
  const roundness = Number(params.roundness ?? 4.0);
  const refEnabled = Boolean(params.reflection_enabled);
  const refScale = Number(params.reflection_scale ?? 0.55);
  const refOpacity = Number(params.reflection_opacity ?? 0.28);
  const refGap = Math.round((Number(params.reflection_gap ?? 6.0)) * scale);
  const glowBlur = (Number(params.glow_blur ?? 8.0)) * scale;

  // 1. Engine: flowing_ribbons
  if (engine === 'flowing_ribbons') {
    const ribbonCount = Math.max(1, Number(params.ribbon_count) || 4);
    const waveSpeed = Number(params.wave_speed) || 1.2;
    const fillOpacity = Number(params.fill_opacity ?? 0.082);
    const lineWidth = (Number(params.line_width) || 2.5) * scale;
    const stepX = Math.max(2, Math.round(15 * (w / 1280.0)));

    const colors = [];
    for (let r = 0; r < ribbonCount; r++) {
      if (paletteColors && paletteColors.length >= ribbonCount) {
        colors.push(paletteColors[r]);
      } else {
        colors.push(r % 2 === 0 ? c1 : c2);
      }
    }

    const alphaHex = Math.round(Math.max(0, Math.min(1, fillOpacity)) * 255)
      .toString(16)
      .padStart(2, '0');

    for (let ribbon = 0; ribbon < ribbonCount; ribbon++) {
      const phaseOffset = ribbon * 1.5;
      const speed = waveSpeed + ribbon * 0.35;
      const ribbonAmp = maxBarH / (ribbon * 0.3 + 1.0);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, baseY);

      for (let x = 0; x <= w; x += stepX) {
        const curX = Math.min(x, w);
        const idx = Math.min(n - 1, Math.floor((curX / w) * n));
        const energy = displayAmps[idx];
        const y =
          baseY +
          Math.sin((curX / w) * 8.0 + t * speed + phaseOffset) * ribbonAmp * energy +
          Math.cos((curX / w) * 14.0 + t * 2.0) * (ribbonAmp * 0.25);
        ctx.lineTo(curX, y);
      }

      if (fillOpacity > 0.005) {
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = colors[ribbon] + alphaHex;
        ctx.fill();
      }

      ctx.strokeStyle = colors[ribbon];
      ctx.lineWidth = lineWidth;
      if (glowBlur > 0) {
        ctx.shadowColor = colors[ribbon];
        ctx.shadowBlur = glowBlur;
      }
      ctx.stroke();
      ctx.restore();
    }
    return;
  }

  // 2. Engine: particle_waves
  if (engine === 'particle_waves') {
    const cols = Math.max(8, Number(params.grid_cols) || 28);
    const rows = Math.max(4, Number(params.grid_rows) || 12);
    const waveSpeed = Number(params.wave_speed) || 3.0;
    const maxHRatio = Number(params.max_height_ratio) || 0.18;
    const waveAmp = (maxHRatio / 0.18) * 45.0 * scale;
    const rowStep = 14.0 * scale;

    for (let r = 0; r < rows; r++) {
      const depth = r / rows;
      const yPos = baseY + r * rowStep;
      const alpha = 0.2 + depth * 0.7;

      for (let c = 0; c < cols; c++) {
        const xPos = (c / Math.max(1, cols - 1)) * (w * 0.9) + w * 0.05;
        const ampIdx = Math.min(n - 1, Math.floor((c / cols) * n));
        const amp = displayAmps[ampIdx] || 0.1;

        const wave = Math.sin(c * 0.5 + t * waveSpeed + r * 0.4) * (amp * waveAmp);
        const radius = Math.max(1.5, (1.8 + depth * 3.5) * (amp * 1.2)) * scale;

        ctx.save();
        ctx.beginPath();
        ctx.arc(xPos, yPos - wave, radius, 0, Math.PI * 2);
        ctx.fillStyle = depth > 0.5 ? c1 : c2;
        ctx.globalAlpha = alpha;
        if (glowBlur > 0) {
          ctx.shadowColor = c1;
          ctx.shadowBlur = glowBlur;
        }
        ctx.fill();
        ctx.restore();
      }
    }
    return;
  }

  // 3. Engine: sharp_spikes
  if (engine === 'sharp_spikes') {
    const totalBarW = w / n;
    ctx.fillStyle = gradient;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = Math.max(1, scale);

    for (let i = 0; i < n; i++) {
      const x = i * totalBarW;
      const barH = Math.max(6 * scale, displayAmps[i] * maxBarH);

      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + totalBarW / 2, baseY - barH);
      ctx.lineTo(x + totalBarW, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (refEnabled) {
        ctx.save();
        ctx.globalAlpha = refOpacity;
        ctx.beginPath();
        ctx.moveTo(x, baseY + refGap);
        ctx.lineTo(x + totalBarW / 2, baseY + refGap + barH * refScale);
        ctx.lineTo(x + totalBarW, baseY + refGap);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    return;
  }

  // 4. Engine: dot_matrix
  if (engine === 'dot_matrix') {
    const cols = n;
    const rows = Math.max(4, Number(params.grid_rows) || 14);
    const dotSpacing = w / cols;
    const dotRadius = Math.max(2 * scale, dotSpacing * 0.32);
    const stepY = dotRadius * 2 + 4 * scale;

    for (let i = 0; i < cols; i++) {
      const x = i * dotSpacing + dotSpacing / 2;
      const activeRows = Math.floor(displayAmps[i] * rows);

      for (let r = 0; r < rows; r++) {
        const y = baseY - r * stepY;
        const isActive = r <= activeRows;

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);

        if (isActive) {
          ctx.fillStyle = r > rows * 0.6 ? c2 : c1;
          if (glowBlur > 0) {
            ctx.shadowColor = c1;
            ctx.shadowBlur = glowBlur;
          }
          ctx.globalAlpha = 0.95;
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.globalAlpha = 0.5;
        }
        ctx.fill();
        ctx.restore();
      }

      if (refEnabled) {
        const refRows = Math.min(activeRows + 1, 4);
        for (let r = 0; r < refRows; r++) {
          const yRef = baseY + refGap + (r + 1) * stepY;
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, yRef, dotRadius, 0, Math.PI * 2);
          ctx.fillStyle = c1;
          ctx.globalAlpha = refOpacity * (1.0 - r / 5.0);
          ctx.fill();
          ctx.restore();
        }
      }
    }
    return;
  }

  // 5. Engine: neon_ladder
  if (engine === 'neon_ladder') {
    const cols = Math.max(8, Math.floor(n * 0.75));
    const rBlocks = Math.max(4, Number(params.grid_rows) || 12);
    const blockW = Math.max(3 * scale, (w / cols) * 0.7);
    const blockH = Math.max(2, 4 * scale);
    const gapY = Math.max(1, 3 * scale);
    const radius = Math.max(1, roundness * scale);

    ctx.fillStyle = gradient;

    for (let i = 0; i < cols; i++) {
      const x = i * (w / cols) + 4 * scale;
      const activeBlocks = Math.floor(displayAmps[Math.min(i, n - 1)] * rBlocks);

      for (let b = 0; b < activeBlocks; b++) {
        const y = baseY - b * (blockH + gapY);
        drawRoundRect(ctx, x, y, blockW, blockH, radius);

        if (refEnabled && b < 4) {
          ctx.save();
          ctx.globalAlpha = refOpacity;
          drawRoundRect(ctx, x, baseY + refGap + b * (blockH + gapY), blockW, blockH, radius);
          ctx.restore();
        }
      }
    }
    return;
  }

  // 6. Engine: center_symmetrical
  if (engine === 'center_symmetrical') {
    const gap = Math.max(2 * scale, Math.floor(w / (n * gapDiv)));
    const totalBarW = Math.floor(w / n);
    const barW = Math.max(2 * scale, totalBarW - gap);
    const radius = Math.min(barW / 2, roundness * scale);

    ctx.fillStyle = gradient;

    for (let i = 0; i < n; i++) {
      const x = i * totalBarW + gap / 2;
      const barH = Math.max(4 * scale, displayAmps[i] * maxBarH);
      drawRoundRect(ctx, x, baseY - barH, barW, barH * 2, radius);

      if (refEnabled) {
        ctx.save();
        ctx.globalAlpha = refOpacity;
        drawRoundRect(ctx, x, baseY + barH + refGap, barW, barH * refScale, radius);
        ctx.restore();
      }
    }
    return;
  }

  // 7. Engine: rounded_mirror & bars (mirrored_bars / frequency_bars)
  const minGap = engine === 'rounded_mirror' ? 3 * scale : 2 * scale;
  const gap = Math.max(minGap, Math.floor(w / (n * gapDiv)));
  const totalBarW = Math.floor(w / n);
  const barW = Math.max(2 * scale, totalBarW - gap);
  const radius = Math.min(barW / 2, roundness * scale);

  ctx.fillStyle = gradient;
  if (engine === 'rounded_mirror' && glowBlur > 0) {
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = glowBlur;
  }

  for (let i = 0; i < n; i++) {
    const x = i * totalBarW + gap / 2;
    const barH = Math.max(4 * scale, displayAmps[i] * maxBarH);

    drawRoundRect(ctx, x, baseY - barH, barW, barH, radius);

    if (refEnabled) {
      const reflectH = barH * refScale;
      ctx.save();
      ctx.globalAlpha = refOpacity;
      drawRoundRect(ctx, x, baseY + refGap, barW, reflectH, radius);
      ctx.restore();
    }
  }
}

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.fill();
}
