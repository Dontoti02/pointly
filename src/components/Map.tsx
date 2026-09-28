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

    // Si el usuario presiona el botón de centrar, reiniciamos la bandera de interacción
    if (isManualTrigger) {
      userInteracted.current = false;
    }

    // Si el usuario ya está navegando libremente con mouse/touch y no es un centrado manual, NO interferir
    if (userInteracted.current && !isManualTrigger) {
      return;
    }

    // Encuadrar la ruta completa dejando espacio para la interfaz
    if (routeBounds && routeBounds.length >= 2) {
      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
      map.fitBounds(routeBounds, {
        paddingTopLeft: [40, 40],
        paddingBottomRight: isDesktop ? [400, 40] : [40, 160],
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

// Ícono para la Zona de Abordaje del Pasajero - Esmeralda moderna
const boardingZoneIcon = L.divIcon({
  className: 'boarding-zone-marker',
  html: `
    <div style="
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      width: 42px;
      height: 42px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid #ffffff;
      box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4);
    ">
      <div style="transform: rotate(45deg); color: white; display: flex;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [42, 42],
  iconAnchor: [21, 42],
  popupAnchor: [0, -44],
});

// Ícono para el Bus / Pulser en vivo - Ámbar cálido con vehículo
const busLocationIcon = L.divIcon({
  className: 'bus-location-marker',
  html: `
    <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 50px; height: 50px; background: rgba(245, 158, 11, 0.3); border-radius: 50%; animation: pulse 2s infinite;"></div>
      <div style="
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid #ffffff;
        box-shadow: 0 4px 16px rgba(245, 158, 11, 0.5);
      ">
        <div style="color: white; display: flex;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
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
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -26],
});

export interface BoardingPoint {
  lat: number;
  lng: number;
  nombreLugar: string;
  referencia?: string;
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
  timestamp?: number | null;
  velocidad?: number | null;
  estado?: 'LLEGO' | 'SALIDA' | 'EN_CAMINO';
  estadoTexto?: string;
  actualizado?: string | number | null;
}

export interface MapProps {
  boardingPoint?: BoardingPoint | null;
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
  clientLocation,
  busLocation,
  center = [-5.22638, -80.62445],
  zoom = 14,
  className = 'h-full w-full',
  passengerName,
  recenterTrigger = 0,
  onRouteCalculated,
}: MapProps) {
  // Estado para la geometría real de calles (Google Maps style)
  const [roadCoordinates, setRoadCoordinates] = useState<[number, number][] | null>(null);
  const [roadInfo, setRoadInfo] = useState<{ distance: string; duration: string; summary?: string } | null>(null);

  // Punto de origen de la ruta (prioridad: GPS del usuario; si no tiene GPS, paradero de abordaje dinámico)
  const originPoint = useMemo(() => {
    if (clientLocation) return { lat: clientLocation.lat, lng: clientLocation.lng, label: 'Tu Ubicación' };
    if (
      boardingPoint &&
      typeof boardingPoint.lat === 'number' &&
      typeof boardingPoint.lng === 'number' &&
      !isNaN(boardingPoint.lat) &&
      !isNaN(boardingPoint.lng)
    ) {
      return { lat: boardingPoint.lat, lng: boardingPoint.lng, label: 'Punto de Abordaje' };
    }
    return null;
  }, [clientLocation, boardingPoint]);

  // Límites prioritarios para encuadrar la ruta hacia el bus
  const routeBounds = useMemo(() => {
    if (originPoint && busLocation) {
      return [
        [originPoint.lat, originPoint.lng] as [number, number],
        [busLocation.lat, busLocation.lng] as [number, number],
      ];
    }
    if (
      clientLocation &&
      boardingPoint &&
      typeof boardingPoint.lat === 'number' &&
      typeof boardingPoint.lng === 'number' &&
      !isNaN(boardingPoint.lat) &&
      !isNaN(boardingPoint.lng)
    ) {
      return [
        [clientLocation.lat, clientLocation.lng] as [number, number],
        [boardingPoint.lat, boardingPoint.lng] as [number, number],
      ];
    }
    return undefined;
  }, [originPoint, busLocation, clientLocation, boardingPoint]);

  // Centro prioritario del mapa
  const initialCenter: [number, number] = useMemo(() => {
    if (busLocation) return [busLocation.lat, busLocation.lng];
    if (originPoint) return [originPoint.lat, originPoint.lng];
    return center;
  }, [busLocation, originPoint, center]);

  // Consulta automática de la ruta por calles (Google Maps style vía /api/ruta)
  useEffect(() => {
    if (!originPoint || !busLocation) {
      setRoadCoordinates(null);
      setRoadInfo(null);
      return;
    }

    let isMounted = true;

    fetch('/api/ruta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startLat: originPoint.lat,
        startLng: originPoint.lng,
        endLat: busLocation.lat,
        endLng: busLocation.lng,
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
          // Fallback a línea directa si no se encuentra ruta vial
          const directCoords: [number, number][] = [
            [originPoint.lat, originPoint.lng],
            [busLocation.lat, busLocation.lng],
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
            [originPoint.lat, originPoint.lng],
            [busLocation.lat, busLocation.lng],
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
  }, [
    originPoint?.lat,
    originPoint?.lng,
    busLocation?.lat,
    busLocation?.lng,
    busLocation?.timestamp,
    busLocation?.horaGenerada,
    onRouteCalculated,
  ]);

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

      {/* 1. LÍNEA DE RUTA VIAL ESTILO GOOGLE MAPS (Renderizada siguiendo calles y avenidas) */}
      {roadCoordinates && roadCoordinates.length >= 2 && (
        <>
          {/* Capa de borde / contorno exterior para contraste nítido (Halo blanco/azul oscuro) */}
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
          {/* Línea de navegación principal continua estilo Google Maps Navigation */}
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
              <div className="p-1.5 text-xs min-w-[190px]">
                <strong className="text-blue-600 block font-bold text-sm">
                  Ruta vial hacia el Bus
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
                <span className="text-[10px] text-zinc-400 block mt-1 pt-1 border-t border-zinc-100">
                  Sigue esta ruta vial para llegar al bus
                </span>
              </div>
            </Popup>
          </Polyline>
        </>
      )}

      {/* 2. Marcador del GPS del Cliente (Usuario) */}
      {clientLocation && (
        <Marker
          position={[clientLocation.lat, clientLocation.lng]}
          icon={clientLocationIcon}
          zIndexOffset={1000}
        >
          <Popup>
            <div className="p-1.5 min-w-[170px]">
              <div className="flex items-center gap-1.5 text-blue-600 font-bold text-xs">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                Tu Ubicación Actual (GPS)
              </div>
              <p className="text-[11px] text-zinc-600 mt-1">
                Punto de partida hacia el bus
              </p>
              <div className="text-[10px] text-zinc-400 mt-1 pt-1 border-t border-zinc-100">
                Lat: {clientLocation.lat.toFixed(5)}, Lng: {clientLocation.lng.toFixed(5)}
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* 3. Marcador de la Zona de Abordaje del Pasajero (si tiene coordenadas) */}
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
            <div className="p-1.5 min-w-[210px]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <span>Punto de Abordaje Asignado</span>
              </div>
              <h4 className="font-bold text-sm text-zinc-900 mt-0.5">
                {boardingPoint.nombreLugar}
              </h4>
              {passengerName && (
                <p className="text-xs text-zinc-600 mt-1">
                  Pasajero: <strong className="text-zinc-800">{passengerName}</strong>
                </p>
              )}
              {boardingPoint.referencia && (
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Ref: {boardingPoint.referencia}
                </p>
              )}
              <div className="mt-2 pt-1.5 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-400">
                <span>Lat: {boardingPoint.lat.toFixed(4)}</span>
                <span>Lng: {boardingPoint.lng.toFixed(4)}</span>
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* 4. Marcador del Bus / Pulser en vivo */}
      {busLocation && (
        <Marker
          position={[busLocation.lat, busLocation.lng]}
          icon={busLocationIcon}
          zIndexOffset={1500}
        >
          <Popup>
            <div className="p-1.5 min-w-[210px]">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
                  Bus
                </span>
                {busLocation.estado === 'LLEGO' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    YA LLEGÓ
                  </span>
                ) : busLocation.estado === 'SALIDA' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                    EN RUTA
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
                    EN CAMINO
                  </span>
                )}
              </div>

              {busLocation.horaGenerada && (
                <div className="text-xs font-semibold text-zinc-900 mt-1">
                  {busLocation.estado === 'SALIDA'
                    ? 'Hora de salida:'
                    : busLocation.estado === 'LLEGO'
                    ? 'Hora de llegada:'
                    : 'Hora generada:'}{' '}
                  <span className="text-amber-600 font-mono">{busLocation.horaGenerada}</span>
                </div>
              )}

              <p className="text-xs text-zinc-600 mt-0.5">
                {busLocation.estadoTexto || 'Transmitiendo ubicación activa'}
              </p>

              {busLocation.velocidad != null && (
                <p className="text-[11px] text-zinc-500 mt-1">
                  Velocidad: {busLocation.velocidad} km/h
                </p>
              )}
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
