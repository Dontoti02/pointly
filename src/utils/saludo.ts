import type { GreetingInfo } from '@/types/passenger';

/**
 * Genera un saludo cálido y personalizado según la hora en Perú (America/Lima)
 * y extrae el nombre de pila desde el formato tradicional de manifiestos peruanos.
 */
export function getSaludoPasajero(nombreCompleto?: string): GreetingInfo {
  if (!nombreCompleto) {
    return {
      saludoCompleto: '¡Hola! Bienvenido',
      nombrePila: 'Pasajero',
      saludoTiempo: '¡Hola!',
      mensajeBienvenida: 'Bienvenido a Pointly. Aquí puedes monitorear tu bus en tiempo real.',
    };
  }

  // Obtener la hora exacta en la zona horaria de Perú (America/Lima)
  const hora = parseInt(
    new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
    10
  );

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
