'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Controlador interno con navegación 100% libre para el usuario
function MapController({
  routeBounds,
  busCenter,
  recenterTrigger = 0,
}: {
  routeBounds?: [number, number][];
  busCenter?: [number, number] | null;
  recenterTrigger?: number;
}) {
  const map = useMap();
  const initialFitDone = useRef(false);
  const userInteracted = useRef(false);
  const lastRecenter = useRef(recenterTrigger);

  // Detectar interacción táctil o de mouse del usuario para permitir navegación libre
  useEffect(() => {
    const onUserInteraction = () => {
      userInteracted.current = true;
    };

    map.on('dragstart', onUserInteraction);
    map.on('zoomstart', onUserInteraction);
    map.on('touchstart', onUserInteraction);

    return () => {
      map.off('dragstart', onUserInteraction);
      map.off('zoomstart', onUserInteraction);
      map.off('touchstart', onUserInteraction);
    };
  }, [map]);

  // Manejar el auto-encuadre inicial y las órdenes manuales de centrado
  useEffect(() => {
    const isManualTrigger = recenterTrigger !== lastRecenter.current;
    lastRecenter.current = recenterTrigger;

    if (isManualTrigger) {
      userInteracted.current = false;
    }

    if (userInteracted.current && !isManualTrigger) {
      return;
    }

    // Encuadrar la ruta completa dejando espacio para la interfaz
    if (routeBounds && routeBounds.length >= 2) {
      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
      map.fitBounds(routeBounds, {
        paddingTopLeft: [50, 50],
        paddingBottomRight: isDesktop ? [420, 50] : [50, 180],
        maxZoom: 16,
        animate: initialFitDone.current,
        duration: 0.8,
      });
      initialFitDone.current = true;
    } else if (busCenter && !initialFitDone.current) {
      map.flyTo(busCenter, 15, { duration: 0.8 });
      initialFitDone.current = true;
    }
  }, [routeBounds, busCenter, recenterTrigger, map]);

  return null;
}

// Ícono para el GPS del Cliente (Usuario) - Azul zafiro con pulso nítido
const clientLocationIcon = L.divIcon({
  className: 'client-gps-marker',
  html: `
    <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 38px; height: 38px; background: rgba(37, 99, 235, 0.35); border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="width: 24px; height: 24px; background: #2563eb; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.5); display: flex; align-items: center; justify-content: center;">
        <div style="width: 7px; height: 7px; background: #ffffff; border-radius: 50%;"></div>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -18],
});

// Ícono para Punto de Embarque (Punto 1) - Esmeralda elegante
const boardingZoneIcon = L.divIcon({
  className: 'boarding-zone-marker',
  html: `
    <div style="position: relative; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 48px; height: 48px; background: rgba(16, 185, 129, 0.25); border-radius: 50%; animation: pulse 2s infinite;"></div>
      <div style="
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        width: 38px;
        height: 38px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid #ffffff;
        box-shadow: 0 4px 16px rgba(16, 185, 129, 0.5);
      ">
        <div style="transform: rotate(45deg); color: white; font-weight: 900; font-size: 13px; font-family: ui-monospace, monospace;">
          P1
        </div>
      </div>
    </div>
  `,
  iconSize: [42, 42],
  iconAnchor: [21, 38],
  popupAnchor: [0, -40],
});

// Generador dinámico de íconos para cualquier punto P1, P2, P3, P4...
export function crearPuntoZoneIcon(numero: number, esPrimero: boolean, esUltimo: boolean) {
  const gradient = esPrimero
    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
    : esUltimo
    ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
    : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)';

  const pulseBg = esPrimero
    ? 'rgba(16, 185, 129, 0.25)'
    : esUltimo
    ? 'rgba(99, 102, 241, 0.3)'
    : 'rgba(2, 132, 199, 0.25)';

  return L.divIcon({
    className: `punto-zone-marker-${numero}`,
    html: `
      <div style="position: relative; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 48px; height: 48px; background: ${pulseBg}; border-radius: 50%; animation: pulse 2s infinite;"></div>
        <div style="
          background: ${gradient};
          width: 38px;
          height: 38px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid #ffffff;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        ">
          <div style="transform: rotate(45deg); color: white; font-weight: 900; font-size: 13px; font-family: ui-monospace, monospace;">
            P${numero}
          </div>
        </div>
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 38],
    popupAnchor: [0, -40],
  });
}

// Ícono para Punto 2 (Siguiente Punto) - Índigo / Púrpura moderno
const punto2ZoneIcon = L.divIcon({
  className: 'punto2-zone-marker',
  html: `
    <div style="position: relative; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 48px; height: 48px; background: rgba(99, 102, 241, 0.3); border-radius: 50%; animation: pulse 2s infinite;"></div>
      <div style="
        background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
        width: 38px;
        height: 38px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid #ffffff;
        box-shadow: 0 4px 16px rgba(99, 102, 241, 0.5);
      ">
        <div style="transform: rotate(45deg); color: white; font-weight: 900; font-size: 13px; font-family: ui-monospace, monospace;">
          P2
        </div>
      </div>
    </div>
  `,
  iconSize: [42, 42],
  iconAnchor: [21, 38],
  popupAnchor: [0, -40],
});

// Ícono para el Bus / Pulser en vivo - Ámbar cálido con vehículo
const busLocationIcon = L.divIcon({
  className: 'bus-location-marker',
  html: `
    <div style="position: relative; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 54px; height: 54px; background: rgba(245, 158, 11, 0.35); border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        width: 42px;
        height: 42px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid #ffffff;
        box-shadow: 0 4px 16px rgba(245, 158, 11, 0.6);
      ">
        <div style="color: white; display: flex;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 6v6"/>
            <path d="M15 6v6"/>
            <path d="M2 12h19.6"/>
            <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.7 19.1 6 18 6H4c-1.1 0-2.1.7-2.4 1.8l-1.4 5c-.1.4-.2.8-.2 1.2 0 .4.1.8.2 1.2C.5 16.3 1 18 1 18h3"/>
            <circle cx="7" cy="18" r="2"/>
            <circle cx="17" cy="18" r="2"/>
          </svg>
        </div>
      </div>
    </div>
  `,
  iconSize: [46, 46],
  iconAnchor: [23, 23],
  popupAnchor: [0, -26],
});

export interface BoardingPoint {
  lat: number;
  lng: number;
  nombreLugar?: string;
  departamento?: string;
  llegada?: string | null;
  salida?: string | null;
  referencia?: string;
}

export interface Punto2Point {
  lat: number;
  lng: number;
  nombreLugar?: string;
  departamento?: string;
  llegada?: string | null;
  salida?: string | null;
}

export interface PuntoRutaItem {
  numero: number;
  lat: number;
  lng: number;
  nombreLugar?: string;
  departamento?: string;
  llegada?: string | null;
  salida?: string | null;
  esActivo?: boolean;
}

export interface ClientLocation {
  lat: number;
  lng: number;
}

export interface BusLocation {
  lat: number;
  lng: number;
  activo?: boolean;
  horaGenerada?: string | null;
  horaLlegada?: string | null;
  horaSalida?: string | null;
  historialPuntos?: Array<{
    punto: string;
    idx: number;
    numeroParada?: number;
    horaLlegada: string | null;
    horaSalida: string | null;
    estado?: 'BLOQUEADA' | 'EN_PARADA' | 'EN_CAMINO' | 'PENDIENTE';
    estadoTexto?: string;
  }>;
  timestamp?: number | null;
  velocidad?: number | null;
  estado?: 'LLEGO' | 'SALIDA' | 'EN_CAMINO';
  estadoTexto?: string;
  actualizado?: string | number | null;
}

export interface MapProps {
  boardingPoint?: BoardingPoint | null;
  punto2Point?: Punto2Point | null;
  puntosRuta?: PuntoRutaItem[];
  clientLocation?: ClientLocation | null;
  busLocation?: BusLocation | null;
  center?: [number, number];
  zoom?: number;
  className?: string;
  passengerName?: string;
  recenterTrigger?: number;
  onRouteCalculated?: (info: { distance: string; duration: string; summary?: string; roadFound: boolean }) => void;
}

export default function Map({
  boardingPoint,
  punto2Point,
  puntosRuta,
  clientLocation,
  busLocation,
  center = [-14.7404981, -73.1801639],
  zoom = 14,
  className = 'h-full w-full',
  passengerName,
  recenterTrigger = 0,
  onRouteCalculated,
}: MapProps) {
  // Estado para la geometría real de calles (Google Maps style)
  const [roadCoordinates, setRoadCoordinates] = useState<[number, number][] | null>(null);
  const [roadInfo, setRoadInfo] = useState<{ distance: string; duration: string; summary?: string } | null>(null);

  // Puntos clave para trazar la ruta:
  // Si existe Punto 2, se traza entre Punto de Embarque (P1) y Punto 2 (P2)
  // Si no, entre Punto de Embarque y la posición actual del Bus o Cliente
  const routeEndpoints = useMemo(() => {
    if (
      boardingPoint &&
      !isNaN(boardingPoint.lat) &&
      !isNaN(boardingPoint.lng) &&
      punto2Point &&
      !isNaN(punto2Point.lat) &&
      !isNaN(punto2Point.lng)
    ) {
      return {
        start: { lat: boardingPoint.lat, lng: boardingPoint.lng, label: 'Punto de Embarque' },
        end: { lat: punto2Point.lat, lng: punto2Point.lng, label: 'Punto 2' },
      };
    }

    if (
      boardingPoint &&
      !isNaN(boardingPoint.lat) &&
      !isNaN(boardingPoint.lng) &&
      busLocation &&
      !isNaN(busLocation.lat) &&
      !isNaN(busLocation.lng) &&
      (Math.abs(boardingPoint.lat - busLocation.lat) > 0.0001 ||
        Math.abs(boardingPoint.lng - busLocation.lng) > 0.0001)
    ) {
      return {
        start: { lat: boardingPoint.lat, lng: boardingPoint.lng, label: 'Punto de Embarque' },
        end: { lat: busLocation.lat, lng: busLocation.lng, label: 'Bus' },
      };
    }

    return null;
  }, [boardingPoint, punto2Point, busLocation]);

  // Límites para encuadrar la visualización
  const routeBounds: [number, number][] | undefined = useMemo(() => {
    const coords: [number, number][] = [];
    if (puntosRuta && puntosRuta.length > 0) {
      for (const p of puntosRuta) {
        if (!isNaN(p.lat) && !isNaN(p.lng)) {
          coords.push([p.lat, p.lng]);
        }
      }
    } else {
      if (boardingPoint && !isNaN(boardingPoint.lat) && !isNaN(boardingPoint.lng)) {
        coords.push([boardingPoint.lat, boardingPoint.lng]);
      }
      if (punto2Point && !isNaN(punto2Point.lat) && !isNaN(punto2Point.lng)) {
        coords.push([punto2Point.lat, punto2Point.lng]);
      }
    }
    if (busLocation && busLocation.activo && !isNaN(busLocation.lat) && !isNaN(busLocation.lng)) {
      coords.push([busLocation.lat, busLocation.lng]);
    }
    if (clientLocation && !isNaN(clientLocation.lat) && !isNaN(clientLocation.lng)) {
      coords.push([clientLocation.lat, clientLocation.lng]);
    }

    if (coords.length >= 2) return coords;
    return undefined;
  }, [puntosRuta, boardingPoint, punto2Point, busLocation, clientLocation]);

  // Centro prioritario del mapa
  const initialCenter: [number, number] = useMemo(() => {
    if (busLocation && busLocation.activo && !isNaN(busLocation.lat) && !isNaN(busLocation.lng)) {
      return [busLocation.lat, busLocation.lng];
    }
    if (puntosRuta && puntosRuta.length > 0) {
      const ultimo = puntosRuta[puntosRuta.length - 1];
      if (!isNaN(ultimo.lat) && !isNaN(ultimo.lng)) {
        return [ultimo.lat, ultimo.lng];
      }
    }
    if (boardingPoint && !isNaN(boardingPoint.lat) && !isNaN(boardingPoint.lng)) {
      return [boardingPoint.lat, boardingPoint.lng];
    }
    if (punto2Point && !isNaN(punto2Point.lat) && !isNaN(punto2Point.lng)) {
      return [punto2Point.lat, punto2Point.lng];
    }
    return center;
  }, [busLocation, puntosRuta, boardingPoint, punto2Point, center]);

  // Consulta automática de la ruta por calles (Google Maps style vía /api/ruta)
  useEffect(() => {
    let isMounted = true;

    // Caso A: Ruteo continuo entre múltiples puntos de ruta (P1 -> P2 -> P3 -> P4 ...)
    if (puntosRuta && puntosRuta.length >= 2) {
      fetch('/api/ruta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: puntosRuta.map((p) => ({ lat: p.lat, lng: p.lng })),
          profile: 'driving',
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted) return;
          if (data.ok && data.coords && data.coords.length >= 2) {
            setRoadCoordinates(data.coords);
            const info = {
              distance: data.distanceText || 'Ruta calculada',
              duration: data.durationText || '~5-10 min',
              summary: data.summary || '',
              roadFound: true,
            };
            setRoadInfo(info);
            onRouteCalculated?.(info);
          } else {
            const directCoords: [number, number][] = puntosRuta.map((p) => [p.lat, p.lng]);
            setRoadCoordinates(directCoords);
          }
        })
        .catch(() => {
          if (isMounted) {
            const directCoords: [number, number][] = puntosRuta.map((p) => [p.lat, p.lng]);
            setRoadCoordinates(directCoords);
          }
        });

      return () => {
        isMounted = false;
      };
    }

    // Caso B: Fallback para 2 puntos clásicos
    if (!routeEndpoints) {
      setRoadCoordinates(null);
      setRoadInfo(null);
      return;
    }

    fetch('/api/ruta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startLat: routeEndpoints.start.lat,
        startLng: routeEndpoints.start.lng,
        endLat: routeEndpoints.end.lat,
        endLng: routeEndpoints.end.lng,
        profile: 'driving',
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.ok && data.coords && data.coords.length >= 2) {
          setRoadCoordinates(data.coords);
          const info = {
            distance: data.distanceText || 'Ruta calculada',
            duration: data.durationText || '~5-10 min',
            summary: data.summary || '',
            roadFound: true,
          };
          setRoadInfo(info);
          onRouteCalculated?.(info);
        } else {
          const directCoords: [number, number][] = [
            [routeEndpoints.start.lat, routeEndpoints.start.lng],
            [routeEndpoints.end.lat, routeEndpoints.end.lng],
          ];
          setRoadCoordinates(directCoords);
          const info = {
            distance: 'Ruta trazada',
            duration: '--',
            summary: '',
            roadFound: false,
          };
          setRoadInfo(info);
          onRouteCalculated?.(info);
        }
      })
      .catch((err) => {
        console.warn('Error al calcular ruta vial:', err);
        if (isMounted) {
          const directCoords: [number, number][] = [
            [routeEndpoints.start.lat, routeEndpoints.start.lng],
            [routeEndpoints.end.lat, routeEndpoints.end.lng],
          ];
          setRoadCoordinates(directCoords);
          const info = {
            distance: 'Ruta directa',
            duration: '--',
            summary: '',
            roadFound: false,
          };
          setRoadInfo(info);
          onRouteCalculated?.(info);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [puntosRuta, routeEndpoints, onRouteCalculated]);

  return (
    <MapContainer
      center={initialCenter}
      zoom={zoom}
      scrollWheelZoom={true}
      dragging={true}
      touchZoom={true}
      doubleClickZoom={true}
      className={`h-full w-full z-0 touch-auto ${className}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapController
        routeBounds={routeBounds}
        busCenter={busLocation ? [busLocation.lat, busLocation.lng] : null}
        recenterTrigger={recenterTrigger}
      />

      {/* 1. LÍNEA DE RUTA VIAL ESTILO GOOGLE MAPS */}
      {roadCoordinates && roadCoordinates.length >= 2 && (
        <>
          {/* Contorno blanco exterior */}
          <Polyline
            positions={roadCoordinates}
            pathOptions={{
              color: '#ffffff',
              weight: 8,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
          {/* Trazo continuo azul navegación */}
          <Polyline
            positions={roadCoordinates}
            pathOptions={{
              color: '#2563eb',
              weight: 5,
              opacity: 1,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          >
            <Popup>
              <div className="p-1.5 text-xs min-w-[200px]">
                <strong className="text-blue-600 block font-bold text-sm">
                  Ruta del Bus
                </strong>
                {roadInfo && (
                  <div className="mt-1 flex items-center justify-between text-zinc-700 font-semibold">
                    <span>Distancia: <strong>{roadInfo.distance}</strong></span>
                    <span>Tiempo: <strong>{roadInfo.duration}</strong></span>
                  </div>
                )}
                {roadInfo?.summary && (
                  <p className="text-[11px] text-zinc-600 mt-1 font-medium">
                    Vía: {roadInfo.summary}
                  </p>
                )}
              </div>
            </Popup>
          </Polyline>
        </>
      )}

      {/* 2. Marcador del GPS del Cliente (Usuario) si está disponible */}
      {clientLocation && !isNaN(clientLocation.lat) && !isNaN(clientLocation.lng) && (
        <Marker
          position={[clientLocation.lat, clientLocation.lng]}
          icon={clientLocationIcon}
          zIndexOffset={1000}
        >
          <Popup>
            <div className="p-1.5 min-w-[170px]">
              <div className="flex items-center gap-1.5 text-blue-600 font-bold text-xs">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                Tu Ubicación Actual
              </div>
              <div className="text-[10px] text-zinc-400 mt-1 pt-1 border-t border-zinc-100">
                Lat: {clientLocation.lat.toFixed(5)}, Lng: {clientLocation.lng.toFixed(5)}
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* 3. Marcadores de todos los puntos de la ruta (P1, P2, P3, P4...) */}
      {puntosRuta && puntosRuta.length > 0 ? (
        puntosRuta.map((p, idx) => {
          const esPrimero = p.numero === 1;
          const esUltimo = idx === puntosRuta.length - 1;
          const icon = crearPuntoZoneIcon(p.numero, esPrimero, esUltimo);

          return (
            <Marker
              key={`marker-punto-${p.numero}`}
              position={[p.lat, p.lng]}
              icon={icon}
              zIndexOffset={1200 + p.numero * 10}
            >
              <Popup>
                <div className="p-2 min-w-[220px]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    {esPrimero ? 'Punto de Embarque (Punto 1)' : `Punto ${p.numero}`}
                  </div>
                  {p.departamento && (
                    <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {p.departamento.toUpperCase()}
                    </div>
                  )}
                  {p.llegada && (
                    <div className="text-xs font-semibold text-zinc-900 mt-2 flex items-center justify-between">
                      <span className="text-zinc-600">Llegó Bus:</span>
                      <span className="text-emerald-600 font-mono font-bold">{p.llegada}</span>
                    </div>
                  )}
                  {p.salida && (
                    <div className="text-xs font-semibold text-zinc-900 mt-1 flex items-center justify-between">
                      <span className="text-zinc-600">Salida:</span>
                      <span className="text-amber-600 font-mono font-bold">{p.salida}</span>
                    </div>
                  )}
                  <div className="mt-2 pt-1.5 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-400">
                    <span>Lat: {p.lat.toFixed(5)}</span>
                    <span>Lng: {p.lng.toFixed(5)}</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })
      ) : (
        <>
          {boardingPoint &&
            typeof boardingPoint.lat === 'number' &&
            typeof boardingPoint.lng === 'number' &&
            !isNaN(boardingPoint.lat) &&
            !isNaN(boardingPoint.lng) && (
              <Marker
                position={[boardingPoint.lat, boardingPoint.lng]}
                icon={boardingZoneIcon}
                zIndexOffset={1200}
              >
                <Popup>
                  <div className="p-2 min-w-[220px]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Punto de Embarque (Punto 1)
                    </div>
                    {boardingPoint.departamento && (
                      <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {boardingPoint.departamento.toUpperCase()}
                      </div>
                    )}
                    {boardingPoint.llegada && (
                      <div className="text-xs font-semibold text-zinc-900 mt-2 flex items-center justify-between">
                        <span className="text-zinc-600">Llegó Bus:</span>
                        <span className="text-emerald-600 font-mono font-bold">{boardingPoint.llegada}</span>
                      </div>
                    )}
                    {boardingPoint.salida && (
                      <div className="text-xs font-semibold text-zinc-900 mt-1 flex items-center justify-between">
                        <span className="text-zinc-600">Salida:</span>
                        <span className="text-amber-600 font-mono font-bold">{boardingPoint.salida}</span>
                      </div>
                    )}
                    <div className="mt-2 pt-1.5 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-400">
                      <span>Lat: {boardingPoint.lat.toFixed(5)}</span>
                      <span>Lng: {boardingPoint.lng.toFixed(5)}</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

          {punto2Point &&
            typeof punto2Point.lat === 'number' &&
            typeof punto2Point.lng === 'number' &&
            !isNaN(punto2Point.lat) &&
            !isNaN(punto2Point.lng) && (
              <Marker
                position={[punto2Point.lat, punto2Point.lng]}
                icon={punto2ZoneIcon}
                zIndexOffset={1300}
              >
                <Popup>
                  <div className="p-2 min-w-[220px]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      Punto 2 (Siguiente Embarque)
                    </div>
                    {punto2Point.departamento && (
                      <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-800 border border-indigo-200">
                        {punto2Point.departamento.toUpperCase()}
                      </div>
                    )}
                    {punto2Point.llegada && (
                      <div className="text-xs font-semibold text-zinc-900 mt-2 flex items-center justify-between">
                        <span className="text-zinc-600">Llegada:</span>
                        <span className="text-emerald-600 font-mono font-bold">{punto2Point.llegada}</span>
                      </div>
                    )}
                    {punto2Point.salida && (
                      <div className="text-xs font-semibold text-zinc-900 mt-1 flex items-center justify-between">
                        <span className="text-zinc-600">Salida:</span>
                        <span className="text-amber-600 font-mono font-bold">{punto2Point.salida}</span>
                      </div>
                    )}
                    <div className="mt-2 pt-1.5 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-400">
                      <span>Lat: {punto2Point.lat.toFixed(5)}</span>
                      <span>Lng: {punto2Point.lng.toFixed(5)}</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}
        </>
      )}

      {/* 5. Marcador del Bus / Pulser en vivo - Oculto si activo es false */}
      {busLocation &&
        busLocation.activo &&
        typeof busLocation.lat === 'number' &&
        typeof busLocation.lng === 'number' &&
        !isNaN(busLocation.lat) &&
        !isNaN(busLocation.lng) && (
          <Marker
            position={[busLocation.lat, busLocation.lng]}
            icon={busLocationIcon}
            zIndexOffset={1500}
          >
            <Popup>
              <div className="p-2 min-w-[210px]">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
                    Bus en Vivo
                  </span>
                  {busLocation.activo ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      EN EMBARQUE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                      EN RUTA
                    </span>
                  )}
                </div>

                {busLocation.horaLlegada && (
                  <div className="text-xs font-semibold text-zinc-900 mt-1 flex items-center justify-between">
                    <span className="text-zinc-600">Llegó:</span>
                    <span className="text-emerald-600 font-mono font-bold">{busLocation.horaLlegada}</span>
                  </div>
                )}

                {busLocation.horaSalida && (
                  <div className="text-xs font-semibold text-zinc-900 mt-0.5 flex items-center justify-between">
                    <span className="text-zinc-600">Salida:</span>
                    <span className="text-amber-600 font-mono font-bold">{busLocation.horaSalida}</span>
                  </div>
                )}

                <p className="text-xs text-zinc-600 mt-1">
                  {busLocation.estadoTexto || 'Transmitiendo ubicación activa'}
                </p>

                <div className="text-[10px] text-zinc-400 mt-1.5 pt-1.5 border-t border-zinc-100">
                  Lat: {busLocation.lat.toFixed(5)}, Lng: {busLocation.lng.toFixed(5)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}
    </MapContainer>
  );
}
