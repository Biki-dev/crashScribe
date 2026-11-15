import React from 'react';
import { Shield, Wifi, WifiOff, RefreshCw, Smartphone, Monitor } from 'lucide-react';
import { Officer } from '../types/auth.types';

interface TopBarProps {
  officer: Officer | null;
  isOnline: boolean;
  onToggleOnline: () => void;
  pendingCount: number;
  isMobileFrame: boolean;
  onToggleFrame: () => void;
  onNavigateToSync: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  officer,
  isOnline,
  onToggleOnline,
  pendingCount,
  isMobileFrame,
  onToggleFrame,
  onNavigateToSync,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 px-3 py-2.5 flex items-center justify-between sticky top-0 z-40 select-none shadow-md">
      {/* Brand & Officer Info */}
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
          <Shield className="w-4 h-4 fill-amber-500/20" />
        </div>
        <div>
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-sm tracking-wide text-white">CrashScribe</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-amber-400 font-medium rounded border border-slate-700">
              Assam Police
            </span>
          </div>
          {officer && (
            <div className="text-[11px] text-slate-400 leading-tight">
              {officer.name.split(' ')[0]} ({officer.official_id}) • {officer.police_station}
            </div>
          )}
        </div>
      </div>

      {/* Controls & Connection Status */}
      <div className="flex items-center space-x-2">
        {/* Pending Sync Badge Button */}
        {pendingCount > 0 && (
          <button
            onClick={onNavigateToSync}
            className="flex items-center space-x-1 px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded text-xs transition"
            title="Locally saved reports awaiting cloud sync"
          >
            <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
            <span className="font-semibold">{pendingCount}</span>
            <span className="hidden sm:inline text-[10px]">Pending</span>
          </button>
        )}

        {/* Connectivity Toggle Pill */}
        <button
          onClick={onToggleOnline}
          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-semibold border transition ${
            isOnline
              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40 hover:bg-emerald-900/60'
              : 'bg-rose-950/60 text-rose-400 border-rose-500/40 hover:bg-rose-900/60'
          }`}
          title="Click to simulate Airplane Mode / Offline field conditions"
        >
          {isOnline ? (
            <>
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span>ONLINE</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-rose-400" />
              <span>OFFLINE</span>
            </>
          )}
        </button>

        {/* Device Frame Viewport Toggle (for desktop testing) */}
        <button
          onClick={onToggleFrame}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition hidden md:block"
          title={isMobileFrame ? 'Switch to Full Screen View' : 'Switch to Mobile Device Frame'}
        >
          {isMobileFrame ? <Monitor className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
