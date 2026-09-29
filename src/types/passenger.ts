import type { BoardingPoint, BusLocation } from './map';

export interface PasajeroData {
  nombre: string;
  dni?: string;
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

export interface GreetingInfo {
  saludoCompleto: string;
  nombrePila: string;
  saludoTiempo: string;
  mensajeBienvenida: string;
  nombreCompletoFormateado?: string;
}
