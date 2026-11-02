import React, { useState, useCallback } from 'react';
import { engine } from '../audio/GranularEngine';

interface AeroKeyboardProps {
  octaveOffset?: number;
}

const SCALE_PRESETS = [
  { name: 'Chromatic', notes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { name: 'Major', notes: [0, 2, 4, 5, 7, 9, 11] },
  { name: 'Minor', notes: [0, 2, 3, 5, 7, 8, 10] },
  { name: 'Pentatonic', notes: [0, 2, 4, 7, 9] },
  { name: 'Dorian', notes: [0, 2, 3, 5, 7, 9, 10] },
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const AeroKeyboard: React.FC<AeroKeyboardProps> = () => {
  const [octave, setOctave] = useState<number>(4); // Octave 4 (Middle C = 60)
  const [heldNotes, setHeldNotes] = useState<Set<number>>(new Set());
  const [isLatchActive, setIsLatchActive] = useState<boolean>(false);
  const [selectedScaleIndex, setSelectedScaleIndex] = useState<number>(0);

  // Generate 17 keys (from C[octave] to E[octave+1])
  const baseMidi = octave * 12;
  const numKeys = 17;
  const keys = Array.from({ length: numKeys }, (_, i) => {
    const midi = baseMidi + i;
    const semitone = midi % 12;
    const isBlack = [1, 3, 6, 8, 10].includes(semitone);
    const noteName = NOTE_NAMES[semitone] + Math.floor(midi / 12);
    const isInScale = SCALE_PRESETS[selectedScaleIndex].notes.includes(semitone);
    return { midi, noteName, isBlack, semitone, isInScale };
  });

  const handleKeyTrigger = useCallback(
    (midi: number) => {
      engine.initAudio();

      if (isLatchActive) {
        setHeldNotes((prev) => {
          const next = new Set(prev);
          if (next.has(midi)) {
            next.delete(midi);
            engine.noteOff(midi);
          } else {
            next.add(midi);
            engine.noteOn(midi);
          }
          return next;
        });
      } else {
        engine.noteOn(midi);
        setHeldNotes((prev) => new Set(prev).add(midi));
      }
    },
    [isLatchActive]
  );

  const handleKeyRelease = useCallback(
    (midi: number) => {
      if (!isLatchActive) {
        engine.noteOff(midi);
        setHeldNotes((prev) => {
          const next = new Set(prev);
          next.delete(midi);
          return next;
        });
      }
    },
    [isLatchActive]
  );

  const clearAllNotes = () => {
    heldNotes.forEach((midi) => engine.noteOff(midi));
    setHeldNotes(new Set());
  };

  return (
    <div className="flex flex-col gap-2 w-full select-none">
      {/* Keyboard Header Controls */}
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-cyan-200 tracking-wide uppercase text-[11px]">
            Touch Keys
          </span>
          {/* Octave Controls */}
          <div className="flex items-center bg-sky-950/60 rounded-lg p-0.5 border border-white/20 shadow-inner">
            <button
              onClick={() => setOctave((o) => Math.max(1, o - 1))}
              className="px-2 py-0.5 rounded text-cyan-200 hover:text-white font-mono active:bg-sky-700/50"
              aria-label="Lower Octave"
            >
              -
            </button>
            <span className="px-2 font-mono text-[11px] text-cyan-100">OCT {octave}</span>
            <button
              onClick={() => setOctave((o) => Math.min(7, o + 1))}
              className="px-2 py-0.5 rounded text-cyan-200 hover:text-white font-mono active:bg-sky-700/50"
              aria-label="Raise Octave"
            >
              +
            </button>
          </div>
        </div>

        {/* Scale & Latch toggles */}
        <div className="flex items-center gap-2">
          {/* Scale Selector */}
          <select
            value={selectedScaleIndex}
            onChange={(e) => setSelectedScaleIndex(Number(e.target.value))}
            className="bg-sky-950/70 text-cyan-200 text-[10px] font-medium py-1 px-2 rounded-lg border border-white/20 focus:outline-none"
            aria-label="Musical Scale"
          >
            {SCALE_PRESETS.map((scale, idx) => (
              <option key={scale.name} value={idx}>
                {scale.name}
              </option>
            ))}
          </select>

          {/* Latch Toggle */}
          <button
            onClick={() => {
              if (isLatchActive) {
                clearAllNotes();
              }
              setIsLatchActive(!isLatchActive);
            }}
            className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg border transition-all ${
              isLatchActive
                ? 'bg-amber-400 text-slate-900 border-amber-200 shadow-md shadow-amber-400/30'
                : 'bg-sky-900/60 text-cyan-200 border-white/20 hover:bg-sky-800/60'
            }`}
            aria-label="Latch Held Notes"
          >
            LATCH {isLatchActive ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* iOS Piano Keys Surface */}
      <div className="relative h-28 w-full flex rounded-xl overflow-hidden border border-white/40 shadow-xl bg-gradient-to-b from-sky-900/40 to-slate-900/80 p-1">
        {/* White Keys */}
        <div className="flex w-full h-full gap-0.5 relative">
          {keys
            .filter((k) => !k.isBlack)
            .map((k) => {
              const isHeld = heldNotes.has(k.midi);
              return (
                <button
                  key={k.midi}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleKeyTrigger(k.midi);
                  }}
                  onPointerUp={(e) => {
                    e.preventDefault();
                    handleKeyRelease(k.midi);
                  }}
                  onPointerLeave={(e) => {
                    e.preventDefault();
                    handleKeyRelease(k.midi);
                  }}
                  className={`flex-1 h-full rounded-b-lg flex flex-col justify-end items-center pb-1.5 transition-all relative overflow-hidden ${
                    !k.isInScale ? 'opacity-40' : 'opacity-100'
                  } ${
                    isHeld
                      ? 'bg-gradient-to-b from-cyan-200 to-cyan-400 shadow-inner'
                      : 'bg-gradient-to-b from-white via-sky-50 to-slate-200 hover:from-white hover:to-sky-100 active:bg-cyan-100'
                  }`}
                  style={{
                    boxShadow: isHeld
                      ? 'inset 0 4px 8px rgba(0, 50, 100, 0.4)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 4px rgba(0,0,0,0.15)',
                  }}
                  aria-label={`Key ${k.noteName}`}
                >
                  {/* Gloss Sheen */}
                  <div className="absolute inset-0 aero-gloss-sheen pointer-events-none opacity-60" />
                  <span
                    className={`text-[9px] font-bold font-mono ${
                      isHeld ? 'text-sky-950 font-black' : 'text-slate-600'
                    }`}
                  >
                    {k.noteName}
                  </span>
                </button>
              );
            })}
        </div>

        {/* Black Keys Overlay */}
        <div className="absolute inset-x-1 top-1 h-[60%] flex pointer-events-none">
          {keys.map((k, idx) => {
            if (!k.isBlack) {
              return <div key={`spacer-${idx}`} className="flex-1 pointer-events-none" />;
            }
            const isHeld = heldNotes.has(k.midi);
            return (
              <button
                key={k.midi}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyTrigger(k.midi);
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyRelease(k.midi);
                }}
                onPointerLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyRelease(k.midi);
                }}
                className={`pointer-events-auto -mx-3 z-20 w-6 h-full rounded-b-md flex flex-col justify-end items-center pb-1 border border-white/20 transition-all ${
                  !k.isInScale ? 'opacity-30' : 'opacity-100'
                } ${
                  isHeld
                    ? 'bg-gradient-to-b from-cyan-400 to-sky-700 shadow-inner'
                    : 'bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 shadow-md'
                }`}
                style={{
                  boxShadow: isHeld
                    ? 'inset 0 2px 6px rgba(0,0,0,0.6)'
                    : 'inset 0 1px 1px rgba(255,255,255,0.4), 0 3px 6px rgba(0,0,0,0.4)',
                }}
                aria-label={`Black Key ${k.noteName}`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 mb-0.5" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
