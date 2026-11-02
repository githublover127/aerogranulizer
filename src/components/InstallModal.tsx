import React, { useState } from 'react';
import { Smartphone, Share, PlusSquare, Copy, Check, X, QrCode } from 'lucide-react';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallModal: React.FC<InstallModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Prefer shared/preview app URL or current window URL
  const appUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://ais-pre-jso5tt3w74yy2pzuvhj225-312509307723.europe-west1.run.app';

  // Public QR Code API for scanning directly with phone camera
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    appUrl
  )}&bgcolor=2-28-55&color=56-189-248`;

  const handleCopy = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md select-none animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-modal-title"
    >
      <div className="aero-glass-panel w-full max-w-lg rounded-3xl p-5 sm:p-6 relative overflow-hidden shadow-2xl border border-white/60 flex flex-col max-h-[92vh]">
        {/* Frutiger Aero Gloss Sheen */}
        <div className="absolute inset-0 aero-gloss-sheen pointer-events-none opacity-40" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full aero-gel-btn flex items-center justify-center text-white shadow-md">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2 id="install-modal-title" className="text-base font-bold text-white drop-shadow">
                Add AeroGrain to Your Phone
              </h2>
              <p className="text-[11px] text-cyan-200/80">
                Install as a standalone home screen app (iOS & Android)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-cyan-200 hover:text-white hover:bg-sky-800/40 border border-white/20 transition-colors"
            aria-label="Close Install Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto pr-1 flex flex-col gap-4 my-3">
          {/* Quick Connect & Scan Box */}
          <div className="aero-glass-card rounded-2xl p-4 border border-white/30 flex flex-col sm:flex-row items-center gap-4 bg-sky-950/40">
            <div className="w-28 h-28 bg-slate-900/90 rounded-xl p-1.5 border border-cyan-400/30 flex items-center justify-center shadow-lg shrink-0">
              <img
                src={qrUrl}
                alt="Scan with phone camera to open AeroGrain"
                className="w-full h-full rounded-lg"
              />
            </div>
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-200">
                <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>Scan with your Phone's Camera</span>
              </div>
              <p className="text-[11px] text-cyan-100/80 leading-relaxed">
                Point your iPhone or Android camera at the QR code to open the link directly on your phone.
              </p>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  readOnly
                  value={appUrl}
                  className="bg-sky-950/80 text-cyan-200 text-xs px-2.5 py-1.5 rounded-lg border border-white/20 font-mono truncate w-full select-all"
                />
                <button
                  onClick={handleCopy}
                  className="aero-gel-btn px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1 shrink-0 shadow-sm"
                  aria-label="Copy Link"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* iOS Safari Step-by-Step Instructions */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-200 flex items-center gap-1.5">
              <span>iPhone & iPad (Safari Instructions)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="aero-glass-card p-3 rounded-xl border border-white/20 flex flex-col items-center text-center">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center mb-1.5 border border-cyan-400/30">
                  1
                </div>
                <p className="text-xs font-bold text-white mb-0.5">Open in Safari</p>
                <p className="text-[10px] text-cyan-200/70">
                  Open this link in Apple Safari (not Chrome or in-app browser).
                </p>
              </div>

              <div className="aero-glass-card p-3 rounded-xl border border-white/20 flex flex-col items-center text-center">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center mb-1.5 border border-cyan-400/30">
                  <Share className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-white mb-0.5">Tap Share</p>
                <p className="text-[10px] text-cyan-200/70">
                  Tap the <strong className="text-white">Share</strong> button (square with arrow pointing up) at the bottom.
                </p>
              </div>

              <div className="aero-glass-card p-3 rounded-xl border border-white/20 flex flex-col items-center text-center">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center mb-1.5 border border-cyan-400/30">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-white mb-0.5">Add to Home Screen</p>
                <p className="text-[10px] text-cyan-200/70">
                  Tap <strong className="text-white">"Add to Home Screen"</strong>, then tap <strong className="text-white">"Add"</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Android Note */}
          <div className="aero-glass-card p-3 rounded-xl border border-white/20 text-left">
            <h4 className="text-xs font-bold text-white mb-1">On Android (Google Chrome)</h4>
            <p className="text-[11px] text-cyan-200/80 leading-relaxed">
              Tap the 3 dots menu <strong className="text-white">⋮</strong> in the top-right corner of Chrome, then select <strong className="text-white">"Install app"</strong> or <strong className="text-white">"Add to Home screen"</strong>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-white/20 flex justify-end">
          <button
            onClick={onClose}
            className="aero-gel-btn px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md uppercase tracking-wider"
          >
            Got It!
          </button>
        </div>
      </div>
    </div>
  );
};
