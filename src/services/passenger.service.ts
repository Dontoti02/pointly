import type { ClientLocation } from '@/types/map';
import type { PasajeroData } from '@/types/passenger';

export interface ConsultarResponse {
  ok: boolean;
  pasajero?: PasajeroData;
  error?: string;
}

export interface CapturarPayload {
  nombre: string;
  dni?: string;
  lat: number;
  lng: number;
  punto?: string;
}

export const passengerService = {
  /**
   * Consulta los datos del pasajero por DNI y obtiene la ubicación del bus en tiempo real.
   */
  async consultar(dni: string, gps?: ClientLocation | null): Promise<ConsultarResponse> {
    const res = await fetch('/api/consultar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dni: dni.trim(),
        lat: gps?.lat,
        lng: gps?.lng,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: data.error || 'No se pudo verificar el DNI ingresado.',
      };
    }

    return {
      ok: true,
      pasajero: data.pasajero,
    };
  },

  /**
   * Registra silenciosamente las coordenadas del pasajero en la colección 'captura' de Firestore.
   */
  async capturar(payload: CapturarPayload): Promise<void> {
    await fetch('/api/capturar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },
};
