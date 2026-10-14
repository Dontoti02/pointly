import type { ClientLocation } from '@/types/map';

/**
 * Coordenadas por defecto (Piura, Perú) utilizadas como fallback si el cliente no otorga permiso de GPS.
 */
export const DEFAULT_PIURA_COORDINATES: ClientLocation = {
  lat: -5.2045,
  lng: -80.6300,
};

/**
 * Coordenadas del centro inicial del mapa cuando no hay bus seleccionado.
 */
export const DEFAULT_MAP_CENTER: [number, number] = [-5.22638, -80.62445];

/**
 * Calcula la distancia ortodrómica directa (Haversine) entre dos coordenadas geográficas.
 */
export function calculateDirectDistance(
  origen: { lat: number; lng: number } | null,
  destino: { lat: number; lng: number } | null
): string | null {
  if (!origen || !destino) return null;

  const R = 6371; // Radio terrestre en km
  const dLat = ((destino.lat - origen.lat) * Math.PI) / 180;
  const dLon = ((destino.lng - origen.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((origen.lat * Math.PI) / 180) *
      Math.cos((destino.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  if (d < 1) {
    return `${Math.round(d * 1000)} metros`;
  }
  return `${d.toFixed(1)} km`;
}
