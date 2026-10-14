import { NextResponse } from 'next/server';

// Caché en memoria para evitar llamadas redundantes a geocodificación inversa
const geoCache = new Map<
  string,
  {
    departamento: string;
    provincia?: string;
    distrito?: string;
    pais?: string;
    timestamp: number;
  }
>();

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

// Lista de referencia para los 25 departamentos de Perú (fallback geográfico local)
const DEPARTAMENTOS_PERU = [
  { name: 'Amazonas', minLat: -6.95, maxLat: -2.98, minLng: -78.85, maxLng: -77.15, cLat: -5.0, cLng: -78.0 },
  { name: 'Áncash', minLat: -10.78, maxLat: -8.11, minLng: -78.68, maxLng: -76.71, cLat: -9.5, cLng: -77.5 },
  { name: 'Apurímac', minLat: -14.86, maxLat: -13.15, minLng: -73.85, maxLng: -72.05, cLat: -14.0, cLng: -73.0 },
  { name: 'Arequipa', minLat: -17.30, maxLat: -14.63, minLng: -75.08, maxLng: -70.81, cLat: -16.0, cLng: -72.5 },
  { name: 'Ayacucho', minLat: -15.65, maxLat: -12.35, minLng: -75.15, maxLng: -72.95, cLat: -14.1, cLng: -74.1 },
  { name: 'Cajamarca', minLat: -7.80, maxLat: -4.58, minLng: -79.43, maxLng: -77.73, cLat: -6.5, cLng: -78.5 },
  { name: 'Callao', minLat: -12.15, maxLat: -11.75, minLng: -77.25, maxLng: -77.05, cLat: -12.05, cLng: -77.14 },
  { name: 'Cusco', minLat: -15.45, maxLat: -11.18, minLng: -73.65, maxLng: -70.35, cLat: -13.5, cLng: -71.9 },
  { name: 'Huancavelica', minLat: -14.15, maxLat: -11.98, minLng: -75.82, maxLng: -74.28, cLat: -13.0, cLng: -75.0 },
  { name: 'Huánuco', minLat: -10.45, maxLat: -8.35, minLng: -77.15, maxLng: -74.55, cLat: -9.5, cLng: -75.8 },
  { name: 'Ica', minLat: -15.45, maxLat: -13.15, minLng: -76.45, maxLng: -74.70, cLat: -14.3, cLng: -75.5 },
  { name: 'Junín', minLat: -12.85, maxLat: -10.68, minLng: -76.55, maxLng: -73.65, cLat: -11.8, cLng: -75.1 },
  { name: 'La Libertad', minLat: -8.95, maxLat: -6.98, minLng: -79.75, maxLng: -76.95, cLat: -8.0, cLng: -78.5 },
  { name: 'Lambayeque', minLat: -7.20, maxLat: -5.45, minLng: -80.65, maxLng: -79.15, cLat: -6.5, cLng: -79.8 },
  { name: 'Lima', minLat: -13.35, maxLat: -10.25, minLng: -77.95, maxLng: -75.55, cLat: -11.8, cLng: -76.8 },
  { name: 'Loreto', minLat: -8.75, maxLat: -0.03, minLng: -77.85, maxLng: -69.95, cLat: -4.0, cLng: -74.5 },
  { name: 'Madre de Dios', minLat: -13.45, maxLat: -9.85, minLng: -72.45, maxLng: -68.65, cLat: -12.0, cLng: -70.5 },
  { name: 'Moquegua', minLat: -17.85, maxLat: -15.95, minLng: -71.55, maxLng: -70.35, cLat: -17.0, cLng: -71.0 },
  { name: 'Pasco', minLat: -11.25, maxLat: -9.85, minLng: -76.65, maxLng: -74.45, cLat: -10.5, cLng: -75.5 },
  { name: 'Piura', minLat: -6.45, maxLat: -4.05, minLng: -81.45, maxLng: -79.05, cLat: -5.2, cLng: -80.5 },
  { name: 'Puno', minLat: -17.35, maxLat: -12.98, minLng: -71.25, maxLng: -68.80, cLat: -15.0, cLng: -70.0 },
  { name: 'San Martín', minLat: -8.85, maxLat: -5.65, minLng: -77.85, maxLng: -75.65, cLat: -7.0, cLng: -76.7 },
  { name: 'Tacna', minLat: -18.35, maxLat: -16.75, minLng: -71.25, maxLng: -69.80, cLat: -17.7, cLng: -70.5 },
  { name: 'Tumbes', minLat: -4.35, maxLat: -3.35, minLng: -81.05, maxLng: -80.05, cLat: -3.8, cLng: -80.5 },
  { name: 'Ucayali', minLat: -11.55, maxLat: -7.35, minLng: -75.65, maxLng: -70.55, cLat: -9.5, cLng: -73.5 },
];

function fallbackDepartamento(lat: number, lng: number): string {
  // Buscar departamento más cercano por centroide
  let closest = 'Perú';
  let minDist = Infinity;
  for (const dep of DEPARTAMENTOS_PERU) {
    const dist = Math.hypot(lat - dep.cLat, lng - dep.cLng);
    if (dist < minDist) {
      minDist = dist;
      closest = dep.name;
    }
  }
  return closest;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');

    const lat = Number(latParam);
    const lng = Number(lngParam);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { ok: false, error: 'Coordenadas lat y lng requeridas.' },
        { status: 400 }
      );
    }

    // Clave de caché por ~100 metros
    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    const cached = geoCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({ ok: true, ...cached, fromCache: true });
    }

    let departamento = '';
    let provincia = '';
    let distrito = '';
    let pais = 'Perú';

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Pointly-ReverseGeocode/1.0 (contacto@pointly.pe)',
          Accept: 'application/json',
        },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const address = data?.address || {};
        departamento = address.state || address.region || '';
        provincia = address.county || address.region || address.state_district || '';
        distrito = address.city || address.town || address.village || address.suburb || '';
        pais = address.country || 'Perú';
      }
    } catch {
      // Si la consulta externa falla o hay timeout, usar fallback local
    }

    if (!departamento) {
      departamento = fallbackDepartamento(lat, lng);
    }

    // Limpieza de prefijos comunes
    departamento = departamento.replace(/^Departamento de /i, '').trim();

    const nombres = [distrito, provincia, departamento].filter(Boolean);

    const resultado = {
      departamento,
      provincia,
      distrito,
      pais,
      display: departamento,
      nombres,
      timestamp: Date.now(),
    };

    geoCache.set(key, resultado);

    return NextResponse.json({ ok: true, ...resultado });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Error en detección de departamento.' },
      { status: 500 }
    );
  }
}
