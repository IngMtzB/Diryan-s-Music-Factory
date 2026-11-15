import React, { useState, useEffect } from 'react';
import {
  WAVE_ENGINES,
  DEFAULT_WAVEFORM_PRESETS,
  resolveWaveformPreset,
} from '../constants/waveforms';
import WaveformPreviewCanvas from './WaveformPreviewCanvas';

export default function WaveDesignerModal({
  isOpen,
  onClose,
  waveformPresets = DEFAULT_WAVEFORM_PRESETS,
  selectedStyleId = 'rounded_mirror',
  onSelectStyle,
  onSavePresets,
  onResetFactoryPresets,
  backgroundImageUrl = null,
  hasBg = false,
  primaryColor = '#00E5FF',
  secondaryColor = '#FF2A55',
  colorMode = 'horizontal',
  paletteColors = ['#00E5FF', '#FF2A55'],
}) {
  const [presets, setPresets] = useState(
    waveformPresets?.length ? waveformPresets : DEFAULT_WAVEFORM_PRESETS
  );
  const [activeId, setActiveId] = useState(selectedStyleId || 'rounded_mirror');
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    const list = waveformPresets?.length ? waveformPresets : DEFAULT_WAVEFORM_PRESETS;
    setPresets(list);
  }, [waveformPresets]);

  useEffect(() => {
    if (isOpen) {
      const targetId = selectedStyleId || presets[0]?.id || 'rounded_mirror';
      setActiveId(targetId);
      const resolved = resolveWaveformPreset(targetId, null, presets);
      setDraft(JSON.parse(JSON.stringify(resolved)));
      setStatusMsg('');
    }
  }, [isOpen, selectedStyleId]);

  if (!isOpen || !draft) return null;

  const handleSelectPresetFromList = (presetId) => {
    setActiveId(presetId);
    const resolved = resolveWaveformPreset(presetId, null, presets);
    setDraft(JSON.parse(JSON.stringify(resolved)));
    setStatusMsg('');
  };

  const updateDraftField = (field, value) => {
    setDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateParam = (key, value) => {
    setDraft((prev) => ({
      ...prev,
      ...(key === 'engine' ? { engine: value } : {}),
      params: {
        ...(prev.params || {}),
        [key]: value,
      },
    }));
  };

  // Switch engine and load sensible defaults for that engine while keeping user's name/id
  const handleSelectEngine = (engineId) => {
    const template =
      DEFAULT_WAVEFORM_PRESETS.find((p) => p.engine === engineId || p.id === engineId) ||
      DEFAULT_WAVEFORM_PRESETS[0];
    setDraft((prev) => ({
      ...prev,
      engine: engineId,
      params: {
        ...template.params,
        engine: engineId,
      },
    }));
  };

  // Create a brand new wave preset
  const handleCreateNewWave = async () => {
    const newId = `custom_wave_${Date.now()}`;
    const baseTemplate = resolveWaveformPreset(activeId, null, presets);
    const newPreset = {
      id: newId,
      name: `MI ONDA PERSONALIZADA ${presets.filter((p) => !p.isBuiltin).length + 1}`,
      desc: 'Onda personalizada sincronizada 1:1 con render de video',
      engine: baseTemplate.engine || 'rounded_mirror',
      isBuiltin: false,
      params: {
        ...baseTemplate.params,
      },
    };

    const nextPresets = [newPreset, ...presets];
    setPresets(nextPresets);
    setActiveId(newId);
    setDraft(JSON.parse(JSON.stringify(newPreset)));

    setSaving(true);
    try {
      if (onSavePresets) await onSavePresets(nextPresets);
      if (onSelectStyle) onSelectStyle(newId, newPreset.params);
      setStatusMsg('✨ Nueva onda creada. Ajusta los controles y guarda tus cambios.');
    } finally {
      setSaving(false);
    }
  };

  // Duplicate current wave
  const handleDuplicateCurrent = async () => {
    const newId = `wave_copy_${Date.now()}`;
    const cloned = {
      ...JSON.parse(JSON.stringify(draft)),
      id: newId,
      name: `${draft.name} (COPIA)`,
      isBuiltin: false,
    };
    const nextPresets = [cloned, ...presets];
    setPresets(nextPresets);
    setActiveId(newId);
    setDraft(cloned);

    setSaving(true);
    try {
      if (onSavePresets) await onSavePresets(nextPresets);
      if (onSelectStyle) onSelectStyle(newId, cloned.params);
      setStatusMsg('📋 Onda duplicada correctamente.');
    } finally {
      setSaving(false);
    }
  };

  // Save changes to current wave
  const handleSaveCurrentWave = async () => {
    if (!draft.name.trim()) return;
    const cleanDraft = {
      ...draft,
      name: draft.name.trim(),
      desc: draft.desc?.trim() || 'Onda personalizada 1:1',
      engine: draft.params?.engine || draft.engine || 'rounded_mirror',
    };

    const exists = presets.some((p) => p.id === cleanDraft.id);
    const nextPresets = exists
      ? presets.map((p) => (p.id === cleanDraft.id ? cleanDraft : p))
      : [cleanDraft, ...presets];

    setPresets(nextPresets);
    setDraft(cleanDraft);

    setSaving(true);
    try {
      if (onSavePresets) await onSavePresets(nextPresets);
      if (onSelectStyle) onSelectStyle(cleanDraft.id, cleanDraft.params);
      setStatusMsg('✔ Onda guardada y sincronizada con el motor de video.');
    } finally {
      setSaving(false);
    }
  };

  // Delete wave preset
  const handleDeleteWave = async (targetId) => {
    if (presets.length <= 1) return;
    const nextPresets = presets.filter((p) => p.id !== targetId);
    setPresets(nextPresets);

    const nextActive = nextPresets[0];
    setActiveId(nextActive.id);
    setDraft(JSON.parse(JSON.stringify(resolveWaveformPreset(nextActive.id, null, nextPresets))));

    setSaving(true);
    try {
      if (onSavePresets) await onSavePresets(nextPresets);
      if (onSelectStyle) onSelectStyle(nextActive.id, nextActive.params);
      setStatusMsg('🗑️ Onda eliminada del catálogo.');
    } finally {
      setSaving(false);
    }
  };

  // Restore factory presets
  const handleResetFactory = async () => {
    setSaving(true);
    try {
      let nextList = DEFAULT_WAVEFORM_PRESETS;
      if (onResetFactoryPresets) {
        const res = await onResetFactoryPresets();
        if (res?.waveform_presets) nextList = res.waveform_presets;
      } else if (onSavePresets) {
        await onSavePresets(DEFAULT_WAVEFORM_PRESETS);
      }
      setPresets(nextList);
      setActiveId(nextList[0].id);
      setDraft(JSON.parse(JSON.stringify(nextList[0])));
      if (onSelectStyle) onSelectStyle(nextList[0].id, nextList[0].params);
      setStatusMsg('🔄 Se restauraron las 10 ondas originales de fábrica.');
    } finally {
      setSaving(false);
    }
  };

  const p = draft.params || {};
  const engine = p.engine || draft.engine || 'rounded_mirror';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-scale">
      <div className="w-full max-w-6xl max-h-[92vh] rounded-2xl bg-surface-container-low border border-outline-variant/40 shadow-[0_25px_70px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden">
        {/* ── Modal Header ── */}
        <div className="px-6 py-4 bg-surface-container border-b border-outline-variant/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container/15 border border-primary-container/40 flex items-center justify-center text-primary-fixed">
              <span className="material-symbols-outlined text-[22px]">equalizer</span>
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface uppercase tracking-wide font-bold">
                Laboratorio & Gestor de Formas de Onda (1:1 Video Sync)
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Crea, modifica o elimina ondas visuales. Lo que ves en el lienzo se renderiza exactamente igual en el video MP4.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreateNewWave}
              disabled={saving}
              className="px-3.5 py-2 rounded-lg bg-primary-container text-on-primary-fixed font-headline-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm hover:brightness-105 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              <span>+ Nueva Onda</span>
            </button>

            <button
              type="button"
              onClick={handleDuplicateCurrent}
              disabled={saving}
              className="px-3 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/40 font-label-sm text-xs uppercase flex items-center gap-1 cursor-pointer"
              title="Duplicar la onda seleccionada para crear una variante"
            >
              <span className="material-symbols-outlined text-[15px]">content_copy</span>
              <span>Duplicar</span>
            </button>

            <button
              type="button"
              onClick={handleResetFactory}
              disabled={saving}
              className="px-3 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface border border-outline-variant/40 font-label-sm text-xs uppercase flex items-center gap-1 cursor-pointer"
              title="Restaurar las 10 ondas predeterminadas de fábrica"
            >
              <span className="material-symbols-outlined text-[15px]">restart_alt</span>
              <span className="hidden sm:inline">Restaurar Fábrica</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-surface-container-high hover:bg-error-container text-on-surface hover:text-on-error-container flex items-center justify-center transition-colors cursor-pointer"
              title="Cerrar"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* ── Main Body: Left Catalog List | Center Controls | Right Live Preview ── */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-outline-variant/25">
          {/* 1. Left Column: Wave Presets List (3 Cols) */}
          <div className="lg:col-span-3 p-4 space-y-2 overflow-y-auto max-h-[72vh] bg-surface-container-lowest/50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-label-sm text-[11px] uppercase tracking-wider text-outline font-bold">
                CATÁLOGO DE ONDAS ({presets.length})
              </span>
            </div>

            {presets.map((item) => {
              const isSelected = item.id === activeId;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectPresetFromList(item.id)}
                  className={`p-3 rounded-xl cursor-pointer transition-all border flex items-start justify-between gap-2 ${
                    isSelected
                      ? 'bg-primary-container/15 border-primary-container shadow-sm'
                      : 'bg-surface-container hover:bg-surface-container-high border-outline-variant/25'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isSelected ? 'bg-primary-container' : 'bg-outline'
                        }`}
                      />
                      <span
                        className={`font-headline-sm text-xs uppercase truncate block ${
                          isSelected ? 'text-primary-fixed font-bold' : 'text-on-surface font-semibold'
                        }`}
                      >
                        {item.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant line-clamp-1 mt-0.5 pl-3.5">
                      {item.desc}
                    </p>
                  </div>

                  {presets.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteWave(item.id);
                      }}
                      className="text-outline hover:text-error p-1 rounded hover:bg-error-container/30 transition-colors shrink-0 cursor-pointer"
                      title="Eliminar esta onda"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* 2. Center Column: Parametric Visual Sliders (5 Cols) */}
          <div className="lg:col-span-5 p-5 space-y-5 overflow-y-auto max-h-[72vh]">
            {/* Name & Description */}
            <div className="space-y-3 bg-surface-container p-4 rounded-xl border border-outline-variant/30">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-[11px] uppercase tracking-wider text-primary-fixed font-bold">
                  1. Identidad de la Onda
                </span>
                <span className="text-[10px] font-mono text-outline">ID: {draft.id}</span>
              </div>

              <div>
                <label className="block font-label-sm text-[11px] text-on-surface-variant uppercase mb-1">
                  Nombre de la Onda
                </label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => updateDraftField('name', e.target.value)}
                  placeholder="Ej. ELECTRO TUMBADO NEON WAVE"
                  className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary-container"
                />
              </div>

              <div>
                <label className="block font-label-sm text-[11px] text-on-surface-variant uppercase mb-1">
                  Descripción Corta
                </label>
                <input
                  type="text"
                  value={draft.desc || ''}
                  onChange={(e) => updateDraftField('desc', e.target.value)}
                  placeholder="Describe el estilo visual..."
                  className="w-full px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:border-primary-container"
                />
              </div>
            </div>

            {/* Visual Engine Selector */}
            <div className="space-y-2.5 bg-surface-container p-4 rounded-xl border border-outline-variant/30">
              <span className="font-label-sm text-[11px] uppercase tracking-wider text-primary-fixed font-bold block">
                2. Arquitectura / Motor Geométrico Base
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {WAVE_ENGINES.map((eng) => {
                  const active = engine === eng.id;
                  return (
                    <button
                      key={eng.id}
                      type="button"
                      onClick={() => handleSelectEngine(eng.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                        active
                          ? 'bg-primary-container text-on-primary-fixed border-primary-container font-bold shadow-sm'
                          : 'bg-surface-container-lowest hover:bg-surface-container-high text-on-surface border-outline-variant/30'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">{eng.icon}</span>
                        <span className="text-[11px] font-headline-sm uppercase truncate">
                          {eng.shortLabel}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Position & Size Sliders */}
            {engine !== 'none' && (
              <div className="space-y-4 bg-surface-container p-4 rounded-xl border border-outline-variant/30">
                <span className="font-label-sm text-[11px] uppercase tracking-wider text-primary-fixed font-bold block">
                  3. Posición, Altura y Simetría
                </span>

                {/* Symmetry & Default Gradient */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-label-sm text-on-surface-variant uppercase mb-1">
                      Distribución de Frecuencias
                    </label>
                    <div className="grid grid-cols-2 gap-1 bg-surface-container-lowest p-1 rounded-lg border border-outline-variant/30">
                      <button
                        type="button"
                        onClick={() => updateParam('symmetry', 'none')}
                        className={`py-1 px-2 rounded text-[11px] font-semibold cursor-pointer ${
                          p.symmetry !== 'center'
                            ? 'bg-primary-container text-on-primary-fixed font-bold'
                            : 'text-on-surface-variant'
                        }`}
                      >
                        Lineal (I→D)
                      </button>
                      <button
                        type="button"
                        onClick={() => updateParam('symmetry', 'center')}
                        className={`py-1 px-2 rounded text-[11px] font-semibold cursor-pointer ${
                          p.symmetry === 'center'
                            ? 'bg-primary-container text-on-primary-fixed font-bold'
                            : 'text-on-surface-variant'
                        }`}
                      >
                        Espejo Central
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-label-sm text-on-surface-variant uppercase mb-1">
                      Dirección de Color
                    </label>
                    <div className="grid grid-cols-2 gap-1 bg-surface-container-lowest p-1 rounded-lg border border-outline-variant/30">
                      <button
                        type="button"
                        onClick={() => updateParam('default_color_mode', 'horizontal')}
                        className={`py-1 px-2 rounded text-[11px] font-semibold cursor-pointer ${
                          p.default_color_mode !== 'vertical'
                            ? 'bg-primary-container text-on-primary-fixed font-bold'
                            : 'text-on-surface-variant'
                        }`}
                      >
                        Horizontal
                      </button>
                      <button
                        type="button"
                        onClick={() => updateParam('default_color_mode', 'vertical')}
                        className={`py-1 px-2 rounded text-[11px] font-semibold cursor-pointer ${
                          p.default_color_mode === 'vertical'
                            ? 'bg-primary-container text-on-primary-fixed font-bold'
                            : 'text-on-surface-variant'
                        }`}
                      >
                        Vertical
                      </button>
                    </div>
                  </div>
                </div>

                {/* Vertical Position Slider */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-on-surface-variant font-medium">
                      Posición Vertical (Altura Base Y)
                    </span>
                    <span className="font-mono text-primary-fixed font-bold">
                      {Math.round((Number(p.base_y_ratio) || 0.82) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.45"
                    max="0.93"
                    step="0.01"
                    value={Number(p.base_y_ratio) || 0.82}
                    onChange={(e) => updateParam('base_y_ratio', parseFloat(e.target.value))}
                    className="w-full accent-[#00e0ff] cursor-pointer"
                  />
                  <div className="flex justify-between gap-1 mt-1">
                    {[
                      { label: 'Centro (58%)', val: 0.58 },
                      { label: 'Medio (68%)', val: 0.68 },
                      { label: 'Estándar (82%)', val: 0.8194 },
                      { label: 'Inferior (90%)', val: 0.9028 },
                    ].map((pos) => (
                      <button
                        key={pos.label}
                        type="button"
                        onClick={() => updateParam('base_y_ratio', pos.val)}
                        className="px-2 py-0.5 rounded bg-surface-container-highest/70 hover:bg-primary-container/20 text-[10px] text-on-surface-variant hover:text-primary-fixed cursor-pointer"
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max Amplitude Height Slider */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-on-surface-variant font-medium">
                      Tamaño / Altura Máxima de Onda
                    </span>
                    <span className="font-mono text-primary-fixed font-bold">
                      {Math.round((Number(p.max_height_ratio) || 0.26) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.08"
                    max="0.42"
                    step="0.01"
                    value={Number(p.max_height_ratio) || 0.26}
                    onChange={(e) => updateParam('max_height_ratio', parseFloat(e.target.value))}
                    className="w-full accent-[#00e0ff] cursor-pointer"
                  />
                </div>

                {/* Frequency Bar Count */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-on-surface-variant font-medium">
                      Densidad de Frecuencias (Bandas)
                    </span>
                    <span className="font-mono text-primary-fixed font-bold">
                      {Number(p.bar_count) || 48} bandas
                    </span>
                  </div>
                  <input
                    type="range"
                    min="16"
                    max="96"
                    step="4"
                    value={Number(p.bar_count) || 48}
                    onChange={(e) => updateParam('bar_count', parseInt(e.target.value, 10))}
                    className="w-full accent-[#00e0ff] cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Engine-Specific Fine Tuning */}
            {engine !== 'none' && (
              <div className="space-y-4 bg-surface-container p-4 rounded-xl border border-outline-variant/30">
                <span className="font-label-sm text-[11px] uppercase tracking-wider text-primary-fixed font-bold block">
                  4. Geometría, Reflejo de Agua y Brillo Neón
                </span>

                {/* Bar Roundness & Spacing for Bar-like engines */}
                {['rounded_mirror', 'center_symmetrical', 'bars', 'neon_ladder'].includes(
                  engine
                ) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-on-surface-variant">Redondez</span>
                        <span className="font-mono text-primary-fixed font-bold">
                          {Number(p.roundness ?? 4)}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="12"
                        step="1"
                        value={Number(p.roundness ?? 4)}
                        onChange={(e) => updateParam('roundness', parseFloat(e.target.value))}
                        className="w-full accent-[#00e0ff] cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-on-surface-variant">Espaciado</span>
                        <span className="font-mono text-primary-fixed font-bold">
                          {Number(p.gap_divisor ?? 5).toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="2.5"
                        max="9.0"
                        step="0.5"
                        value={Number(p.gap_divisor ?? 5)}
                        onChange={(e) => updateParam('gap_divisor', parseFloat(e.target.value))}
                        className="w-full accent-[#00e0ff] cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {/* Ribbons Controls */}
                {engine === 'flowing_ribbons' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-on-surface-variant">Nº de Listones</span>
                        <span className="font-mono text-primary-fixed font-bold">
                          {Number(p.ribbon_count) || 4}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="8"
                        step="1"
                        value={Number(p.ribbon_count) || 4}
                        onChange={(e) => updateParam('ribbon_count', parseInt(e.target.value, 10))}
                        className="w-full accent-[#00e0ff] cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-on-surface-variant">Velocidad Onda</span>
                        <span className="font-mono text-primary-fixed font-bold">
                          {Number(p.wave_speed || 1.2).toFixed(1)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.4"
                        max="4.0"
                        step="0.1"
                        value={Number(p.wave_speed) || 1.2}
                        onChange={(e) => updateParam('wave_speed', parseFloat(e.target.value))}
                        className="w-full accent-[#00e0ff] cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-on-surface-variant">Grosor Trazo</span>
                        <span className="font-mono text-primary-fixed font-bold">
                          {Number(p.line_width || 2.5).toFixed(1)}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1.0"
                        max="6.0"
                        step="0.5"
                        value={Number(p.line_width) || 2.5}
                        onChange={(e) => updateParam('line_width', parseFloat(e.target.value))}
                        className="w-full accent-[#00e0ff] cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-on-surface-variant">Relleno Inferior</span>
                        <span className="font-mono text-primary-fixed font-bold">
                          {Math.round((Number(p.fill_opacity ?? 0.082)) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="0.35"
                        step="0.01"
                        value={Number(p.fill_opacity ?? 0.082)}
                        onChange={(e) => updateParam('fill_opacity', parseFloat(e.target.value))}
                        className="w-full accent-[#00e0ff] cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {/* Particle Waves / Grid Controls */}
                {['particle_waves', 'dot_matrix', 'neon_ladder'].includes(engine) && (
                  <div className="grid grid-cols-2 gap-3">
                    {engine === 'particle_waves' && (
                      <>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-on-surface-variant">Columnas 3D</span>
                            <span className="font-mono text-primary-fixed font-bold">
                              {Number(p.grid_cols) || 28}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="12"
                            max="48"
                            step="2"
                            value={Number(p.grid_cols) || 28}
                            onChange={(e) => updateParam('grid_cols', parseInt(e.target.value, 10))}
                            className="w-full accent-[#00e0ff] cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-on-surface-variant">Velocidad 3D</span>
                            <span className="font-mono text-primary-fixed font-bold">
                              {Number(p.wave_speed || 3.0).toFixed(1)}x
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="6.0"
                            step="0.2"
                            value={Number(p.wave_speed) || 3.0}
                            onChange={(e) => updateParam('wave_speed', parseFloat(e.target.value))}
                            className="w-full accent-[#00e0ff] cursor-pointer"
                          />
                        </div>
                      </>
                    )}

                    <div className="col-span-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-on-surface-variant">
                          Filas Verticales / Capas de Profundidad
                        </span>
                        <span className="font-mono text-primary-fixed font-bold">
                          {Number(p.grid_rows) || 12} filas
                        </span>
                      </div>
                      <input
                        type="range"
                        min="6"
                        max="24"
                        step="1"
                        value={Number(p.grid_rows) || 12}
                        onChange={(e) => updateParam('grid_rows', parseInt(e.target.value, 10))}
                        className="w-full accent-[#00e0ff] cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {/* Glow Blur */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-on-surface-variant font-medium">
                      Resplandor Neón / Sombra (Glow Blur)
                    </span>
                    <span className="font-mono text-primary-fixed font-bold">
                      {Number(p.glow_blur ?? 8)}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="24"
                    step="1"
                    value={Number(p.glow_blur ?? 8)}
                    onChange={(e) => updateParam('glow_blur', parseFloat(e.target.value))}
                    className="w-full accent-[#00e0ff] cursor-pointer"
                  />
                </div>

                {/* Water / Floor Reflection Toggle & Sliders */}
                {!['flowing_ribbons', 'particle_waves'].includes(engine) && (
                  <div className="pt-2 border-t border-outline-variant/25 space-y-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs font-semibold text-on-surface">
                        Reflejo Inferior de Agua / Piso
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(p.reflection_enabled)}
                        onChange={(e) => updateParam('reflection_enabled', e.target.checked)}
                        className="w-4 h-4 accent-[#00e0ff] cursor-pointer"
                      />
                    </label>

                    {p.reflection_enabled && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-on-surface-variant">Opacidad Reflejo</span>
                            <span className="font-mono text-primary-fixed font-bold">
                              {Math.round((Number(p.reflection_opacity ?? 0.28)) * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.05"
                            max="0.65"
                            step="0.02"
                            value={Number(p.reflection_opacity ?? 0.28)}
                            onChange={(e) =>
                              updateParam('reflection_opacity', parseFloat(e.target.value))
                            }
                            className="w-full accent-[#00e0ff] cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-on-surface-variant">Longitud Reflejo</span>
                            <span className="font-mono text-primary-fixed font-bold">
                              {Math.round((Number(p.reflection_scale ?? 0.55)) * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.15"
                            max="0.85"
                            step="0.05"
                            value={Number(p.reflection_scale ?? 0.55)}
                            onChange={(e) =>
                              updateParam('reflection_scale', parseFloat(e.target.value))
                            }
                            className="w-full accent-[#00e0ff] cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Right Column: Live 1:1 Interactive Canvas Monitor (4 Cols) */}
          <div className="lg:col-span-4 p-5 flex flex-col justify-between bg-surface-container-lowest/70">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-[11px] uppercase tracking-wider text-primary-fixed font-bold">
                  Vista Previa en Tiempo Real (1:1 con Video)
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-bold uppercase">
                  LIVE 60 FPS
                </span>
              </div>

              <WaveformPreviewCanvas
                backgroundImageUrl={backgroundImageUrl}
                hasBg={hasBg}
                waveformStyle={draft.id}
                waveformParams={draft.params}
                waveformCatalog={presets}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                colorMode={p.default_color_mode || colorMode}
                paletteColors={paletteColors}
                shakeIntensity={4}
                bgPulse={true}
                compact={true}
              />

              <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/25 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-primary-fixed font-bold">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>Estandarización Garantizada 1:1</span>
                </div>
                <p className="text-on-surface-variant text-[11px] leading-relaxed">
                  Estos parámetros geométricos (<code className="text-on-surface">base_y_ratio</code>,{' '}
                  <code className="text-on-surface">max_height_ratio</code>,{' '}
                  <code className="text-on-surface">reflection</code>,{' '}
                  <code className="text-on-surface">glow</code>) se guardan en el catálogo y son
                  interpretados directamente por <code className="text-on-surface">video/renderer.py</code> al
                  generar los videos 16:9 y 9:16.
                </p>
              </div>
            </div>

            <div className="pt-4 space-y-2">
              {statusMsg && (
                <div className="px-3 py-2 rounded-lg bg-primary-container/15 border border-primary-container/40 text-primary-fixed text-xs font-medium">
                  {statusMsg}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveCurrentWave}
                  disabled={saving}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-primary-container text-on-primary-fixed font-headline-sm text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:brightness-105 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  <span>{saving ? 'Guardando...' : 'Guardar y Usar Esta Onda'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

