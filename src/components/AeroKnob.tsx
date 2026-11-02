import React, { useRef, useState, useCallback, useEffect } from 'react';

interface AeroKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  unit?: string;
  displayFormat?: (val: number) => string;
  onChange: (val: number) => void;
  size?: 'sm' | 'md' | 'lg';
  color?: 'aqua' | 'emerald' | 'amber';
}

export const AeroKnob: React.FC<AeroKnobProps> = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  defaultValue,
  unit = '',
  displayFormat,
  onChange,
  size = 'md',
  color = 'aqua',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef<number>(0);
  const dragStartValRef = useRef<number>(0);

  // Knob dimensions
  const diameter = size === 'sm' ? 44 : size === 'lg' ? 68 : 54;
  const strokeWidth = size === 'sm' ? 3 : 4;
  const radius = (diameter - strokeWidth * 2) / 2;
  const center = diameter / 2;

  // Normalized value 0.0 to 1.0
  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));

  // Angle from -135deg to +135deg (total 270 deg)
  const startAngle = -135;
  const endAngle = 135;
  const currentAngle = startAngle + norm * (endAngle - startAngle);

  // SVG Arc calculation for the glowing ring
  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians),
    };
  };

  const describeArc = (x: number, y: number, r: number, start: number, end: number) => {
    const startPoint = polarToCartesian(x, y, r, end);
    const endPoint = polarToCartesian(x, y, r, start);
    const largeArcFlag = end - start <= 180 ? '0' : '1';
    return ['M', startPoint.x, startPoint.y, 'A', r, r, 0, largeArcFlag, 0, endPoint.x, endPoint.y].join(' ');
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartYRef.current = e.clientY;
    dragStartValRef.current = value;
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const deltaY = dragStartYRef.current - e.clientY;
      const range = max - min;
      // 150px drag for full scale
      const stepVal = (deltaY / 150) * range;
      let newVal = dragStartValRef.current + stepVal;
      newVal = Math.max(min, Math.min(max, newVal));

      if (step) {
        newVal = Math.round(newVal / step) * step;
      }
      onChange(newVal);
    },
    [isDragging, min, max, step, onChange]
  );

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture release safety
      }
    }
  };

  const handleDoubleClick = () => {
    if (defaultValue !== undefined) {
      onChange(defaultValue);
    }
  };

  // Color styles
  const glowColor =
    color === 'emerald'
      ? 'rgba(16, 185, 129, 0.9)'
      : color === 'amber'
      ? 'rgba(245, 158, 11, 0.9)'
      : 'rgba(56, 189, 248, 0.95)';

  const formattedValue = displayFormat
    ? displayFormat(value)
    : step >= 1
    ? Math.round(value).toString()
    : value.toFixed(2);

  return (
    <div className="flex flex-col items-center select-none group touch-none">
      {/* Knob Label */}
      <span className="text-[9px] font-semibold tracking-tight uppercase text-cyan-200/90 mb-0.5 drop-shadow text-center truncate max-w-[56px]">
        {label}
      </span>

      {/* Rotary Dial Container */}
      <div
        className="relative cursor-ns-resize flex items-center justify-center"
        style={{ width: diameter, height: diameter }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        title={`${label}: ${formattedValue}${unit} (Drag up/down, Double-click to reset)`}
        role="slider"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
      >
        {/* Background track & glowing active arc */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={diameter}
          height={diameter}
        >
          {/* Base Track */}
          <path
            d={describeArc(center, center, radius, startAngle, endAngle)}
            fill="none"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Active Arc */}
          {norm > 0.005 && (
            <path
              d={describeArc(center, center, radius, startAngle, currentAngle)}
              fill="none"
              stroke={glowColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 4px ${glowColor})`,
              }}
            />
          )}
        </svg>

        {/* 3D Skeuomorphic Chrome Dial Body */}
        <div
          className="aero-metal-knob rounded-full flex items-center justify-center relative shadow-lg"
          style={{
            width: diameter - strokeWidth * 2 - 6,
            height: diameter - strokeWidth * 2 - 6,
            transform: `rotate(${currentAngle}deg)`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          {/* Beveled Top Rim with Gloss Sheen */}
          <div className="absolute inset-0 rounded-full aero-gloss-sheen pointer-events-none opacity-80" />

          {/* Indicator Dot / Line */}
          <div
            className="absolute top-1 w-1 rounded-full"
            style={{
              height: size === 'sm' ? 6 : 8,
              backgroundColor: '#0284c7',
              boxShadow: '0 0 6px #38bdf8, 0 1px 2px rgba(0,0,0,0.5)',
            }}
          />

          {/* Center Jewel / Pearl */}
          <div className="w-2.5 h-2.5 rounded-full bg-slate-300 shadow-inner border border-white/60" />
        </div>
      </div>

      {/* Value Display */}
      <span className="text-[11px] font-mono font-medium text-cyan-100 mt-1 bg-sky-950/40 px-1.5 py-0.5 rounded border border-white/10 shadow-inner">
        {formattedValue}
        {!displayFormat && unit && <span className="text-[9px] text-cyan-300/70 ml-0.5">{unit}</span>}
      </span>
    </div>
  );
};
