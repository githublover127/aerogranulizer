/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { engine, DEFAULT_PARAMS, type GranularParams } from './audio/GranularEngine';
import { IosDeviceFrame, useDeviceFrame } from './components/IosDeviceFrame';
import { WaveformGranularView } from './components/WaveformGranularView';
import { AeroKnob } from './components/AeroKnob';
import { AeroKeyboard } from './components/AeroKeyboard';
import { AeroXYPad } from './components/AeroXYPad';
import { EffectsRack } from './components/EffectsRack';
import { SampleManagerModal } from './components/SampleManagerModal';
import { ResampleDrawer } from './components/ResampleDrawer';
import {
  Play,
  Pause,
  Snowflake,
  Radio,
  FolderOpen,
  Volume2,
  Sliders,
  Sparkles,
  Layers,
  Activity,
} from 'lucide-react';

export default function App() {
  return (
    <IosDeviceFrame>
      <GranulizerPluginBody />
    </IosDeviceFrame>
  );
}

function GranulizerPluginBody() {
  const { isPhoneFrame } = useDeviceFrame();
  const [params, setParams] = useState<GranularParams>(DEFAULT_PARAMS);
  const [currentSampleName, setCurrentSampleName] = useState<string>('Aquatic Chimes & Drops');
  const [isDronePlaying, setIsDronePlaying] = useState<boolean>(false);
  const [isSampleModalOpen, setIsSampleModalOpen] = useState<boolean>(false);
  const [isResampleDrawerOpen, setIsResampleDrawerOpen] = useState<boolean>(false);
  const [isResamplingActive, setIsResamplingActive] = useState<boolean>(false);
  const [resampleTimer, setResampleTimer] = useState<number>(0);

  // Sync state with engine
  const handleParamChange = useCallback((updated: Partial<GranularParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...updated };
      engine.updateParams(updated);
      return next;
    });
  }, []);

  // Sync playhead auto-movement from engine scheduler
  useEffect(() => {
    engine.setPlayheadPositionListener((pos) => {
      setParams((prev) => ({ ...prev, position: pos }));
    });

    return () => {
      engine.setPlayheadPositionListener(null);
    };
  }, []);

  const toggleDrone = () => {
    engine.initAudio();
    const active = engine.toggleDrone();
    setIsDronePlaying(active);
  };

  const toggleFreeze = () => {
    handleParamChange({ isFrozen: !params.isFrozen });
  };

  const handleStartQuickResample = () => {
    engine.initAudio();
    if (isResamplingActive) {
      engine.stopResampling();
      setIsResamplingActive(false);
      setResampleTimer(0);
      setIsResampleDrawerOpen(true);
    } else {
      const started = engine.startResampling((elapsed) => {
        setResampleTimer(elapsed);
      });
      if (started) {
        setIsResamplingActive(true);
      }
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4 w-full select-none text-white">
        {/* Top Plugin Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-white/20">
          <div className="flex flex-wrap items-center gap-2">
            {/* Sample Selector Trigger */}
            <button
              onClick={() => setIsSampleModalOpen(true)}
              className="aero-glass-panel px-3 py-1.5 rounded-xl flex items-center gap-2 hover:bg-sky-400/20 transition-all border border-white/40 shadow-sm group"
              aria-label="Load Sample File or Preset"
            >
              <FolderOpen className="w-4 h-4 text-cyan-300 group-hover:scale-110 transition-transform shrink-0" />
              <div className="text-left">
                <span className="block text-[8px] uppercase font-bold text-cyan-200/80 tracking-wider">
                  Active Sample
                </span>
                <span className="block text-xs font-bold text-white truncate max-w-[130px] sm:max-w-[170px]">
                  {currentSampleName}
                </span>
              </div>
            </button>

            {/* Quick Record Resample Button */}
            <button
              onClick={handleStartQuickResample}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all font-bold text-xs shadow-md ${
                isResamplingActive
                  ? 'aero-gel-btn-red animate-pulse'
                  : 'aero-gel-btn-green'
              }`}
              aria-label={isResamplingActive ? 'Stop Resampling' : 'Resample Output'}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>
                {isResamplingActive ? `REC ${resampleTimer.toFixed(1)}s` : 'RESAMPLE'}
              </span>
            </button>

            {/* Takes Gallery Drawer Trigger */}
            <button
              onClick={() => setIsResampleDrawerOpen(true)}
              className="aero-glass-panel px-2.5 py-1.5 rounded-xl text-xs font-semibold text-cyan-200 hover:text-white border border-white/30 flex items-center gap-1"
              aria-label="Open Resampled Takes Gallery"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-300" />
              <span className="text-[11px]">Takes</span>
            </button>
          </div>

          {/* Master Transport & Volume Controls */}
          <div className="flex items-center gap-2">
            {/* Freeze Button */}
            <button
              onClick={toggleFreeze}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                params.isFrozen
                  ? 'bg-amber-400 text-sky-950 border-amber-200 shadow-md shadow-amber-400/40'
                  : 'bg-sky-950/60 text-cyan-200 border-white/20 hover:bg-sky-850'
              }`}
              aria-label={params.isFrozen ? 'Unfreeze Playhead' : 'Freeze Playhead'}
            >
              <Snowflake className={`w-3.5 h-3.5 ${params.isFrozen ? 'animate-spin' : ''}`} />
              <span className="text-[11px]">{params.isFrozen ? 'FROZEN' : 'FREEZE'}</span>
            </button>

            {/* Play Drone Button */}
            <button
              onClick={toggleDrone}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all ${
                isDronePlaying ? 'aero-gel-btn-red' : 'aero-gel-btn'
              }`}
              aria-label={isDronePlaying ? 'Pause Drone Playback' : 'Start Drone Playback'}
            >
              {isDronePlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-white" />
                  <span>STOP</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                  <span>DRONE</span>
                </>
              )}
            </button>

            {/* Master Volume Knob */}
            <div className="pl-1 border-l border-white/20">
              <AeroKnob
                label="Master"
                value={params.volume}
                min={0}
                max={1.2}
                step={0.02}
                defaultValue={0.85}
                unit="%"
                displayFormat={(v) => `${Math.round((v / 1.2) * 100)}%`}
                onChange={(volume) => handleParamChange({ volume })}
                size="sm"
                color="aqua"
              />
            </div>
          </div>
        </div>

        {/* Granular Waveform & Bubble Cloud Canvas */}
        <section aria-label="Waveform Visualizer">
          <WaveformGranularView
            position={params.position}
            spray={params.spray}
            isFrozen={params.isFrozen}
            onPositionChange={(pos) => handleParamChange({ position: pos })}
            onSprayChange={(spray) => handleParamChange({ spray })}
          />
        </section>

        {/* Primary Granular Synthesis Controls Rack */}
        <section
          aria-label="Granular Parameters"
          className="aero-glass-panel rounded-2xl p-3 sm:p-4 border border-white/50 relative overflow-hidden"
        >
          <div className="absolute inset-0 aero-gloss-sheen pointer-events-none opacity-30" />

          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10 mb-3">
            <div className="flex items-center gap-2 text-xs font-extrabold tracking-wider text-cyan-200 uppercase">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Granular Particle Engine</span>
            </div>

            {/* Envelope Shape Selector */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[10px] text-cyan-200/70 font-semibold uppercase">Window:</span>
              <div className="flex bg-sky-950/70 p-0.5 rounded-lg border border-white/20">
                {(['hann', 'gaussian', 'triangle', 'percussive'] as const).map((env) => (
                  <button
                    key={env}
                    onClick={() => handleParamChange({ envelope: env })}
                    className={`px-1.5 py-0.5 text-[9px] font-bold rounded capitalize transition-all ${
                      params.envelope === env
                        ? 'bg-cyan-500 text-sky-950 shadow-sm'
                        : 'text-cyan-200/70 hover:text-white'
                    }`}
                  >
                    {env}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Granular Knobs: 4 cols on mobile / iPhone frame, 8 cols on wide displays */}
          <div className={`grid ${isPhoneFrame ? 'grid-cols-4 gap-x-2 gap-y-4' : 'grid-cols-4 lg:grid-cols-8 gap-3'} items-center justify-items-center`}>
            <AeroKnob
              label="Position"
              value={params.position}
              min={0}
              max={1}
              step={0.005}
              defaultValue={0.25}
              unit="%"
              displayFormat={(v) => `${Math.round(v * 100)}%`}
              onChange={(position) => handleParamChange({ position })}
              size="md"
              color="aqua"
            />
            <AeroKnob
              label="Spray"
              value={params.spray}
              min={0}
              max={0.8}
              step={0.01}
              defaultValue={0.15}
              unit="%"
              displayFormat={(v) => `${Math.round(v * 100)}%`}
              onChange={(spray) => handleParamChange({ spray })}
              size="md"
              color="aqua"
            />
            <AeroKnob
              label="Grain Size"
              value={params.grainSize}
              min={0.02}
              max={0.5}
              step={0.005}
              defaultValue={0.12}
              unit="s"
              displayFormat={(v) => `${Math.round(v * 1000)}ms`}
              onChange={(grainSize) => handleParamChange({ grainSize })}
              size="md"
              color="aqua"
            />
            <AeroKnob
              label="Density"
              value={params.density}
              min={4}
              max={70}
              step={1}
              defaultValue={28}
              unit="Hz"
              onChange={(density) => handleParamChange({ density })}
              size="md"
              color="aqua"
            />
            <AeroKnob
              label="Pitch"
              value={params.pitchSemitones}
              min={-24}
              max={24}
              step={1}
              defaultValue={0}
              unit="st"
              displayFormat={(v) => (v > 0 ? `+${v}` : `${v}`)}
              onChange={(pitchSemitones) => handleParamChange({ pitchSemitones })}
              size="md"
              color="emerald"
            />
            <AeroKnob
              label="Detune"
              value={params.pitchJitterCents}
              min={0}
              max={1200}
              step={10}
              defaultValue={0}
              unit="c"
              onChange={(pitchJitterCents) => handleParamChange({ pitchJitterCents })}
              size="md"
              color="emerald"
            />
            <AeroKnob
              label="Pan Spray"
              value={params.panSpread}
              min={0}
              max={1}
              step={0.02}
              defaultValue={0.75}
              unit="%"
              displayFormat={(v) => `${Math.round(v * 100)}%`}
              onChange={(panSpread) => handleParamChange({ panSpread })}
              size="md"
              color="aqua"
            />
            <AeroKnob
              label="Reverse"
              value={params.reverseChance}
              min={0}
              max={1}
              step={0.02}
              defaultValue={0.1}
              unit="%"
              displayFormat={(v) => `${Math.round(v * 100)}%`}
              onChange={(reverseChance) => handleParamChange({ reverseChance })}
              size="md"
              color="amber"
            />
          </div>
        </section>

        {/* Lower Section: Interactive XY Pad & Keyboard */}
        <div className={`grid ${isPhoneFrame ? 'grid-cols-1 gap-3' : 'grid-cols-1 md:grid-cols-3 gap-3'}`}>
          {/* XY Ribbon Modulation Pad */}
          <div className="aero-glass-panel rounded-2xl p-3 border border-white/40 flex flex-col justify-between">
            <AeroXYPad
              xValue={params.position}
              yValue={params.grainSize / 0.5}
              xLabel="POS"
              yLabel="SIZE"
              onChange={(x, y) => {
                handleParamChange({
                  position: x,
                  grainSize: Math.max(0.02, y * 0.5),
                });
              }}
            />
          </div>

          {/* iOS Synth Keyboard & Scale Trigger */}
          <div className={`${isPhoneFrame ? '' : 'md:col-span-2'} aero-glass-panel rounded-2xl p-3 border border-white/40 flex flex-col justify-between`}>
            <AeroKeyboard />
          </div>
        </div>

        {/* Effects Rack (Filter, Delay, Reverb) */}
        <section aria-label="Aero Effects Processing Rack">
          <EffectsRack params={params} onChange={handleParamChange} />
        </section>
      </div>

      {/* Modals & Resample Drawers */}
      <SampleManagerModal
        isOpen={isSampleModalOpen}
        onClose={() => setIsSampleModalOpen(false)}
        onSampleLoaded={(name) => setCurrentSampleName(name)}
      />

      <ResampleDrawer
        isOpen={isResampleDrawerOpen}
        onClose={() => setIsResampleDrawerOpen(false)}
        onTakeLoadedToEngine={(name) => setCurrentSampleName(name)}
      />
    </>
  );
}
