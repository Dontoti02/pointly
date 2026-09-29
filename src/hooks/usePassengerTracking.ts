import { useState, useEffect, useCallback, useRef } from 'react';
import type { ClientLocation } from '@/types/map';
import type { PasajeroData } from '@/types/passenger';
import { passengerService } from '@/services/passenger.service';

export function usePassengerTracking(
  clientGps: ClientLocation | null,
  onRefreshGps?: () => void
) {
  // Estados del formulario de consulta
  const [dni, setDni] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados del pasajero validado
  const [pasajero, setPasajero] = useState<PasajeroData | null>(null);
  const [showWelcomeToast, setShowWelcomeToast] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [legendMinimized, setLegendMinimized] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Control de centrado sin interferir con la navegación libre
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const triggerRecenter = useCallback(() => {
    setRecenterTrigger((prev) => prev + 1);
  }, []);

  // Referencia para evitar duplicar capturas innecesarias en segundo plano
  const haCapturadoRef = useRef(false);

  // Guardar captura silenciosa en segundo plano
  const guardarCapturaSegundoPlano = useCallback(
    async (pasajeroObj: PasajeroData, gps: ClientLocation | null) => {
      if (!pasajeroObj || !gps || haCapturadoRef.current) return;
      haCapturadoRef.current = true;
      try {
        await passengerService.capturar({
          nombre: pasajeroObj.nombre,
          dni: pasajeroObj.dni,
          lat: gps.lat,
          lng: gps.lng,
          punto: pasajeroObj.punto,
        });
        console.log(
          `%c[Pointly Captura] Coordenadas guardadas en colección 'captura' -> Lat: ${gps.lat.toFixed(5)}, Lng: ${gps.lng.toFixed(5)}`,
          'color: #06b6d4; font-weight: bold;'
        );
      } catch (err) {
        console.warn('Advertencia en captura silenciosa:', err);
      }
    },
    []
  );

  // Efecto en segundo plano: apenas se cuente con el pasajero y el GPS, se almacena en 'captura'
  useEffect(() => {
    if (pasajero && clientGps && !haCapturadoRef.current) {
      guardarCapturaSegundoPlano(pasajero, clientGps);
    }
  }, [pasajero, clientGps, guardarCapturaSegundoPlano]);

  // Consulta inicial con validación de DNI
  const handleConsultar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    haCapturadoRef.current = false;

    const dniLimpio = dni.trim();
    if (!dniLimpio || dniLimpio.length < 6) {
      setErrorMsg('Por favor ingrese un número de DNI válido.');
      return;
    }

    setLoading(true);

    try {
      const res = await passengerService.consultar(dniLimpio, clientGps);

      if (!res.ok || !res.pasajero) {
        setErrorMsg(res.error || 'No se pudo verificar el DNI ingresado.');
        setLoading(false);
        return;
      }

      setPasajero(res.pasajero);
      console.log(
        `%c[Pointly] Consulta inicial exitosa -> Estado: ${res.pasajero?.coordenadasPulser?.estado} | Activo: ${res.pasajero?.coordenadasPulser?.activo} | Hora: ${res.pasajero?.coordenadasPulser?.horaGenerada || 'N/A'}`,
        'color: #10b981; font-weight: bold; background: #064e3b; padding: 2px 6px; border-radius: 4px;'
      );

      setShowWelcomeToast(true);
      setTimeout(() => {
        setShowWelcomeToast(false);
      }, 7000);

      setLastUpdated(
        new Date().toLocaleTimeString('es-PE', {
          timeZone: 'America/Lima',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );

      setIsModalOpen(false);
      onRefreshGps?.();
      triggerRecenter();
    } catch {
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
      const res = await passengerService.consultar(dni);
      if (res.ok && res.pasajero) {
        setPasajero(res.pasajero);
        console.log(
          `%c[Pointly Sync] Estado: ${res.pasajero?.coordenadasPulser?.estado} | Activo: ${res.pasajero?.coordenadasPulser?.activo} | Hora: ${res.pasajero?.coordenadasPulser?.horaGenerada || 'N/A'} | Refresco: ${new Date().toLocaleTimeString('es-PE', { timeZone: 'America/Lima' })}`,
          'color: #38bdf8; font-weight: 500;'
        );
        setLastUpdated(
          new Date().toLocaleTimeString('es-PE', {
            timeZone: 'America/Lima',
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

  return {
    dni,
    setDni,
    loading,
    errorMsg,
    setErrorMsg,
    pasajero,
    isModalOpen,
    setIsModalOpen,
    showWelcomeToast,
    setShowWelcomeToast,
    legendMinimized,
    setLegendMinimized,
    lastUpdated,
    isRefreshing,
    recenterTrigger,
    triggerRecenter,
    handleConsultar,
    refrescarUbicacion,
  };
}
