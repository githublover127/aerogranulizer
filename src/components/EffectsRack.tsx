import React from 'react';
import { AeroKnob } from './AeroKnob';
import { Waves, Sliders, Sparkles } from 'lucide-react';
import type { GranularParams } from '../audio/GranularEngine';

interface EffectsRackProps {
  params: GranularParams;
  onChange: (updated: Partial<GranularParams>) => void;
}

export const EffectsRack: React.FC<EffectsRackProps> = ({ params, onChange }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
      {/* 1. State-Variable Filter Unit */}
      <div className="aero-glass-panel rounded-xl p-3 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 aero-gloss-sheen pointer-events-none opacity-40" />

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-200">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>AERO FILTER</span>
          </div>

          {/* Filter Type Toggle */}
          <div className="flex items-center bg-sky-950/60 p-0.5 rounded-lg border border-white/20">
            {(['lowpass', 'highpass', 'bandpass'] as const).map((type) => (
              <button
                key={type}
                onClick={() => onChange({ filterType: type })}
                className={`px-1.5 py-0.5 text-[9px] font-semibold rounded uppercase transition-all ${
                  params.filterType === type
                    ? 'bg-cyan-500 text-sky-950 shadow-sm'
                    : 'text-cyan-200/70 hover:text-white'
                }`}
                aria-label={`Filter mode ${type}`}
              >
                {type === 'lowpass' ? 'LP' : type === 'highpass' ? 'HP' : 'BP'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-around py-1">
          <AeroKnob
            label="Cutoff"
            value={params.filterCutoff}
            min={100}
            max={16000}
            step={50}
            defaultValue={8500}
            unit="Hz"
            displayFormat={(val) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : `${Math.round(val)}`)}
            onChange={(filterCutoff) => onChange({ filterCutoff })}
            size="md"
            color="aqua"
          />
          <AeroKnob
            label="Resonance"
            value={params.filterResonance}
            min={0.5}
            max={14}
            step={0.1}
            defaultValue={2.5}
            unit="Q"
            onChange={(filterResonance) => onChange({ filterResonance })}
            size="md"
            color="aqua"
          />
        </div>
      </div>

      {/* 2. Aquatic Delay Unit */}
      <div className="aero-glass-panel rounded-xl p-3 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 aero-gloss-sheen pointer-events-none opacity-40" />

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-200">
            <Waves className="w-3.5 h-3.5 text-cyan-400" />
            <span>AQUATIC DELAY</span>
          </div>
          <span className="text-[10px] font-mono text-cyan-300/80 bg-sky-950/60 px-1.5 py-0.5 rounded border border-white/10">
            PING-PONG
          </span>
        </div>

        <div className="flex items-center justify-around py-1">
          <AeroKnob
            label="Time"
            value={params.delayTime}
            min={0.05}
            max={0.8}
            step={0.01}
            defaultValue={0.24}
            unit="s"
            displayFormat={(v) => `${Math.round(v * 1000)}ms`}
            onChange={(delayTime) => onChange({ delayTime })}
            size="sm"
            color="aqua"
          />
          <AeroKnob
            label="Feedback"
            value={params.delayFeedback}
            min={0}
            max={0.85}
            step={0.01}
            defaultValue={0.45}
            unit="%"
            displayFormat={(v) => `${Math.round(v * 100)}%`}
            onChange={(delayFeedback) => onChange({ delayFeedback })}
            size="sm"
            color="aqua"
          />
          <AeroKnob
            label="Delay Wet"
            value={params.delayWet}
            min={0}
            max={1.0}
            step={0.02}
            defaultValue={0.35}
            unit="%"
            displayFormat={(v) => `${Math.round(v * 100)}%`}
            onChange={(delayWet) => onChange({ delayWet })}
            size="sm"
            color="aqua"
          />
        </div>
      </div>

      {/* 3. Crystalline Shimmer Reverb Unit */}
      <div className="aero-glass-panel rounded-xl p-3 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 aero-gloss-sheen pointer-events-none opacity-40" />

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-200">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>CRYSTAL REVERB</span>
          </div>
          <span className="text-[10px] font-mono text-cyan-300/80 bg-sky-950/60 px-1.5 py-0.5 rounded border border-white/10">
            LUSH SHIMMER
          </span>
        </div>

        <div className="flex items-center justify-around py-1">
          <AeroKnob
            label="Decay"
            value={params.reverbDecay}
            min={0.8}
            max={6.0}
            step={0.1}
            defaultValue={3.2}
            unit="s"
            displayFormat={(v) => `${v.toFixed(1)}s`}
            onChange={(reverbDecay) => onChange({ reverbDecay })}
            size="sm"
            color="emerald"
          />
          <AeroKnob
            label="Space Wet"
            value={params.reverbWet}
            min={0}
            max={1.0}
            step={0.02}
            defaultValue={0.4}
            unit="%"
            displayFormat={(v) => `${Math.round(v * 100)}%`}
            onChange={(reverbWet) => onChange({ reverbWet })}
            size="sm"
            color="emerald"
          />
        </div>
      </div>
    </div>
  );
};
