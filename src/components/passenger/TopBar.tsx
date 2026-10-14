'use client';

import {
  LocateFixed,
  Route,
  Hourglass,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import type { GreetingInfo, PasajeroData } from '@/types/passenger';
import type { PulserState } from '@/types/pulser';
import type { RoadInfo } from '@/types/map';

interface TopBarProps {
  pasajero: PasajeroData | null;
  isModalOpen: boolean;
  saludoInfo: GreetingInfo;
  estadoLegend: PulserState;
  roadInfo: RoadInfo | null;
  distanciaDirecta: string | null;
  onOpenModal: () => void;
  onRecenter: () => void;
}

export function TopBar({
  pasajero,
  isModalOpen,
  saludoInfo,
  estadoLegend,
  roadInfo,
  distanciaDirecta,
  onOpenModal,
  onRecenter,
}: TopBarProps) {
  return (
    <>
      {/* 1. BRAND BADGE FLOTANTE (Identificador de Marca Pointly en Pantalla Completa Desktop) */}
      <div className="absolute top-4 left-4 z-[990] hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 shadow-2xl text-white select-none">
        <div className="h-7 w-7 rounded-xl bg-white p-1 flex items-center justify-center shadow-sm shrink-0">
          <img src="/logo-icon.png" alt="Pointly" className="h-full w-full object-contain" />
        </div>
        <div className="flex flex-col pr-1">
          <span className="text-xs font-black tracking-wider text-white leading-none">
            POINTLY
          </span>
          <span className="text-[9px] font-medium text-emerald-400 leading-tight flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Monitoreo en Tiempo Real
          </span>
        </div>
      </div>

      {/* 2. BOTÓN FLOTANTE RÁPIDO PARA CENTRAR LA RUTA */}
      {pasajero && !isModalOpen && (
        <button
          type="button"
          onClick={onRecenter}
          className="absolute bottom-24 md:bottom-6 right-4 z-[990] p-3 rounded-full bg-slate-900/95 text-white border border-slate-700/80 shadow-2xl backdrop-blur-xl hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-2.5 group hover:border-blue-500/50"
          title="Centrar mapa en la ruta"
        >
          <div className="relative flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-blue-400/40"></span>
            <LocateFixed className="w-5 h-5 text-blue-400 group-hover:rotate-45 transition-transform duration-300 relative" />
          </div>
          <span className="hidden md:inline text-xs font-semibold pr-1">Centrar Ruta</span>
        </button>
      )}

      {/* 3. BARRA DE ESTADO COMPACTA SUPERIOR EN MÓVIL */}
      {pasajero && !isModalOpen && (
        <div className="md:hidden absolute top-3 inset-x-3 z-[1000] flex items-center justify-between p-2 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 shadow-lg text-xs">
          <div className="flex items-center gap-2 truncate">
            <div className="h-6 w-6 rounded-lg bg-white p-0.5 shrink-0 flex items-center justify-center shadow-sm">
              <img src="/logo-icon.png" alt="Pointly" className="h-full w-full object-contain" />
            </div>
            <span className="font-bold text-slate-200 truncate">
              {saludoInfo.saludoCompleto}
            </span>
            {estadoLegend === 'SALIDA' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <Hourglass className="w-2.5 h-2.5 animate-pulse" />
                EN RUTA
              </span>
            ) : estadoLegend === 'LLEGO' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <CheckCircle2 className="w-2.5 h-2.5" />
                YA LLEGÓ
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                EN CAMINO
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono font-bold text-blue-300 text-[11px] flex items-center gap-1">
              <Route className="w-3 h-3 text-blue-400" />
              {roadInfo?.distance || distanciaDirecta || ''}
            </span>
            <button
              onClick={onOpenModal}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition-colors"
            >
              DNI
            </button>
          </div>
        </div>
      )}

      {/* 4. BOTÓN FLOTANTE PARA VOLVER A ABRIR LA CONSULTA SI SE CERRÓ SIN PASAJERO */}
      {!isModalOpen && !pasajero && (
        <div className="absolute top-4 right-4 z-[1000]">
          <button
            onClick={onOpenModal}
            className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xl flex items-center gap-2 transition-all"
          >
            <Route className="w-4 h-4 text-white" />
            <span>Consultar mi Abordaje</span>
          </button>
        </div>
      )}
    </>
  );
}
