import React, { useState, useRef } from 'react';
import { engine } from '../audio/GranularEngine';
import { Upload, Mic, Music, X, Check, Disc, Volume2 } from 'lucide-react';

interface SampleManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSampleLoaded: (sampleName: string) => void;
}

const PRESETS = [
  {
    id: 'aquatic_chimes',
    name: 'Aquatic Chimes & Drops',
    desc: 'Crystal water droplets with E-maj9 bell chime harmonics',
    icon: '💧',
  },
  {
    id: 'aero_aurora',
    name: 'Aero Aurora Breeze',
    desc: 'Lush ethereal vocal pad with warm formant air',
    icon: '🌌',
  },
  {
    id: 'bioluminescent_forest',
    name: 'Bioluminescent Forest',
    desc: 'Organic wood clicks, glass insect chimes, moss bass drone',
    icon: '🌿',
  },
  {
    id: 'liquid_crystal',
    name: 'Liquid Crystal Bell',
    desc: 'Pure FM crystal bells with undulating frequency sheen',
    icon: '💎',
  },
  {
    id: 'glass_harp',
    name: 'Glass Harp Wave',
    desc: 'Friction harmonics of crystalline water glasses',
    icon: '✨',
  },
] as const;

export const SampleManagerModal: React.FC<SampleManagerModalProps> = ({
  isOpen,
  onClose,
  onSampleLoaded,
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'upload' | 'mic'>('presets');
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [micProgress, setMicProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = async (presetId: (typeof PRESETS)[number]['id'], name: string) => {
    setIsLoading(true);
    setStatusMessage(`Generating ${name}...`);
    try {
      await engine.loadPreset(presetId);
      onSampleLoaded(name);
      onClose();
    } catch (err) {
      console.error(err);
      setStatusMessage('Error loading preset');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setStatusMessage(`Decoding ${file.name}...`);
    try {
      await engine.loadAudioFile(file);
      onSampleLoaded(file.name.replace(/\.[^/.]+$/, ''));
      onClose();
    } catch (err) {
      console.error(err);
      setStatusMessage('Error decoding audio file. Please try another audio format.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordMic = async () => {
    if (isRecordingMic) return;
    setIsRecordingMic(true);
    setMicProgress(0);
    setStatusMessage('Recording microphone... Make some noise!');

    try {
      await engine.recordMicSample(4.0, (ratio) => {
        setMicProgress(ratio);
      });
      onSampleLoaded('Mic_Take_' + new Date().toLocaleTimeString().slice(0, 5));
      onClose();
    } catch (err) {
      console.error(err);
      setStatusMessage('Microphone access denied or error recording.');
    } finally {
      setIsRecordingMic(false);
      setMicProgress(0);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md select-none animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sample-modal-title"
    >
      <div className="aero-glass-panel w-full max-w-lg rounded-2xl p-5 relative overflow-hidden shadow-2xl border border-white/60">
        {/* Frutiger Aero Gloss Sheen */}
        <div className="absolute inset-0 aero-gloss-sheen pointer-events-none opacity-40" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/20">
          <div className="flex items-center gap-2">
            <Disc className="w-5 h-5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
            <h2 id="sample-modal-title" className="text-base font-bold text-white drop-shadow">
              Sample Library & Loader
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-cyan-200 hover:text-white hover:bg-sky-800/40 border border-white/20 transition-colors"
            aria-label="Close Sample Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 my-4 bg-sky-950/60 rounded-xl border border-white/20">
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'presets'
                ? 'bg-gradient-to-b from-sky-400 to-cyan-600 text-white shadow-md'
                : 'text-cyan-200/70 hover:text-white'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            Aero Presets
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'upload'
                ? 'bg-gradient-to-b from-sky-400 to-cyan-600 text-white shadow-md'
                : 'text-cyan-200/70 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Device File
          </button>
          <button
            onClick={() => setActiveTab('mic')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'mic'
                ? 'bg-gradient-to-b from-sky-400 to-cyan-600 text-white shadow-md'
                : 'text-cyan-200/70 hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            Live Mic
          </button>
        </div>

        {/* Tab 1: Presets */}
        {activeTab === 'presets' && (
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p.id, p.name)}
                disabled={isLoading}
                className="flex items-center justify-between p-3 rounded-xl aero-glass-card hover:bg-sky-400/20 text-left transition-all border border-white/30 group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{p.icon}</span>
                  <div>
                    <h3 className="text-xs font-bold text-white group-hover:text-cyan-200">
                      {p.name}
                    </h3>
                    <p className="text-[10px] text-cyan-200/70 mt-0.5">{p.desc}</p>
                  </div>
                </div>
                <Volume2 className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
              </button>
            ))}
          </div>
        )}

        {/* Tab 2: Upload from Phone / Device */}
        {activeTab === 'upload' && (
          <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-cyan-400/40 rounded-xl bg-sky-950/30 text-center p-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="audio/*"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full aero-gel-btn flex items-center justify-center text-white mb-3 shadow-lg">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">
              Upload Audio From Your Phone or Computer
            </h3>
            <p className="text-[11px] text-cyan-200/70 max-w-xs mb-4">
              Select any audio file (.WAV, .MP3, .M4A, .AAC, .OGG, .FLAC) from your device files, voice memos, or downloads.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="aero-gel-btn px-5 py-2 rounded-xl text-xs font-bold text-white uppercase tracking-wider"
            >
              Browse Audio Files
            </button>
          </div>
        )}

        {/* Tab 3: Microphone Live Record */}
        {activeTab === 'mic' && (
          <div className="flex flex-col items-center justify-center py-8 text-center p-4">
            <div className="relative mb-4">
              <button
                onClick={handleRecordMic}
                disabled={isRecordingMic || isLoading}
                className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-xl transition-all shadow-xl ${
                  isRecordingMic
                    ? 'aero-gel-btn-red scale-110 animate-pulse'
                    : 'aero-gel-btn-green'
                }`}
                aria-label="Start Microphone Recording"
              >
                <Mic className="w-8 h-8" />
              </button>
              {isRecordingMic && (
                <div
                  className="absolute -inset-2 rounded-full border-2 border-red-400 animate-ping"
                  style={{ animationDuration: '1.2s' }}
                />
              )}
            </div>

            <h3 className="text-sm font-bold text-white mb-1">
              {isRecordingMic ? 'Recording In Progress...' : 'Record 4-Second Live Voice or Sound'}
            </h3>
            <p className="text-[11px] text-cyan-200/70 max-w-xs mb-3">
              Hum, speak, snap fingers, or play an acoustic sound near your phone mic to granulate it instantly!
            </p>

            {isRecordingMic && (
              <div className="w-48 h-2 bg-sky-950 rounded-full overflow-hidden border border-white/20 mt-2">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-75"
                  style={{ width: `${micProgress * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Status bar */}
        {statusMessage && (
          <div className="mt-3 py-1.5 px-3 rounded-lg bg-sky-900/60 border border-white/20 text-center text-xs text-cyan-200">
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
};
