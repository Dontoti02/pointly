'use client';

import { Sparkles, X } from 'lucide-react';
import type { GreetingInfo } from '@/types/passenger';

interface WelcomeToastProps {
  show: boolean;
  saludoInfo: GreetingInfo;
  onClose: () => void;
}

export function WelcomeToast({ show, saludoInfo, onClose }: WelcomeToastProps) {
  if (!show) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1100] w-[92%] max-w-md animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/95 border border-emerald-500/40 shadow-2xl backdrop-blur-xl text-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/30 shrink-0">
            <Sparkles className="w-5 h-5 text-emerald-200 animate-pulse" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
              <span>{saludoInfo.saludoCompleto}</span>
            </h4>
            <p className="text-[11px] text-emerald-300 truncate">
              {saludoInfo.mensajeBienvenida}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          title="Cerrar saludo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
