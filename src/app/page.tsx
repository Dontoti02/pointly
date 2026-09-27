'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  BoardingPoint,
  ClientLocation,
  BusLocation,
} from '@/components/Map';
import {
  Compass,
  Bus,
  MapPin,
  Route,
  Clock,
  Hourglass,
  CheckCircle2,
  RefreshCw,
  LocateFixed,
  AlertCircle,
  Armchair,
  UserCheck,
  ChevronUp,
  ChevronDown,
  Navigation,
  X,
  Radio,
  Sparkles,
} from 'lucide-react';

// Dynamic import of Map to prevent SSR "window is not defined" error
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500"></div>
        <p className="text-sm font-medium tracking-wide text-slate-300">Cargando mapa interactivo...</p>
      </div>
    </div>
  ),
});

interface PasajeroData {
  nombre: string;
  punto: string;
  abordo: boolean;
  asiento: number | null;
  tipo: string | null;
  uidpulser: string | null;
  siguientePunto?: string | null;
  puntosRuta?: string[];
  coordenadasAbordaje?: BoardingPoint | null;
  coordenadasPulser: BusLocation | null;
}

// Función para generar un saludo cálido y personalizado según la hora y nombre del pasajero
function getSaludoPasajero(nombreCompleto?: string) {
  if (!nombreCompleto) {
    return {
      saludoCompleto: '¡Hola! Bienvenido',
      nombrePila: 'Pasajero',
      saludoTiempo: '¡Hola!',
      mensajeBienvenida: 'Bienvenido a Pointly. Aquí puedes monitorear tu bus en tiempo real.',
    };
  }

  const hora = new Date().getHours();
  let saludoTiempo = '¡Buenas tardes';
  if (hora >= 5 && hora < 12) {
    saludoTiempo = '¡Buenos días';
  } else if (hora >= 12 && hora < 19) {
    saludoTiempo = '¡Buenas tardes';
  } else {
    saludoTiempo = '¡Buenas noches';
  }

  const palabras = nombreCompleto
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());

  // En manifiestos oficiales peruanos: ApellidoP ApellidoM Nombre1 [Nombre2]
  let nombrePila = palabras[0];
  if (palabras.length >= 3) {
    nombrePila = palabras[2];
  } else if (palabras.length === 2) {
    nombrePila = palabras[1];
  }

  return {
    saludoCompleto: `${saludoTiempo}, ${nombrePila}!`,
    nombrePila,
    saludoTiempo,
    mensajeBienvenida: `Bienvenido a tu viaje, ${nombrePila}. Tu ruta y bus están activos.`,
    nombreCompletoFormateado: palabras.join(' '),
  };
}

export default function HomePage() {
  // Estados del formulario de consulta
  const [dni, setDni] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados del pasajero validado
  const [pasajero, setPasajero] = useState<PasajeroData | null>(null);
  const [showWelcomeToast, setShowWelcomeToast] = useState(false);
  const [clientGps, setClientGps] = useState<ClientLocation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [legendMinimized, setLegendMinimized] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Control de centrado sin interferir con la navegación libre
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  // Información calculada por la API de ruteo
  const [roadInfo, setRoadInfo] = useState<{
    distance: string;
    duration: string;
    summary?: string;
    roadFound: boolean;
  } | null>(null);

  // Saludo dinámico según la hora y nombre del pasajero
  const saludoInfo = useMemo(() => {
    return getSaludoPasajero(pasajero?.nombre);
  }, [pasajero?.nombre]);

  // Obtener geolocalización del cliente de forma segura
  const obtenerGpsCliente = useCallback(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setClientGps({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setRecenterTrigger((prev) => prev + 1);
        },
        (err) => {
          console.warn('Aviso de GPS del navegador:', err.message);
          // Si el navegador deniega el GPS y estamos consultando el registro de prueba en Piura,
          // inicializamos una ubicación cercana por defecto en Piura para que la ruta siempre sea visible
          setClientGps((prev) => prev || { lat: -5.2045, lng: -80.6300 });
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      // Fallback predeterminado cerca al bus
      setClientGps((prev) => prev || { lat: -5.2045, lng: -80.6300 });
    }
  }, []);

  // Efecto inicial para solicitar GPS del cliente
  useEffect(() => {
    obtenerGpsCliente();
  }, [obtenerGpsCliente]);

  // Consulta segura al endpoint del servidor
  const handleConsultar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const dniLimpio = dni.trim();
    if (!dniLimpio || dniLimpio.length < 6) {
      setErrorMsg('Por favor ingrese un número de DNI válido.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dni: dniLimpio,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || 'No se pudo verificar el DNI ingresado.');
        setLoading(false);
        return;
      }

      setPasajero(data.pasajero);
      setShowWelcomeToast(true);
      setTimeout(() => {
        setShowWelcomeToast(false);
      }, 7000);
      setLastUpdated(
        new Date().toLocaleTimeString('es-PE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setIsModalOpen(false);
      obtenerGpsCliente();
      // Enfoca la ruta al cargar
      setRecenterTrigger((prev) => prev + 1);
    } catch (err: any) {
      setErrorMsg('Error de conexión al consultar el servicio. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Re-consultar la posición activa del pulser
  const refrescarUbicacion = useCallback(async () => {
    if (!dni) return;
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni }),
      });
      const data = await res.json();
      if (data.ok && data.pasajero) {
        setPasajero(data.pasajero);
        setLastUpdated(
          new Date().toLocaleTimeString('es-PE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      }
    } catch {
      // Silencioso en refresco periódico
    } finally {
      setIsRefreshing(false);
    }
  }, [dni]);

  // Auto-polling cada 4 segundos para sincronizar en tiempo real cuando el pulser actualiza la hora
  useEffect(() => {
    if (!pasajero || !dni || isModalOpen) return;
    const interval = setInterval(() => {
      refrescarUbicacion();
    }, 4000);
    return () => clearInterval(interval);
  }, [pasajero, dni, isModalOpen, refrescarUbicacion]);

  // Distancia directa calculada en tiempo real hacia donde está el bus
  const distanciaDirecta = useMemo(() => {
    const destino =
      pasajero?.coordenadasPulser ||
      (pasajero?.coordenadasAbordaje?.lat && pasajero?.coordenadasAbordaje?.lng
        ? pasajero.coordenadasAbordaje
        : null);
    if (!clientGps || !destino) return null;

    const R = 6371; // Radio terrestre en km
    const dLat = ((destino.lat - clientGps.lat) * Math.PI) / 180;
    const dLon = ((destino.lng - clientGps.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((clientGps.lat * Math.PI) / 180) *
        Math.cos((destino.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;

    if (d < 1) {
      return `${Math.round(d * 1000)} metros`;
    }
    return `${d.toFixed(1)} km`;
  }, [clientGps, pasajero]);

  // Lógica del estado del Pulser para la leyenda
  const pulser = pasajero?.coordenadasPulser;
  const tieneHoraGenerada = Boolean(pulser?.horaGenerada);
  const pulserActivo = pulser?.activo === true || (pulser?.activo !== false && pulser?.activo !== 'false');

  // Estados:
  // Se prioriza el estado calculado por el servidor (validando ubicaciones1 y ubicaciones de forma estricta)
  const estadoLegend: 'LLEGO' | 'SALIDA' | 'EN_CAMINO' =
    pulser?.estado ||
    (!pulserActivo
      ? 'SALIDA'
      : tieneHoraGenerada
      ? 'LLEGO'
      : 'EN_CAMINO');

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans touch-auto">
      {/* 1. MAPA A PANTALLA COMPLETA INTERACTIVO (100% LIBRE PARA NAVEGAR CON MOUSE O TOUCH) */}
      <div className="absolute inset-0 w-full h-full z-0 touch-auto">
        <Map
          boardingPoint={pasajero?.coordenadasAbordaje || null}
          clientLocation={clientGps}
          busLocation={pasajero?.coordenadasPulser || null}
          passengerName={pasajero?.nombre}
          recenterTrigger={recenterTrigger}
          onRouteCalculated={(info) => {
            setRoadInfo(info);
          }}
          center={
            pasajero?.coordenadasPulser
              ? [pasajero.coordenadasPulser.lat, pasajero.coordenadasPulser.lng]
              : pasajero?.coordenadasAbordaje?.lat && pasajero?.coordenadasAbordaje?.lng
              ? [pasajero.coordenadasAbordaje.lat, pasajero.coordenadasAbordaje.lng]
              : [-5.22638, -80.62445]
          }
          zoom={pasajero ? 14 : 12}
        />
      </div>

      {/* 2.1 NOTIFICACIÓN FLOTANTE DE SALUDO Y BIENVENIDA AL ENCONTRAR */}
      {showWelcomeToast && pasajero && (
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
              onClick={() => setShowWelcomeToast(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
              title="Cerrar saludo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. VENTANA FLOTANTE DE CONSULTA (MODAL INICIAL / BÚSQUEDA) */}
      {isModalOpen && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header del Modal con Logo Oficial Pointly */}
            <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-6 text-white text-center relative border-b border-slate-800/90">
              <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white shadow-xl shadow-blue-500/10 mx-auto mb-3 border border-slate-100">
                <img
                  src="/logo.png"
                  alt="Pointly"
                  className="h-12 w-auto object-contain"
                />
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
                <span>Pointly</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">
                  En Vivo
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Consulte con su DNI su zona de abordaje y la ruta continua hacia el bus
              </p>

              {pasajero && (
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Cerrar modal"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Formulario solo DNI */}
            <form onSubmit={handleConsultar} className="p-6 space-y-4">
              {/* Saludo si ya se ha consultado a una persona */}
              {pasajero && (
                <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-slate-800/80 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-white block">
                      {saludoInfo.saludoCompleto}
                    </span>
                    <span className="text-[11px] text-emerald-300">
                      Ya estás monitoreando tu ruta activa. Puedes consultar otro DNI si deseas.
                    </span>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Número de Documento (DNI)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={12}
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    placeholder="Ingrese su DNI (ej. 70123456)"
                    required
                    autoFocus
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/90 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Verificando manifiesto...</span>
                  </>
                ) : (
                  <>
                    <Route className="w-4 h-4 text-white" />
                    <span>Ver Mi Abordaje y Ruta</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2.5 BRAND BADGE FLOTANTE (Identificador de Marca Pointly en Pantalla Completa) */}
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

      {/* 3. BOTÓN FLOTANTE RÁPIDO PARA CENTRAR LA RUTA (Sin emojis, vector SVG con micro-animación) */}
      {pasajero && !isModalOpen && (
        <button
          type="button"
          onClick={() => setRecenterTrigger((prev) => prev + 1)}
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

      {/* 4. BARRA DE ESTADO COMPACTA SUPERIOR EN MÓVIL */}
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
                SALIDA
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
              onClick={() => setIsModalOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition-colors"
            >
              DNI
            </button>
          </div>
        </div>
      )}

      {/* 5. LEYENDA Y PANEL DE NAVEGACIÓN (Top-Right en Desktop, Bottom Sheet en Móvil) */}
      {pasajero && !isModalOpen && (
        <div className="fixed bottom-0 inset-x-0 md:bottom-auto md:inset-x-auto md:top-4 md:right-4 z-[1000] md:w-[385px] transition-all duration-300">
          <div className="bg-slate-900/95 backdrop-blur-xl rounded-t-2xl md:rounded-2xl shadow-2xl shadow-slate-950/70 border-t md:border border-slate-700/80 overflow-hidden text-slate-200">
            {/* Header del Panel */}
            <div
              onClick={() => setLegendMinimized(!legendMinimized)}
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
                    setLegendMinimized(!legendMinimized);
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
                    setIsModalOpen(true);
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
                        SALIDA
                      </span>
                    )}

                    {estadoLegend === 'EN_CAMINO' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/20 border border-sky-500/40 text-sky-300">
                        <RefreshCw className="w-3 h-3 text-sky-400 animate-spin" />
                        EN CAMINO
                      </span>
                    )}
                  </div>

                  {/* 1. CASO: YA LLEGÓ */}
                  {estadoLegend === 'LLEGO' && (
                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-slate-300 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          Hora de llegada:
                        </span>
                        <span className="text-sm font-extrabold font-mono text-emerald-400">
                          {pulser?.horaGenerada}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-tight">
                        El bus se encuentra en la zona de abordaje de <strong>{pasajero.punto}</strong>.
                      </p>
                    </div>
                  )}

                  {/* 2. CASO: SALIDA */}
                  {estadoLegend === 'SALIDA' && (
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-slate-300 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          Hora de salida:
                        </span>
                        <span className="text-sm font-extrabold font-mono text-amber-300">
                          {pulser?.horaGenerada || 'Registrada'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-tight">
                        El pulser ha marcado salida de <strong>{pasajero.punto}</strong>.
                      </p>

                      {/* SIGUIENTE PARADERO CON VECTOR SVG */}
                      <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">
                            Esperando otro punto de abordaje:
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

                  {/* 3. CASO: EN CAMINO */}
                  {estadoLegend === 'EN_CAMINO' && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-sky-300 font-medium">
                        <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                        <span>Esperando confirmación de llegada del bus</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-tight">
                        El bus se dirige a <strong>{pasajero.punto}</strong>.
                      </p>
                    </div>
                  )}
                </div>

                {/* B. TARJETA PRINCIPAL: RUTA PARA IR AL BUS (Con micro-animación en brújula) */}
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

                  {/* Métricas de tiempo y distancia con iconos vectoriales */}
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

                {/* C. SIMBOLOGÍA VISUAL DEL MAPA (100% Vectorial, sin emojis) */}
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
                          ? `Transmitiendo (${pulser.horaGenerada || 'Activo'})`
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

                  {/* Pin 4: Zona de Abordaje (solo si tiene coordenadas/lugar de abordaje registrado) */}
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

                {/* E. FOOTER: HORA DE SINCRONIZACIÓN AUTOMÁTICA EN SEGUNDO PLANO */}
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
      )}

      {/* 6. BOTÓN FLOTANTE PARA VOLVER A ABRIR LA CONSULTA SI SE CERRÓ */}
      {!isModalOpen && !pasajero && (
        <div className="absolute top-4 right-4 z-[1000]">
          <button
            onClick={() => setIsModalOpen(true)}
            className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xl flex items-center gap-2 transition-all"
          >
            <Route className="w-4 h-4 text-white" />
            <span>Consultar mi Abordaje</span>
          </button>
        </div>
      )}
    </main>
  );
}
