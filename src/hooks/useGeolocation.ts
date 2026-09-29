import { useState, useCallback, useEffect } from 'react';
import type { ClientLocation } from '@/types/map';
import { DEFAULT_PIURA_COORDINATES } from '@/utils/geo';

export function useGeolocation(onLocationUpdated?: () => void) {
  const [clientGps, setClientGps] = useState<ClientLocation | null>(null);

  const obtenerGpsCliente = useCallback(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setClientGps({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          onLocationUpdated?.();
        },
        (err) => {
          console.warn('Aviso de GPS del navegador:', err.message);
          // Si el navegador deniega el GPS, inicializamos una ubicación cercana por defecto en Piura
          setClientGps((prev) => prev || DEFAULT_PIURA_COORDINATES);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setClientGps((prev) => prev || DEFAULT_PIURA_COORDINATES);
    }
  }, [onLocationUpdated]);

  useEffect(() => {
    obtenerGpsCliente();
  }, [obtenerGpsCliente]);

  return {
    clientGps,
    obtenerGpsCliente,
  };
}
