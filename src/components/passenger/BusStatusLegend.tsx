'use client';

import {
  Compass,
  Bus,
  MapPin,
  Route,
  Clock,
  Hourglass,
  CheckCircle2,
  RefreshCw,
  Armchair,
  UserCheck,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Lock,
} from 'lucide-react';
import type { GreetingInfo, PasajeroData } from '@/types/passenger';
import type { PulserState } from '@/types/pulser';
import type { ClientLocation, RoadInfo } from '@/types/map';

interface BusStatusLegendProps {
  pasajero: PasajeroData;
  saludoInfo: GreetingInfo;
  estadoLegend: PulserState;
  clientGps: ClientLocation | null;
  roadInfo: RoadInfo | null;
  distanciaDirecta: string | null;
  lastUpdated: string | null;
  legendMinimized: boolean;
  onToggleMinimize: () => void;
  onOpenModal: () => void;
}

export function BusStatusLegend({
  pasajero,
  saludoInfo,
  estadoLegend,
  clientGps,
  roadInfo,
  distanciaDirecta,
  lastUpdated,
  legendMinimized,
  onToggleMinimize,
  onOpenModal,
}: BusStatusLegendProps) {
  const pulser = pasajero.coordenadasPulser;

  return (
    <div className="fixed bottom-0 inset-x-0 md:bottom-auto md:inset-x-auto md:top-4 md:right-4 z-[1000] md:w-[385px] transition-all duration-300">
      <div className="bg-slate-900/95 backdrop-blur-xl rounded-t-2xl md:rounded-2xl shadow-2xl shadow-slate-950/70 border-t md:border border-slate-700/80 overflow-hidden text-slate-200">
        {/* Header del Panel */}
        <div
          onClick={onToggleMinimize}
          className="px-4 py-3 bg-slate-800/90 flex items-center justify-between border-b border-slate-700/80 cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white p-1 border border-slate-200/80 shadow-sm flex items-center justify-center shrink-0">
              <img src="/logo-icon.png" alt="Pointly" className="h-full w-full object-contain" />
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                <span>{saludoInfo.saludoCompleto}</span>
              </h3>
              <p className="text-[11px] text-slate-300 font-medium truncate max-w-[190px]">
                {pasajero.nombre}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Resumen visible en móvil cuando está colapsado */}
            {legendMinimized && (
              <span className="text-xs font-mono font-bold text-blue-300 md:hidden flex items-center gap-1">
                <Route className="w-3 h-3 text-blue-400" />
                {roadInfo?.distance || distanciaDirecta}
              </span>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleMinimize();
              }}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-slate-200 transition-colors font-medium flex items-center gap-1"
            >
              <span>{legendMinimized ? 'Detalles' : 'Ocultar'}</span>
              {legendMinimized ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenModal();
              }}
              className="hidden md:block text-xs px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors shadow-sm shadow-emerald-600/30"
              title="Cambiar o consultar otro DNI"
            >
              DNI
            </button>
          </div>
        </div>

        {/* Contenido Completo de la Leyenda */}
        {!legendMinimized && (
          <div className="p-3.5 space-y-3 max-h-[62vh] md:max-h-[80vh] overflow-y-auto">
            {/* 0. TARJETA DE SALUDO Y BIENVENIDA */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-slate-800/80 border border-emerald-500/30 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30 shrink-0">
                  <Sparkles className="w-5 h-5 text-emerald-200 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-emerald-300">
                      {saludoInfo.saludoCompleto}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-200 font-medium truncate">
                    {pasajero.nombre}
                  </p>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {saludoInfo.mensajeBienvenida}
                  </span>
                </div>
              </div>
            </div>

            {/* A. TARJETA DEL ESTADO DEL BUS (PULSER) */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                estadoLegend === 'LLEGO'
                  ? 'bg-emerald-950/25 border-emerald-500/30'
                  : estadoLegend === 'SALIDA'
                  ? 'bg-amber-950/25 border-amber-500/30'
                  : 'bg-sky-950/25 border-sky-500/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider ${
                    estadoLegend === 'LLEGO'
                      ? 'text-emerald-300'
                      : estadoLegend === 'SALIDA'
                      ? 'text-amber-300'
                      : 'text-sky-300'
                  }`}
                >
                  Estado del Bus (Pulser)
                </span>

                {/* BADGE DINÁMICO */}
                {estadoLegend === 'LLEGO' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    YA LLEGÓ
                  </span>
                )}

                {estadoLegend === 'SALIDA' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300">
                    <Hourglass className="w-3 h-3 text-amber-400 animate-pulse" />
                    EN RUTA
                  </span>
                )}

                {estadoLegend === 'EN_CAMINO' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/20 border border-sky-500/40 text-sky-300">
                    <RefreshCw className="w-3 h-3 text-sky-400 animate-spin" />
                    EN CAMINO
                  </span>
                )}
              </div>

              {/* Detalle contextual según estado */}
              {estadoLegend === 'LLEGO' && (
                <div className="pt-0.5">
                  <p className="text-[11px] text-slate-300 leading-tight">
                    {pulser?.estadoTexto || `El bus se encuentra en la zona de abordaje de ${pasajero.punto}.`}
                  </p>
                </div>
              )}

              {estadoLegend === 'SALIDA' && (
                <div className="space-y-2 pt-0.5">
                  <p className="text-[11px] text-slate-300 leading-tight">
                    {pulser?.estadoTexto || `El bus completó salida de ${pasajero.punto} y se encuentra en ruta.`}
                  </p>

                  {/* SIGUIENTE PARADERO CON VECTOR SVG */}
                  <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">
                        Próximo punto de abordaje:
                      </span>
                      <span className="font-bold text-amber-300 text-xs">
                        {pasajero.siguientePunto || 'Siguiente Estación'}
                      </span>
                    </div>
                    <div className="w-6 h-6 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                      <Hourglass className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    </div>
                  </div>
                </div>
              )}

              {estadoLegend === 'EN_CAMINO' && (
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-sky-300 font-medium">
                    <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                    <span>{pulser?.estadoTexto || `El bus se dirige a ${pasajero.punto}`}</span>
                  </div>
                </div>
              )}

              {/* ITINERARIO SECUENCIAL DE PARADAS */}
              {pulser?.historialPuntos && pulser.historialPuntos.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-700/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide flex items-center gap-1">
                      <Route className="w-3 h-3 text-slate-400" />
                      Paradas de la ruta
                    </span>
                    <span className="text-[9px] text-slate-500">
                      {pulser.historialPuntos.length} puntos
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {pulser.historialPuntos.map((pto) => {
                      const esMiParada = pto.punto.toUpperCase().trim() === pasajero.punto?.toUpperCase().trim();
                      const tieneHoras = Boolean(pto.horaLlegada || pto.horaSalida);
                      const esBloqueada = pto.estado === 'BLOQUEADA' || Boolean(pto.horaSalida);
                      const esEnParada = pto.estado === 'EN_PARADA' || (Boolean(pto.horaLlegada) && !pto.horaSalida);
                      const esEnCamino = pto.estado === 'EN_CAMINO' || (!esBloqueada && !esEnParada && !tieneHoras && pto.idx === 0);

                      return (
                        <div
                          key={pto.idx}
                          className={`p-2 rounded-lg text-xs transition-all ${
                            esMiParada
                              ? 'bg-amber-950/20 border border-amber-500/50 shadow-sm ring-1 ring-amber-500/20'
                              : esBloqueada
                              ? 'bg-slate-900/60 border border-slate-800 opacity-75'
                              : esEnParada
                              ? 'bg-emerald-950/30 border border-emerald-500/40 shadow-sm'
                              : esEnCamino
                              ? 'bg-sky-950/30 border border-sky-500/40 shadow-sm'
                              : 'bg-slate-900/40 border border-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className={`font-semibold flex items-center gap-1.5 ${esMiParada ? 'text-amber-300 font-bold' : esBloqueada ? 'text-slate-300' : esEnParada ? 'text-emerald-300' : esEnCamino ? 'text-sky-300' : 'text-slate-400'}`}>
                              {esBloqueada ? (
                                <Lock className="w-3 h-3 text-slate-400" />
                              ) : esEnParada ? (
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                              ) : esEnCamino ? (
                                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                              )}
                              <span>{pto.punto}</span>
                              {esMiParada && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/25 text-amber-300 border border-amber-500/40 font-semibold">
                                  Tu Parada
                                </span>
                              )}
                            </span>

                            {/* Badges contextuales de parada */}
                            {esBloqueada && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-800/90 border border-slate-700">
                                <Lock className="w-2.5 h-2.5 text-slate-400" />
                                Bloqueada
                              </span>
                            )}
                            {esEnParada && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                                En Parada
                              </span>
                            )}
                            {esEnCamino && !esEnParada && !esBloqueada && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-300 px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-500/40">
                                <RefreshCw className="w-2.5 h-2.5 text-sky-400 animate-spin" />
                                En Camino
                              </span>
                            )}
                            {!esBloqueada && !esEnParada && !esEnCamino && (
                              <span className="text-[10px] font-medium text-slate-500">
                                Pendiente
                              </span>
                            )}
                          </div>

                          {tieneHoras ? (
                            <div className="grid grid-cols-2 gap-1.5 mt-1 pt-1 border-t border-slate-800/80 text-[10px]">
                              <div className="flex items-center gap-1 text-slate-300">
                                <span className="text-slate-400 font-medium">Llegada:</span>
                                <span className="font-mono font-bold text-emerald-400">
                                  {pto.horaLlegada || '—'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-slate-300">
                                <span className="text-slate-400 font-medium">Salida:</span>
                                <span className={`font-mono font-bold ${esBloqueada ? 'text-slate-300' : 'text-amber-300'}`}>
                                  {pto.horaSalida || '—'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic block mt-0.5">
                              {esEnCamino ? 'Próxima parada en curso' : 'Pendiente en la ruta'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* B. TARJETA PRINCIPAL: RUTA PARA IR AL BUS */}
            <div className="p-3 rounded-xl bg-slate-800/70 border border-blue-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                    <Compass className="w-3.5 h-3.5 text-blue-400 animate-spin-slow" />
                  </div>
                  <span>Ruta para ir al Bus</span>
                </div>

                <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-mono font-bold text-xs border border-blue-500/40">
                  {roadInfo?.distance || distanciaDirecta || 'En curso'}
                </span>
              </div>

              {/* Métricas de tiempo y distancia */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Route className="w-3 h-3 text-slate-400" />
                    Distancia estimada
                  </span>
                  <span className="font-bold text-blue-300 text-xs block mt-0.5">
                    {roadInfo?.distance || distanciaDirecta || 'Calculando'}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    Tiempo aproximado
                  </span>
                  <span className="font-bold text-blue-300 text-xs block mt-0.5">
                    {roadInfo?.duration || '~5-8 min'}
                  </span>
                </div>
              </div>
            </div>

            {/* C. SIMBOLOGÍA VISUAL DEL MAPA */}
            <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">
                Simbología del Mapa
              </span>

              {/* Pin 1: GPS Pasajero */}
              <div className="flex items-center gap-2.5 text-xs">
                <div className="relative flex h-5 w-5 items-center justify-center shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400/40"></span>
                  <div className="relative w-4 h-4 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center shadow-sm shadow-blue-500/40">
                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                  </div>
                </div>
                <div className="flex-1">
                  <span className="font-semibold text-slate-200">
                    Tu Ubicación (GPS)
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {clientGps ? 'Señal GPS activa' : 'Esperando GPS'}
                  </span>
                </div>
              </div>

              {/* Pin 2: Bus en Vivo */}
              <div className="flex items-center gap-2.5 text-xs">
                <div className="relative flex h-5 w-5 items-center justify-center shrink-0">
                  <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400/30"></span>
                  <div className="relative w-5 h-5 rounded-full bg-gradient-to-tr from-amber-600 to-amber-500 border border-white flex items-center justify-center text-white shadow-sm shadow-amber-500/40">
                    <Bus className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <span className="font-semibold text-slate-200">
                    Bus
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {pulser
                      ? pulser.horaSalida
                        ? `Salida: ${pulser.horaSalida}`
                        : pulser.horaLlegada
                        ? `Llegada: ${pulser.horaLlegada}`
                        : `Transmitiendo (${pulser.horaGenerada || 'Activo'})`
                      : 'Esperando señal'}
                  </span>
                </div>
              </div>

              {/* Pin 3: Línea de Ruta para ir al Bus */}
              <div className="flex items-center gap-2.5 text-xs">
                <div className="w-5 h-5 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <Route className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <span className="font-semibold text-blue-400">
                    Ruta hacia el Bus
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Trazado vial continuo por avenidas
                  </span>
                </div>
              </div>

              {/* Pin 4: Zona de Abordaje */}
              {pasajero.coordenadasAbordaje && (
                <div className="flex items-center gap-2.5 text-xs">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 border border-white flex items-center justify-center shadow-sm shadow-emerald-500/40 shrink-0">
                    <MapPin className="w-3 h-3 text-white" />
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold text-slate-200">
                      Punto de Abordaje ({pasajero.punto})
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {pasajero.coordenadasAbordaje.nombreLugar || pasajero.punto}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* D. ASIENTO Y DETALLES */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Armchair className="w-3 h-3 text-slate-400" />
                  Asiento
                </span>
                <span className="font-bold text-white text-xs block mt-0.5">
                  {pasajero.asiento ? `Asiento #${pasajero.asiento}` : 'Asignación Libre'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-emerald-400" />
                  Operación
                </span>
                <span className="font-bold text-emerald-400 text-xs uppercase block mt-0.5">
                  {pasajero.tipo || 'Subida'}
                </span>
              </div>
            </div>

            {/* E. FOOTER: HORA DE SINCRONIZACIÓN AUTOMÁTICA */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Sincronizado:</span>
                <strong className="text-slate-200 font-mono">{lastUpdated || '--:--:--'}</strong>
              </span>

              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium select-none">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-slate-400">En segundo plano</span>
              </div>
            </div>

            {/* Branding Footer */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-[10px] text-slate-500 select-none">
              <img src="/logo-icon.png" alt="Pointly" className="h-3 w-auto opacity-70" />
              <span>Pointly · Sistema Inteligente de Abordaje</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
