import React, { useState, useEffect, useRef } from 'react';
import { engine, type ResampleTake } from '../audio/GranularEngine';
import { formatTime } from '../audio/granulizerMath';
import { Radio, Download, Play, Pause, RefreshCw, Trash2, CheckCircle2, Music2 } from 'lucide-react';

interface ResampleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onTakeLoadedToEngine: (takeName: string) => void;
}

export const ResampleDrawer: React.FC<ResampleDrawerProps> = ({
  isOpen,
  onClose,
  onTakeLoadedToEngine,
}) => {
  const [isResampling, setIsResampling] = useState<boolean>(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [takes, setTakes] = useState<ResampleTake[]>([]);
  const [playingTakeId, setPlayingTakeId] = useState<string | null>(null);
  const [loadedTakeId, setLoadedTakeId] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Poll resampling status and subscribe to takes
  useEffect(() => {
    setIsResampling(engine.getIsResampling());
    setTakes(engine.getTakes());

    const unsubscribe = engine.addTakesListener((updatedTakes) => {
      setTakes(updatedTakes);
    });

    return () => unsubscribe();
  }, [isOpen]);

  const toggleResampling = () => {
    engine.initAudio();

    if (isResampling) {
      // Stop resampling
      engine.stopResampling();
      setIsResampling(false);
      setElapsedSec(0);
    } else {
      // Start resampling
      const started = engine.startResampling((elapsed) => {
        setElapsedSec(elapsed);
      });
      if (started) {
        setIsResampling(true);
      }
    }
  };

  const handlePlayPreview = (take: ResampleTake) => {
    if (!audioPreviewRef.current) return;

    if (playingTakeId === take.id) {
      audioPreviewRef.current.pause();
      setPlayingTakeId(null);
    } else {
      audioPreviewRef.current.src = take.url;
      audioPreviewRef.current.play();
      setPlayingTakeId(take.id);
    }
  };

  const handleLoadBackToEngine = async (take: ResampleTake) => {
    try {
      await engine.loadAudioFromBlob(take.blob);
      setLoadedTakeId(take.id);
      onTakeLoadedToEngine(take.name);
      setTimeout(() => setLoadedTakeId(null), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTake = (id: string) => {
    if (playingTakeId === id && audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      setPlayingTakeId(null);
    }
    engine.deleteTake(id);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md select-none animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resample-studio-title"
    >
      {/* Hidden audio element for take preview */}
      <audio
        ref={audioPreviewRef}
        onEnded={() => setPlayingTakeId(null)}
        className="hidden"
      />

      <div className="aero-glass-panel w-full max-w-xl rounded-2xl p-5 relative overflow-hidden shadow-2xl border border-white/60 flex flex-col max-h-[90vh]">
        {/* Frutiger Aero Gloss Sheen */}
        <div className="absolute inset-0 aero-gloss-sheen pointer-events-none opacity-40" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/20">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-400" />
            <div>
              <h2 id="resample-studio-title" className="text-base font-bold text-white drop-shadow">
                Resample & Audio Export Studio
              </h2>
              <p className="text-[10px] text-cyan-200/80">
                Record your live granular performance losslessly into master .WAV files
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-cyan-200 hover:text-white bg-sky-950/60 border border-white/20 hover:bg-sky-800/60 transition-colors"
            aria-label="Close Resample Studio"
          >
            Close
          </button>
        </div>

        {/* Live Recorder Banner */}
        <div className="my-4 p-4 rounded-xl aero-glass-card border border-white/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleResampling}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-lg transition-all shadow-xl ${
                isResampling ? 'aero-gel-btn-red animate-pulse' : 'aero-gel-btn-green'
              }`}
              aria-label={isResampling ? 'Stop Resampling' : 'Start Resampling'}
            >
              <div
                className={`transition-all ${
                  isResampling ? 'w-4 h-4 bg-white rounded-sm' : 'w-4 h-4 rounded-full bg-white shadow'
                }`}
              />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isResampling ? 'bg-red-500 animate-ping' : 'bg-emerald-400'
                  }`}
                />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  {isResampling ? 'RECORDING RESAMPLE' : 'READY TO RESAMPLE'}
                </span>
              </div>
              <p className="text-xl font-mono font-bold text-cyan-100 mt-0.5">
                {formatTime(elapsedSec)}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[11px] text-cyan-200/80">
              Format: <span className="font-mono text-white">16-bit 44.1kHz PCM .WAV</span>
            </p>
            <p className="text-[10px] text-cyan-300/60 mt-0.5">
              Twist knobs, scrub playhead & play notes while recording!
            </p>
          </div>
        </div>

        {/* Takes List */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 min-h-[140px]">
          <h3 className="text-xs font-bold text-cyan-200 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Music2 className="w-3.5 h-3.5" />
            Resampled Takes ({takes.length})
          </h3>

          {takes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-cyan-200/60 border border-white/10 rounded-xl bg-sky-950/20">
              <Radio className="w-8 h-8 text-cyan-400/40 mb-2" />
              <p className="text-xs font-medium text-cyan-100">No resampled takes recorded yet.</p>
              <p className="text-[11px] text-cyan-200/60 mt-1 max-w-xs">
                Press the green circle button above while playing sounds to create a downloadable .WAV file.
              </p>
            </div>
          ) : (
            takes.map((take) => (
              <div
                key={take.id}
                className="p-3 rounded-xl aero-glass-card border border-white/30 flex flex-col sm:flex-row items-center justify-between gap-3 hover:bg-sky-400/10 transition-all"
              >
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => handlePlayPreview(take)}
                    className="w-9 h-9 rounded-full aero-gel-btn flex items-center justify-center text-white shrink-0 shadow-md"
                    aria-label={playingTakeId === take.id ? 'Pause Preview' : 'Play Preview'}
                  >
                    {playingTakeId === take.id ? (
                      <Pause className="w-4 h-4 fill-white" />
                    ) : (
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    )}
                  </button>
                  <div className="truncate">
                    <h4 className="text-xs font-bold text-white truncate max-w-[180px]">
                      {take.name}
                    </h4>
                    <p className="text-[10px] font-mono text-cyan-200/70">
                      {formatTime(take.duration)} · {formatFileSize(take.sizeBytes)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {/* Download Button */}
                  <a
                    href={take.url}
                    download={`${take.name}.wav`}
                    className="aero-gel-btn px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 shadow-sm"
                    aria-label={`Download ${take.name}.wav`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download .WAV
                  </a>

                  {/* Load Back into Granulizer Button */}
                  <button
                    onClick={() => handleLoadBackToEngine(take)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${
                      loadedTakeId === take.id
                        ? 'bg-emerald-500 text-white border-emerald-300 shadow-md'
                        : 'bg-sky-900/60 text-cyan-100 border-white/20 hover:bg-sky-800/80'
                    }`}
                    title="Load this resample back into the Granulizer to layer and modulate recursively!"
                    aria-label="Load back into Granulizer"
                  >
                    {loadedTakeId === take.id ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        Loaded!
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-cyan-300" />
                        Load to Engine
                      </>
                    )}
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteTake(take.id)}
                    className="p-1.5 rounded-lg text-rose-300 hover:text-white hover:bg-rose-900/40 transition-colors"
                    aria-label="Delete Take"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
