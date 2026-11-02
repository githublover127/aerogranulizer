import React, { useRef, useEffect, useState, useCallback } from 'react';
import { engine, type GrainVisualEvent } from '../audio/GranularEngine';
import { formatTime } from '../audio/granulizerMath';

interface WaveformGranularViewProps {
  position: number;
  spray: number;
  isFrozen: boolean;
  onPositionChange: (pos: number) => void;
  onSprayChange?: (spray: number) => void;
}

interface GrainBubble {
  id: number;
  x: number; // 0 to 1
  y: number; // 0 to 1
  radius: number;
  alpha: number;
  color: string;
  pan: number;
  life: number;
  maxLife: number;
}

export const WaveformGranularView: React.FC<WaveformGranularViewProps> = ({
  position,
  spray,
  isFrozen,
  onPositionChange,
  onSprayChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const bubblesRef = useRef<GrainBubble[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Subscribe to engine's live grain spawn events
  useEffect(() => {
    const unsubscribe = engine.addGrainVisualListener((e: GrainVisualEvent) => {
      // Create a visual Frutiger Aero bubble for each spawned grain
      const panNorm = (e.pan + 1) / 2; // 0 to 1
      const pitchHue = 180 + Math.min(60, Math.max(-60, (e.pitchRate - 1) * 60)); // Cyan to sky blue/aquamarine

      const bubble: GrainBubble = {
        id: e.id,
        x: Math.max(0.01, Math.min(0.99, e.position + (Math.random() * 2 - 1) * (spray * 0.4))),
        y: 0.15 + panNorm * 0.7 + (Math.random() * 0.1 - 0.05),
        radius: Math.max(6, Math.min(24, e.size * 60)),
        alpha: 0.85,
        color: `hsl(${pitchHue}, 90%, 65%)`,
        pan: e.pan,
        life: 0,
        maxLife: Math.max(200, e.size * 1000), // ms
      };

      bubblesRef.current.push(bubble);
      // Keep bubble count under control
      if (bubblesRef.current.length > 50) {
        bubblesRef.current.shift();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [spray]);

  // Main Canvas Render Loop (Waveform + Spray Overlay + Bubbles + Playhead)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTimestamp = performance.now();

    const render = (now: number) => {
      const dt = now - lastTimestamp;
      lastTimestamp = now;

      // Handle retina resolution
      const width = canvas.width;
      const height = canvas.height;

      // Clear with aquatic deep gradient
      ctx.clearRect(0, 0, width, height);

      // Deep aqua background glass
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, 'rgba(3, 40, 75, 0.85)');
      bgGrad.addColorStop(0.5, 'rgba(2, 28, 55, 0.95)');
      bgGrad.addColorStop(1, 'rgba(1, 18, 38, 0.98)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Draw horizontal guideline grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      const audioBuffer = engine.getAudioBuffer();

      // Render Waveform
      if (audioBuffer) {
        const rawData = audioBuffer.getChannelData(0);
        const step = Math.ceil(rawData.length / width);
        const amp = (height / 2) * 0.78;
        const midY = height / 2;

        // Waveform gradient (Frutiger Aero cyan to lime glow)
        const waveGrad = ctx.createLinearGradient(0, 0, 0, height);
        waveGrad.addColorStop(0, 'rgba(125, 211, 252, 0.9)');
        waveGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.8)');
        waveGrad.addColorStop(1, 'rgba(16, 185, 129, 0.7)');

        ctx.fillStyle = waveGrad;
        ctx.beginPath();

        for (let i = 0; i < width; i++) {
          let min = 1.0;
          let max = -1.0;
          for (let j = 0; j < step; j++) {
            const datum = rawData[i * step + j] || 0;
            if (datum < min) min = datum;
            if (datum > max) max = datum;
          }
          const y1 = midY + min * amp;
          const y2 = midY + max * amp;
          ctx.fillRect(i, y1, 1, Math.max(1.5, y2 - y1));
        }
      } else {
        // Placeholder shimmering sine wave if loading
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const y = height / 2 + Math.sin(x * 0.05 + now * 0.003) * 20;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Draw Spray / Jitter Dispersion Range
      const sprayPixels = spray * width;
      const playheadX = position * width;
      const sprayLeft = Math.max(0, playheadX - sprayPixels * 0.5);
      const sprayRight = Math.min(width, playheadX + sprayPixels * 0.5);

      const sprayGrad = ctx.createLinearGradient(sprayLeft, 0, sprayRight, 0);
      sprayGrad.addColorStop(0, 'rgba(56, 189, 248, 0.0)');
      sprayGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.25)');
      sprayGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

      ctx.fillStyle = sprayGrad;
      ctx.fillRect(sprayLeft, 0, sprayRight - sprayLeft, height);

      // Render Floating Grain Bubbles
      const currentBubbles = bubblesRef.current;
      for (let i = currentBubbles.length - 1; i >= 0; i--) {
        const b = currentBubbles[i];
        b.life += dt;
        const progress = b.life / b.maxLife;

        if (progress >= 1) {
          currentBubbles.splice(i, 1);
          continue;
        }

        // Float slightly upwards like water bubbles
        b.y -= (dt * 0.00008);
        const bx = b.x * width;
        const by = b.y * height;
        const radius = b.radius * (1 + Math.sin(progress * Math.PI) * 0.2);
        const alpha = Math.sin(progress * Math.PI) * 0.85;

        // Draw iridescent bubble sphere with specular highlight
        const bubbleGrad = ctx.createRadialGradient(
          bx - radius * 0.35,
          by - radius * 0.35,
          radius * 0.1,
          bx,
          by,
          radius
        );
        bubbleGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.95})`);
        bubbleGrad.addColorStop(0.3, `rgba(186, 230, 253, ${alpha * 0.7})`);
        bubbleGrad.addColorStop(0.7, `rgba(6, 182, 212, ${alpha * 0.4})`);
        bubbleGrad.addColorStop(1, `rgba(255, 255, 255, ${alpha * 0.8})`);

        ctx.save();
        ctx.beginPath();
        ctx.arc(bx, by, radius, 0, Math.PI * 2);
        ctx.fillStyle = bubbleGrad;
        ctx.fill();

        // Bubble glossy rim
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Mini Specular glint
        ctx.beginPath();
        ctx.ellipse(bx - radius * 0.3, by - radius * 0.35, radius * 0.25, radius * 0.15, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();

        ctx.restore();
      }

      // Draw Playhead Scrubber Line
      ctx.save();
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Top Playhead Aqua Jewel
      ctx.fillStyle = isFrozen ? '#f59e0b' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(playheadX, 8, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();

      // Top Glass Reflection Sweep
      const sheenGrad = ctx.createLinearGradient(0, 0, 0, height * 0.4);
      sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = sheenGrad;
      ctx.fillRect(0, 0, width, height * 0.4);

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [position, spray, isFrozen]);

  // Handle Resize for sharp canvas
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      canvasRef.current.width = Math.floor(rect.width);
      canvasRef.current.height = Math.floor(rect.height);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Pointer event handlers for touch / scrub
  const updateScrubFromEvent = useCallback(
    (e: React.PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.clientX;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onPositionChange(ratio);
    },
    [onPositionChange]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsScrubbing(true);
    updateScrubFromEvent(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isScrubbing) return;
    updateScrubFromEvent(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isScrubbing) {
      setIsScrubbing(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Release safety
      }
    }
  };

  const audioBuf = engine.getAudioBuffer();
  const duration = audioBuf ? audioBuf.duration : 0;
  const currentTime = position * duration;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-36 rounded-xl overflow-hidden border border-white/40 shadow-inner select-none cursor-crosshair group touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      aria-label="Granular Waveform Scrub Controller"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />

      {/* Frutiger Aero Gloss Sheen Layer */}
      <div className="absolute inset-0 pointer-events-none aero-gloss-sheen opacity-40" />

      {/* Top HUD Overlay Info */}
      <div className="absolute top-2 left-3 right-3 flex items-center justify-between pointer-events-none text-[11px] font-mono text-cyan-100/90 drop-shadow">
        <div className="flex items-center gap-2 bg-sky-950/60 px-2 py-0.5 rounded-md border border-white/20 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />
          <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>

        <div className="flex items-center gap-2 bg-sky-950/60 px-2 py-0.5 rounded-md border border-white/20 backdrop-blur-md">
          <span>POS: {(position * 100).toFixed(1)}%</span>
          <span className="text-cyan-300/50">|</span>
          <span>SPRAY: {(spray * 100).toFixed(0)}%</span>
          {isFrozen && (
            <span className="text-amber-300 font-bold ml-1">FROZEN</span>
          )}
        </div>
      </div>

      {/* Bottom Hint */}
      <div className="absolute bottom-1.5 left-3 text-[10px] text-cyan-200/60 font-sans pointer-events-none tracking-tight">
        Tap or scrub anywhere to position granular cloud
      </div>
    </div>
  );
};
