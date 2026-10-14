'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  BoardingPoint,
  Punto2Point,
  PuntoRutaItem,
  ClientLocation,
  BusLocation,
} from '@/components/Map';
import {
  Bus,
  MapPin,
  Clock,
  CheckCircle2,
  RefreshCw,
  LocateFixed,
  Sparkles,
  UserCheck,
  X,
  AlertCircle,
  User,
} from 'lucide-react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db, COLECCION_UBICACIONES, COLECCION_MANIFIESTO, ensureClientAuth } from '@/lib/firebase';

const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500"></div>
        <p className="text-sm font-medium tracking-wide text-slate-300">
          Cargando mapa interactivo Pointly...
        </p>
      </div>
    </div>
  ),
});

interface PuntoInfo {
  numero: number;
  key: string;
  lat: number;
  lng: number;
  llegada: string | null;
  salida: string | null;
  llegadaSec?: number | null;
  salidaSec?: number | null;
  lugarManifiesto?: string | null;
}

interface BusRecord {
  uid: string;
  id?: string;
  activo: boolean;
  punto1: PuntoInfo | null;
  punto2: PuntoInfo | null;
  puntos: PuntoInfo[];
  manifiestoPuntos?: string[];
}

interface PasajeroInfo {
  nombre: string;
  dni: string;
  punto?: string;
  uidpulser?: string | null;
  asiento?: number | null;
}

// Función para comparar el lugar generado por coordenadas con los puntos del manifiesto
function compararLugarConManifiesto(
  geoData: { departamento?: string; provincia?: string; distrito?: string; nombres?: string[] },
  puntosManifiesto: string[]
): string {
  if (!puntosManifiesto || puntosManifiesto.length === 0) {
    return (geoData.departamento || 'PUNTO DE EMBARQUE').toUpperCase();
  }

  const normalize = (str: string) =>
    (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();

  const candidates: string[] = [];
  if (geoData.nombres && Array.isArray(geoData.nombres)) {
    candidates.push(...geoData.nombres.map(normalize));
  }
  if (geoData.distrito) candidates.push(normalize(geoData.distrito));
  if (geoData.provincia) candidates.push(normalize(geoData.provincia));
  if (geoData.departamento) candidates.push(normalize(geoData.departamento));

  for (const c of candidates) {
    if (!c) continue;
    for (const p of puntosManifiesto) {
      const pNorm = normalize(p);
      if (!pNorm) continue;
      if (c === pNorm || c.includes(pNorm) || pNorm.includes(c)) {
        return p.toUpperCase();
      }
    }
  }

  return (geoData.distrito || geoData.departamento || 'PERÚ').toUpperCase();
}

export default function HomePage() {
  // Estado de la consulta por DNI
  const [dni, setDni] = useState('');
  const [loadingConsulta, setLoadingConsulta] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [pasajero, setPasajero] = useState<PasajeroInfo | null>(null);

  // Lista de buses en ubicaciones1
  const [buses, setBuses] = useState<BusRecord[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [clientGps, setClientGps] = useState<ClientLocation | null>(null);

  // Lugares en MAYÚSCULAS por número de punto
  const [lugaresPorPunto, setLugaresPorPunto] = useState<Record<number, string>>({});
  const lugarPunto1 = lugaresPorPunto[1] || 'DETECTANDO...';
  const lugarPunto2 = lugaresPorPunto[2] || 'DETECTANDO...';

  // UID del bus en seguimiento activo (se mantiene cuando pasa de activo a inactivo)
  const [trackedBusUid, setTrackedBusUid] = useState<string | null>(null);

  // Control para centrar el mapa
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  // Caché en memoria para geocodificación inversa
  const geoCache = useRef<Record<string, any>>({});

  // Helper para resolver coordenadas y comparar con manifiesto
  const resolverLugarConCoordenadas = useCallback(
    async (lat: number, lng: number, puntosManifiesto: string[] = []): Promise<string> => {
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      let geoData = geoCache.current[key];

      if (!geoData) {
        try {
          const res = await fetch(`/api/departamento?lat=${lat}&lng=${lng}`);
          const data = await res.json();
          if (data.ok) {
            geoData = data;
            geoCache.current[key] = data;
          }
        } catch (err) {
          console.warn('Error al resolver coordenadas:', err);
        }
      }

      if (!geoData) return 'PUNTO DE EMBARQUE';

      return compararLugarConManifiesto(geoData, puntosManifiesto);
    },
    []
  );

  // Función para obtener GPS del cliente
  const obtenerGpsCliente = useCallback(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setClientGps({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  useEffect(() => {
    obtenerGpsCliente();
  }, [obtenerGpsCliente]);

  // Consulta por DNI al manifiesto
  const handleConsultarDni = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    const dniLimpio = dni.trim();

    if (!dniLimpio || dniLimpio.length < 6) {
      setErrorMsg('Por favor ingrese un número de DNI válido.');
      return;
    }

    setLoadingConsulta(true);
    try {
      const res = await fetch('/api/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dni: dniLimpio,
          lat: clientGps?.lat,
          lng: clientGps?.lng,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok || !data.pasajero) {
        setErrorMsg(data.error || 'No se encontró ningún registro para el DNI ingresado.');
        setLoadingConsulta(false);
        return;
      }

      setPasajero({
        nombre: data.pasajero.nombre,
        dni: dniLimpio,
        punto: data.pasajero.punto,
        uidpulser: data.pasajero.uidpulser,
        asiento: data.pasajero.asiento,
      });

      setIsModalOpen(false);
      setRecenterTrigger((p) => p + 1);
    } catch {
      setErrorMsg('Error al consultar el servicio. Verifique su conexión.');
    } finally {
      setLoadingConsulta(false);
    }
  };

  // Helper para formatear timestamp seguro de Firestore
  const parseTs = useCallback((ts: any): string | null => {
    if (!ts) return null;
    let sec: number | null = null;
    if (typeof ts?.seconds === 'number') {
      sec = ts.seconds;
    } else if (typeof ts === 'number') {
      sec = ts > 1e11 ? Math.floor(ts / 1000) : ts;
    } else if (typeof ts?.toDate === 'function') {
      sec = Math.floor(ts.toDate().getTime() / 1000);
    } else if (typeof ts === 'string') {
      const p = Date.parse(ts);
      if (!isNaN(p)) sec = Math.floor(p / 1000);
      else return ts;
    }
    if (sec == null) return null;

    const date = new Date(sec * 1000);
    return date.toLocaleTimeString('es-PE', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }, []);

  // Conexión silenciosa en tiempo real a Firebase Firestore colección ubicaciones1
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let isMounted = true;

    const conectarFirestore = async () => {
      await ensureClientAuth();

      if (db) {
        try {
          const colRef = collection(db, COLECCION_UBICACIONES);
          unsubscribe = onSnapshot(colRef, async (snapshot) => {
            if (!isMounted) return;

            // Consultar puntos del manifiesto
            const manifestPointsByUid: Record<string, string[]> = {};
            const manifestCoordsByUid: Record<string, { lat: number; lng: number }> = {};

            try {
              const snapMan = await getDocs(collection(db, COLECCION_MANIFIESTO));
              snapMan.forEach((mDoc) => {
                const mData = mDoc.data();
                if (!mData.uidpulser) return;
                const uid = String(mData.uidpulser).trim();
                if (Array.isArray(mData.registros)) {
                  if (!manifestPointsByUid[uid]) manifestPointsByUid[uid] = [];
                  for (const r of mData.registros) {
                    if (r.punto && !manifestPointsByUid[uid].includes(String(r.punto).toUpperCase().trim())) {
                      manifestPointsByUid[uid].push(String(r.punto).toUpperCase().trim());
                    }
                    if (!manifestCoordsByUid[uid] && !isNaN(Number(r.lat)) && !isNaN(Number(r.lng))) {
                      manifestCoordsByUid[uid] = { lat: Number(r.lat), lng: Number(r.lng) };
                    }
                  }
                }
              });
            } catch {
              // Silencioso
            }

            const docs: BusRecord[] = [];
            snapshot.forEach((d) => {
              const data = d.data();
              const uid = String(data.uid || d.id).trim();
              const activo = Boolean(
                data.activo === true ||
                data.activo === 'true' ||
                data.activo === 1
              );

              const manifiestoPuntos = manifestPointsByUid[uid] || [];
              const manifiestoCoords = manifestCoordsByUid[uid] || null;

              // Escaneo dinámico de todos los puntos incrementales: punto1, punto2, punto3, punto4...
              const puntos: PuntoInfo[] = [];
              Object.keys(data).forEach((key) => {
                const match = key.match(/^punto(\d+)$/i);
                if (match) {
                  const num = parseInt(match[1], 10);
                  const pData = data[key];
                  let lat = Number(pData?.lat);
                  let lng = Number(pData?.lng);

                  if (num === 1 && (isNaN(lat) || isNaN(lng)) && manifiestoCoords) {
                    lat = manifiestoCoords.lat;
                    lng = manifiestoCoords.lng;
                  }

                  if (!isNaN(lat) && !isNaN(lng)) {
                    puntos.push({
                      numero: num,
                      key,
                      lat,
                      lng,
                      llegada: parseTs(pData?.llegada),
                      salida: parseTs(pData?.salida),
                      lugarManifiesto: manifiestoPuntos[num - 1] || null,
                    });
                  }
                }
              });

              puntos.sort((a, b) => a.numero - b.numero);

              const punto1 = puntos.find((p) => p.numero === 1) || null;
              const punto2 = puntos.find((p) => p.numero === 2) || null;

              docs.push({
                uid,
                id: d.id,
                activo,
                punto1,
                punto2,
                puntos,
                manifiestoPuntos,
              });
            });

            if (docs.length > 0) {
              setBuses(docs);
            }
            setLastSync(new Date().toLocaleTimeString('es-PE', { hour12: true }));
          });
        } catch (err) {
          console.warn('onSnapshot no disponible, usando polling:', err);
        }
      }
    };

    conectarFirestore();

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/ubicaciones1');
        const data = await res.json();
        if (data.ok && Array.isArray(data.pulsers) && isMounted) {
          setBuses(data.pulsers);
          setLastSync(new Date().toLocaleTimeString('es-PE', { hour12: true }));
        }
      } catch {
        // Silencioso
      }
    }, 3000);

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
      clearInterval(interval);
    };
  }, [parseTs]);

  // Mantener actualizado el bus rastreado cuando un bus se activa
  useEffect(() => {
    const active = buses.find((b) => b.activo);
    if (active) {
      setTrackedBusUid(active.uid);
    }
  }, [buses]);

  // Selección automática y consistente del bus en tiempo real
  const currentBus = useMemo(() => {
    // 1. Por pasajero autenticado con DNI
    if (pasajero?.uidpulser) {
      const match = buses.find((b) => b.uid === pasajero.uidpulser);
      if (match) return match;
    }

    // 2. Bus actualmente activo en Firestore (activo === true)
    const busActivo = buses.find((b) => b.activo);
    if (busActivo) return busActivo;

    // 3. Mantener el bus que se estaba siguiendo (cuando pasa de activo: true a false)
    if (trackedBusUid) {
      const busRastreado = buses.find((b) => b.uid === trackedBusUid);
      if (busRastreado) return busRastreado;
    }

    // 4. Si ninguno está activo, seleccionar el bus que tenga coordenadas reales
    const busConDatos = buses.find(
      (b) => b.punto1 && !isNaN(Number(b.punto1.lat)) && !isNaN(Number(b.punto1.lng))
    );
    if (busConDatos) return busConDatos;

    // 5. Último recurso
    return buses[0] || null;
  }, [buses, pasajero?.uidpulser, trackedBusUid]);

  // Lista consolidada de puntos del manifiesto para comparar
  const puntosManifiestoConsolidados = useMemo(() => {
    const list: string[] = [];
    if (pasajero?.punto) list.push(pasajero.punto.toUpperCase().trim());
    if (currentBus?.manifiestoPuntos) {
      for (const p of currentBus.manifiestoPuntos) {
        if (!list.includes(p.toUpperCase().trim())) {
          list.push(p.toUpperCase().trim());
        }
      }
    }
    return list;
  }, [pasajero?.punto, currentBus?.manifiestoPuntos]);

  // Lista ordenada de todos los puntos alcanzados por el bus
  const puntosVisibles = useMemo(() => {
    if (currentBus?.puntos && currentBus.puntos.length > 0) {
      return currentBus.puntos;
    }
    const list: PuntoInfo[] = [];
    if (currentBus?.punto1) list.push(currentBus.punto1);
    if (currentBus?.punto2) list.push(currentBus.punto2);
    return list;
  }, [currentBus?.puntos, currentBus?.punto1, currentBus?.punto2]);

  // Resolver nombre de lugar en MAYÚSCULAS para cada punto comparando con el manifiesto
  useEffect(() => {
    if (puntosVisibles.length === 0) {
      if (pasajero?.punto) {
        setLugaresPorPunto({ 1: pasajero.punto.toUpperCase() });
      }
      return;
    }

    puntosVisibles.forEach((p) => {
      resolverLugarConCoordenadas(
        p.lat,
        p.lng,
        puntosManifiestoConsolidados
      ).then((lugar) => {
        setLugaresPorPunto((prev) => {
          if (prev[p.numero] === lugar.toUpperCase()) return prev;
          return { ...prev, [p.numero]: lugar.toUpperCase() };
        });
      });
    });
  }, [puntosVisibles, puntosManifiestoConsolidados, pasajero?.punto, resolverLugarConCoordenadas]);

  // 1. Punto de Embarque (Punto 1 - Coordenadas del manifiesto/punto1)
  const boardingPoint: BoardingPoint | null = useMemo(() => {
    const p1 = puntosVisibles.find((p) => p.numero === 1) || currentBus?.punto1;
    if (!p1) return null;
    return {
      lat: p1.lat,
      lng: p1.lng,
      nombreLugar: 'Punto de Embarque',
      departamento: lugaresPorPunto[1] || p1.lugarManifiesto || 'PIURA',
      llegada: p1.llegada,
      salida: p1.salida,
    };
  }, [puntosVisibles, currentBus?.punto1, lugaresPorPunto]);

  // 2. Punto 2 (compatibilidad de componentes)
  const punto2Point: Punto2Point | null = useMemo(() => {
    const p2 = puntosVisibles.find((p) => p.numero === 2);
    if (!p2) return null;
    return {
      lat: p2.lat,
      lng: p2.lng,
      nombreLugar: 'Punto 2',
      departamento: lugaresPorPunto[2] || p2.lugarManifiesto || 'TRUJILLO',
      llegada: p2.llegada,
      salida: p2.salida,
    };
  }, [puntosVisibles, lugaresPorPunto]);

  // 3. Puntos de ruta completos para el mapa (P1, P2, P3, P4...)
  const puntosRutaParaMapa: PuntoRutaItem[] = useMemo(() => {
    return puntosVisibles.map((p, idx) => {
      const esPrimero = p.numero === 1;
      const esUltimo = idx === puntosVisibles.length - 1;
      const nombreLugar = esPrimero ? 'Punto de Embarque' : `Punto ${p.numero}`;
      const departamento =
        lugaresPorPunto[p.numero] ||
        p.lugarManifiesto ||
        (esPrimero ? 'PIURA' : 'PERÚ');

      return {
        numero: p.numero,
        lat: p.lat,
        lng: p.lng,
        nombreLugar,
        departamento,
        llegada: p.llegada,
        salida: p.salida,
        esActivo: esUltimo && Boolean(currentBus?.activo),
      };
    });
  }, [puntosVisibles, lugaresPorPunto, currentBus?.activo]);

  // 4. Ubicación del Bus en tiempo real (en el último punto alcanzado)
  const busLocation: BusLocation | null = useMemo(() => {
    if (!currentBus) return null;

    const ptoActivo =
      puntosVisibles.length > 0
        ? puntosVisibles[puntosVisibles.length - 1]
        : currentBus.punto1;

    if (!ptoActivo) return null;

    const estado: 'LLEGO' | 'SALIDA' | 'EN_CAMINO' = currentBus.activo
      ? 'LLEGO'
      : 'SALIDA';

    const estadoTexto = currentBus.activo
      ? `Bus en punto de embarque (${ptoActivo.numero === 1 ? 'Punto de Embarque' : `Punto ${ptoActivo.numero}`})`
      : 'El bus se está dirigiendo al siguiente punto de embarque';

    return {
      lat: ptoActivo.lat,
      lng: ptoActivo.lng,
      activo: currentBus.activo,
      horaLlegada: ptoActivo.llegada,
      horaSalida: ptoActivo.salida,
      horaGenerada: ptoActivo.salida || ptoActivo.llegada,
      estado,
      estadoTexto,
    };
  }, [currentBus, puntosVisibles]);

  // Refrescar manualmente
  const refrescarManual = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/ubicaciones1');
      const data = await res.json();
      if (data.ok && Array.isArray(data.pulsers)) {
        setBuses(data.pulsers);
        setLastSync(new Date().toLocaleTimeString('es-PE', { hour12: true }));
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans touch-auto text-white">
      {/* 1. MAPA A PANTALLA COMPLETA */}
      <div className="absolute inset-0 w-full h-full z-0 touch-auto">
        <Map
          boardingPoint={boardingPoint}
          punto2Point={punto2Point}
          puntosRuta={puntosRutaParaMapa}
          clientLocation={clientGps}
          busLocation={currentBus?.activo ? busLocation : null}
          recenterTrigger={recenterTrigger}
          passengerName={pasajero?.nombre}
          center={
            busLocation && currentBus?.activo
              ? [busLocation.lat, busLocation.lng]
              : boardingPoint
              ? [boardingPoint.lat, boardingPoint.lng]
              : [-5.2263762, -80.6244957]
          }
          zoom={12}
        />
      </div>

      {/* 2. MODAL PARA INGRESO DE DNI */}
      {isModalOpen && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-6 text-white text-center relative border-b border-slate-800">
              <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white shadow-xl mx-auto mb-3 border border-slate-100">
                <img src="/logo.png" alt="Pointly" className="h-11 w-auto object-contain" />
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
                <span>Pointly</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">
                  En Vivo
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Ingrese su DNI para visualizar su punto de abordaje y el seguimiento del bus
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

            <form onSubmit={handleConsultarDni} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
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
                    placeholder="Ingrese su DNI"
                    required
                    autoFocus
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-700 bg-slate-800/90 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loadingConsulta}
                className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loadingConsulta ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Verificando pasajero...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4 text-white" />
                    <span>Consultar Mi Abordaje</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. BARRA SUPERIOR BRANDING */}
      <header className="absolute top-3 inset-x-3 md:top-4 md:left-4 md:right-auto z-[1000] flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 shadow-2xl">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-white p-1 shrink-0 flex items-center justify-center shadow-md">
            <img src="/logo-icon.png" alt="Pointly" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight text-white">Pointly</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                En Vivo
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-none mt-0.5">
              Monitoreo de ruta en tiempo real
            </p>
          </div>
        </div>

        {pasajero && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700 transition-colors"
              title="Cambiar pasajero"
            >
              DNI: {pasajero.dni}
            </button>
          </div>
        )}
      </header>

      {/* 4. BOTÓN FLOTANTE PARA CENTRAR RUTA */}
      <button
        type="button"
        onClick={() => setRecenterTrigger((prev) => prev + 1)}
        className="absolute bottom-6 right-4 z-[990] p-3 rounded-full bg-slate-900/95 text-white border border-slate-700/80 shadow-2xl backdrop-blur-xl hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-2 group hover:border-emerald-500/50"
        title="Centrar mapa en los puntos de embarque"
      >
        <div className="relative flex items-center justify-center">
          <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-emerald-400/40"></span>
          <LocateFixed className="w-5 h-5 text-emerald-400 group-hover:rotate-45 transition-transform duration-300 relative" />
        </div>
        <span className="hidden md:inline text-xs font-semibold pr-1">Centrar Puntos</span>
      </button>

      {/* 5. PANEL PRINCIPAL FLOTANTE DE EMBARQUE & SINCRONIZACIÓN */}
      <aside className="fixed bottom-0 inset-x-0 md:bottom-auto md:inset-x-auto md:top-4 md:right-4 z-[1000] md:w-[410px] transition-all duration-300">
        <div className="bg-slate-900/95 backdrop-blur-xl rounded-t-2xl md:rounded-2xl shadow-2xl shadow-slate-950/80 border-t md:border border-slate-700/80 overflow-hidden">
          {/* A. SALUDO EXCLUSIVO A LA PERSONA CON SUS APELLIDOS Y NOMBRES */}
          {pasajero && (
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-b border-slate-700/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 block">
                    ¡Bienvenido(a)!
                  </span>
                  <h2 className="text-xs font-black text-white truncate max-w-[230px]" title={pasajero.nombre}>
                    {pasajero.nombre}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] font-bold border border-slate-700 transition-colors"
                  title="Cambiar o consultar otro DNI"
                >
                  DNI: {pasajero.dni}
                </button>
              </div>
            </div>
          )}

          {/* B. Header del Panel con Estado del Bus */}
          <div
            onClick={() => setPanelCollapsed(!panelCollapsed)}
            className="px-4 py-3 bg-slate-800/90 flex items-center justify-between border-b border-slate-700/80 cursor-pointer select-none"
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  currentBus?.activo
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}
              >
                <Bus className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Estado del Bus
                </span>
                <span className="text-xs font-bold text-white">
                  {puntosVisibles.length === 0
                    ? 'No llega al punto de embarque'
                    : currentBus?.activo
                    ? puntosVisibles.length > 1
                      ? `En Punto ${puntosVisibles[puntosVisibles.length - 1].numero}`
                      : 'En Punto de Embarque'
                    : 'En Trayecto'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {puntosVisibles.length === 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                  EN ESPERA
                </span>
              ) : currentBus?.activo ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  EN EMBARQUE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                  EN RUTA
                </span>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  refrescarManual();
                }}
                disabled={isRefreshing}
                className="p-1 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-slate-300 transition-colors"
                title="Actualizar datos"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Contenido Completo del Panel */}
          {!panelCollapsed && (
            <div className="p-4 space-y-3.5 max-h-[68vh] md:max-h-[82vh] overflow-y-auto">
              {/* ============================================================== */}
              {/* ITINERARIO COMPLETO: PUNTOS FIJADOS Y EN TIEMPO REAL          */}
              {/* ============================================================== */}
              {puntosVisibles.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700 text-center space-y-2.5 shadow-lg">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                    <Bus className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block">
                      Aviso General
                    </span>
                    <h3 className="text-sm font-extrabold text-white">
                      La unidad de transporte no llega al punto de embarque
                    </h3>
                  </div>
                </div>
              ) : (
                puntosVisibles.map((p, idx) => {
                  const esPrimero = p.numero === 1;
                  const esUltimo = idx === puntosVisibles.length - 1;
                  const esActivo = esUltimo && Boolean(currentBus?.activo);
                  const lugarNombre =
                    lugaresPorPunto[p.numero] ||
                    p.lugarManifiesto ||
                    (esPrimero ? 'PIURA' : 'PERÚ');

                  return (
                    <div
                      key={`card-punto-${p.numero}`}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        esActivo
                          ? 'bg-emerald-950/25 border-emerald-500/40 shadow-lg shadow-emerald-950/30 animate-in fade-in slide-in-from-bottom-2 duration-300'
                          : 'bg-slate-800/80 border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                              esActivo
                                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                                : esPrimero
                                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                                : 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-400'
                            }`}
                          >
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">
                              {esPrimero ? 'Punto de Inicio por Defecto' : 'Punto de Embarque'}
                            </span>
                            <h3 className="font-extrabold text-sm text-white">
                              {esPrimero ? 'Punto de Embarque' : `Punto ${p.numero}`}
                            </h3>
                          </div>
                        </div>

                        {/* LUGAR COMPARADO CON MANIFIESTO EN MAYÚSCULAS */}
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase shadow-sm">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          {lugarNombre}
                        </span>
                      </div>

                      {/* CASO A: EL BUS ESTÁ ACTUALMENTE EN ESTE PUNTO (activo === true) -> HORA DE LLEGADA */}
                      {esActivo && (
                        <div className="mt-3 p-2.5 rounded-xl bg-emerald-900/30 border border-emerald-500/40 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-emerald-400" />
                              Hora que llegó bus:
                            </span>
                            <span className="font-mono font-extrabold text-white text-xs bg-emerald-500/30 px-2 py-0.5 rounded-md border border-emerald-400/40">
                              {p.llegada || 'Registrado'}
                            </span>
                          </div>
                          <p className="text-[10px] text-emerald-200/80 mt-1">
                            El bus se encuentra disponible en la zona de abordaje.
                          </p>
                        </div>
                      )}

                      {/* CASO B: PUNTO YA FINALIZADO O BUS EN TRAYECTO (SALIDA) */}
                      {!esActivo && (
                        <div className="mt-3 space-y-2.5">
                          {/* Hora de Salida */}
                          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700 flex items-center justify-between text-xs">
                            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              Salida:
                            </span>
                            <span className="font-mono font-bold text-amber-300 text-xs bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30">
                              {p.salida || p.llegada || 'Salida registrada'}
                            </span>
                          </div>

                          {/* SÓLO DEBAJO DEL ÚLTIMO PUNTO CUANDO EL BUS ESTÁ EN CAMINO (activo === false) */}
                          {esUltimo && !currentBus?.activo && (
                            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-sky-950/40 border border-amber-500/40 text-xs shadow-lg shadow-amber-950/20">
                              <div className="flex items-center gap-3">
                                <div className="relative flex items-center justify-center shrink-0">
                                  <span className="animate-ping absolute inline-flex h-3.5 w-3.5 rounded-full bg-amber-400/50"></span>
                                  <RefreshCw className="w-4 h-4 text-amber-400 animate-spin relative" />
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block">
                                    Sincronizando
                                  </span>
                                  <p className="text-xs text-slate-100 font-semibold leading-snug">
                                    El bus se está dirigiendo al siguiente punto de embarque
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Footer con hora de última sincronización */}
              <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
                <span>Pointly • Monitoreo en vivo</span>
                <span>Actualizado: {lastSync || 'En tiempo real'}</span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </main>
  );
}
