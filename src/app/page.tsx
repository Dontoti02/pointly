'use client';

import dynamic from 'next/dynamic';
import { useState, useMemo } from 'react';
import type { RoadInfo } from '@/types/map';
import type { PulserState } from '@/types/pulser';
import { useGeolocation } from '@/hooks/useGeolocation';
import { usePassengerTracking } from '@/hooks/usePassengerTracking';
import { getSaludoPasajero } from '@/utils/saludo';
import { calculateDirectDistance, DEFAULT_MAP_CENTER } from '@/utils/geo';
import {
  DniSearchModal,
  WelcomeToast,
  TopBar,
  BusStatusLegend,
} from '@/components/passenger';

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

export default function HomePage() {
  // 1. Geolocalización del navegador
  const { clientGps, obtenerGpsCliente } = useGeolocation();

  // 2. Lógica de seguimiento y consulta del pasajero
  const {
    dni,
    setDni,
    loading,
    errorMsg,
    pasajero,
    isModalOpen,
    setIsModalOpen,
    showWelcomeToast,
    setShowWelcomeToast,
    legendMinimized,
    setLegendMinimized,
    lastUpdated,
    recenterTrigger,
    triggerRecenter,
    handleConsultar,
  } = usePassengerTracking(clientGps, obtenerGpsCliente);

  // 3. Información vial calculada por OSRM
  const [roadInfo, setRoadInfo] = useState<RoadInfo | null>(null);

  // 4. Saludo dinámico según horario en Perú (America/Lima)
  const saludoInfo = useMemo(() => {
    return getSaludoPasajero(pasajero?.nombre);
  }, [pasajero?.nombre]);

  // 5. Cálculo de distancia directa en tiempo real
  const destino =
    pasajero?.coordenadasPulser ||
    (pasajero?.coordenadasAbordaje?.lat && pasajero?.coordenadasAbordaje?.lng
      ? pasajero.coordenadasAbordaje
      : null);

  const distanciaDirecta = useMemo(() => {
    return calculateDirectDistance(clientGps, destino || null);
  }, [clientGps, destino]);

  // 6. Lógica de estado del Pulser para la leyenda
  const pulser = pasajero?.coordenadasPulser;
  const tieneHoraGenerada = Boolean(pulser?.horaGenerada);
  const pulserActivo =
    pulser?.activo === true ||
    (pulser?.activo !== false && pulser?.activo !== 'false');

  const estadoLegend: PulserState =
    pulser?.estado ||
    (!pulserActivo
      ? 'SALIDA'
      : tieneHoraGenerada
      ? 'LLEGO'
      : 'EN_CAMINO');

  // Centro del mapa dinámico
  const mapCenter: [number, number] = pasajero?.coordenadasPulser
    ? [pasajero.coordenadasPulser.lat, pasajero.coordenadasPulser.lng]
    : pasajero?.coordenadasAbordaje?.lat && pasajero?.coordenadasAbordaje?.lng
    ? [pasajero.coordenadasAbordaje.lat, pasajero.coordenadasAbordaje.lng]
    : DEFAULT_MAP_CENTER;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans touch-auto">
      {/* 1. MAPA A PANTALLA COMPLETA INTERACTIVO */}
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
          center={mapCenter}
          zoom={pasajero ? 14 : 12}
        />
      </div>

      {/* 2. NOTIFICACIÓN FLOTANTE DE SALUDO Y BIENVENIDA */}
      <WelcomeToast
        show={showWelcomeToast && !!pasajero}
        saludoInfo={saludoInfo}
        onClose={() => setShowWelcomeToast(false)}
      />

      {/* 3. MODAL DE CONSULTA (BÚSQUEDA POR DNI) */}
      <DniSearchModal
        isOpen={isModalOpen}
        dni={dni}
        loading={loading}
        errorMsg={errorMsg}
        hasPasajero={!!pasajero}
        saludoCompleto={saludoInfo.saludoCompleto}
        onDniChange={setDni}
        onSubmit={handleConsultar}
        onClose={() => setIsModalOpen(false)}
      />

      {/* 4. ELEMENTOS SUPERIORES Y ACCIONES DE CENTRADO */}
      <TopBar
        pasajero={pasajero}
        isModalOpen={isModalOpen}
        saludoInfo={saludoInfo}
        estadoLegend={estadoLegend}
        roadInfo={roadInfo}
        distanciaDirecta={distanciaDirecta}
        onOpenModal={() => setIsModalOpen(true)}
        onRecenter={triggerRecenter}
      />

      {/* 5. LEYENDA Y PANEL DE NAVEGACIÓN EN TIEMPO REAL */}
      {pasajero && !isModalOpen && (
        <BusStatusLegend
          pasajero={pasajero}
          saludoInfo={saludoInfo}
          estadoLegend={estadoLegend}
          clientGps={clientGps}
          roadInfo={roadInfo}
          distanciaDirecta={distanciaDirecta}
          lastUpdated={lastUpdated}
          legendMinimized={legendMinimized}
          onToggleMinimize={() => setLegendMinimized(!legendMinimized)}
          onOpenModal={() => setIsModalOpen(true)}
        />
      )}
    </main>
  );
}
