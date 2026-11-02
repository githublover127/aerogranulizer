import React, { createContext, useContext, useState } from 'react';
import { Wifi, BatteryMedium, Signal, Smartphone, Monitor, Download } from 'lucide-react';
import { InstallModal } from './InstallModal';

interface DeviceFrameContextType {
  isPhoneFrame: boolean;
  setIsPhoneFrame: (val: boolean) => void;
}

const DeviceFrameContext = createContext<DeviceFrameContextType>({
  isPhoneFrame: false,
  setIsPhoneFrame: () => {},
});

export const useDeviceFrame = () => useContext(DeviceFrameContext);

interface IosDeviceFrameProps {
  children: React.ReactNode;
}

export const IosDeviceFrame: React.FC<IosDeviceFrameProps> = ({ children }) => {
  const [isPhoneFrame, setIsPhoneFrame] = useState<boolean>(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);

  // Current time for iOS status bar
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  return (
    <DeviceFrameContext.Provider value={{ isPhoneFrame, setIsPhoneFrame }}>
      <div className="min-h-screen w-full relative flex flex-col items-center justify-start overflow-x-hidden bg-gradient-to-b from-sky-400 via-cyan-500 to-sky-700 p-2 sm:p-4">
        {/* Background Animated Frutiger Aero Bubbles */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="bubble" style={{ left: '10%', width: '60px', height: '60px', animationDelay: '0s', animationDuration: '18s' }} />
          <div className="bubble" style={{ left: '25%', width: '90px', height: '90px', animationDelay: '4s', animationDuration: '22s' }} />
          <div className="bubble" style={{ left: '50%', width: '45px', height: '45px', animationDelay: '2s', animationDuration: '16s' }} />
          <div className="bubble" style={{ left: '75%', width: '110px', height: '110px', animationDelay: '7s', animationDuration: '25s' }} />
          <div className="bubble" style={{ left: '88%', width: '50px', height: '50px', animationDelay: '1s', animationDuration: '19s' }} />
        </div>

        {/* Top Floating App Bar with Frame Switcher & Install to Phone */}
        <header className="w-full max-w-4xl z-30 mb-2 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-full aero-glass-card shadow-lg border border-white/50 text-white">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full aero-gel-btn flex items-center justify-center font-bold text-xs shadow-inner">
              A
            </div>
            <span className="font-extrabold text-xs tracking-wider text-white drop-shadow">
              AEROGRAIN <span className="font-normal text-cyan-200">AUv3 iOS GRANULIZER</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Install to Phone Button */}
            <button
              onClick={() => setIsInstallModalOpen(true)}
              className="aero-gel-btn px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-sm text-white"
              aria-label="How to Add to your Phone"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Add to Phone</span>
            </button>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-sky-950/50 p-0.5 rounded-full border border-white/30 shadow-inner">
              <button
                onClick={() => setIsPhoneFrame(true)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                  isPhoneFrame
                    ? 'bg-gradient-to-r from-cyan-400 to-sky-500 text-sky-950 shadow-md'
                    : 'text-cyan-100 hover:text-white'
                }`}
                aria-label="iPhone AUv3 View"
              >
                <Smartphone className="w-3.5 h-3.5" />
                iPhone AUv3
              </button>
              <button
                onClick={() => setIsPhoneFrame(false)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                  !isPhoneFrame
                    ? 'bg-gradient-to-r from-cyan-400 to-sky-500 text-sky-950 shadow-md'
                    : 'text-cyan-100 hover:text-white'
                }`}
                aria-label="Studio Expand View"
              >
                <Monitor className="w-3.5 h-3.5" />
                Studio View
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Container (Phone Frame or Wide Studio Frame) */}
        <div
          className={`w-full z-10 transition-all duration-300 relative ${
            isPhoneFrame
              ? 'max-w-[430px] rounded-[52px] border-[10px] border-slate-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] bg-gradient-to-b from-sky-900/90 via-cyan-950/95 to-slate-950 overflow-hidden'
              : 'max-w-4xl rounded-3xl border border-white/50 shadow-2xl bg-gradient-to-b from-sky-900/90 via-cyan-950/90 to-slate-950/95 overflow-hidden'
          }`}
        >
          {/* iOS Status Bar */}
          {isPhoneFrame && (
            <div className="w-full pt-3 pb-1 px-7 flex items-center justify-between text-white text-xs select-none relative z-30">
              <span className="font-semibold text-[13px] tracking-tight">{timeStr}</span>
              {/* Dynamic Island Pill */}
              <div className="w-28 h-6 bg-black rounded-full flex items-center justify-end px-2.5 gap-2 border border-white/10 shadow-inner">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <div className="flex items-center gap-1.5 text-white/90">
                <Signal className="w-3.5 h-3.5" />
                <Wifi className="w-3.5 h-3.5" />
                <BatteryMedium className="w-4 h-4" />
              </div>
            </div>
          )}

          {/* Child App Interface with smooth iOS scroll */}
          <div className={`relative ${isPhoneFrame ? 'max-h-[720px] overflow-y-auto p-3 sm:p-4' : 'p-3 sm:p-5'}`}>
            {children}
          </div>

          {/* iOS Bottom Home Bar */}
          {isPhoneFrame && (
            <div className="w-full pb-3 pt-2 flex justify-center items-center pointer-events-none">
              <div className="w-36 h-1 bg-white/70 rounded-full shadow" />
            </div>
          )}
        </div>

        {/* In-App Installation Modal */}
        <InstallModal
          isOpen={isInstallModalOpen}
          onClose={() => setIsInstallModalOpen(false)}
        />
      </div>
    </DeviceFrameContext.Provider>
  );
};
