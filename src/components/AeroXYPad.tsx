import React, { useRef, useState, useCallback } from 'react';
import { Sparkles } from 'lucide-react';

interface AeroXYPadProps {
  xValue: number; // 0 to 1
  yValue: number; // 0 to 1
  xLabel?: string;
  yLabel?: string;
  onChange: (x: number, y: number) => void;
}

export const AeroXYPad: React.FC<AeroXYPadProps> = ({
  xValue,
  yValue,
  xLabel = 'POSITION',
  yLabel = 'GRAIN SIZE',
  onChange,
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [isActive, setIsActive] = useState(false);

  const updateFromPointer = useCallback(
    (e: React.PointerEvent) => {
      if (!padRef.current) return;
      const rect = padRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      // Y inverted so top is 1.0 and bottom is 0.0
      const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
      onChange(x, y);
    },
    [onChange]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsActive(true);
    updateFromPointer(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isActive) return;
    updateFromPointer(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isActive) {
      setIsActive(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Release safety
      }
    }
  };

  return (
    <div className="flex flex-col gap-1 w-full select-none touch-none">
      <div className="flex items-center justify-between text-[10px] text-cyan-200/80 px-1 font-semibold uppercase">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          XY Touch Ribbon
        </span>
        <span className="font-mono text-cyan-300">
          X: {(xValue * 100).toFixed(0)}% · Y: {(yValue * 100).toFixed(0)}%
        </span>
      </div>

      <div
        ref={padRef}
        className="relative w-full h-28 rounded-xl overflow-hidden border border-white/40 shadow-inner cursor-crosshair bg-gradient-to-b from-sky-950/60 to-slate-950/80"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="region"
        aria-label="Granular XY Modulation Pad"
      >
        {/* Subtle coordinate grid lines */}
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none opacity-20">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="border border-sky-400/30" />
          ))}
        </div>

        {/* Axis Labels */}
        <span className="absolute bottom-1.5 left-2 text-[9px] font-mono text-cyan-300/60 pointer-events-none">
          X: {xLabel}
        </span>
        <span className="absolute top-2 left-2 text-[9px] font-mono text-cyan-300/60 pointer-events-none">
          Y: {yLabel}
        </span>

        {/* Glowing Cursor Puck with Specular Sheen */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-75"
          style={{
            left: `${xValue * 100}%`,
            top: `${(1 - yValue) * 100}%`,
          }}
        >
          {/* Radial Pulse */}
          <div
            className={`w-10 h-10 rounded-full border border-cyan-300/60 bg-cyan-400/20 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-cyan-500/50 ${
              isActive ? 'scale-125' : 'scale-100'
            }`}
          >
            {/* Center Aqua Pearl */}
            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-inner border border-cyan-400 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            </div>
          </div>
        </div>

        {/* Top Gloss Sheen */}
        <div className="absolute inset-0 aero-gloss-sheen pointer-events-none opacity-40" />
      </div>
    </div>
  );
};
