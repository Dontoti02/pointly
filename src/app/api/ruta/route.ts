import { NextResponse } from 'next/server';

// Caché en memoria para evitar saturar el motor de rutas
const routeCache = new Map<
  string,
  {
    coords: [number, number][];
    distanceMeters: number;
    distanceText: string;
    durationSeconds: number;
    durationText: string;
    summary: string;
    timestamp: number;
  }
>();

const CACHE_TTL_MS = 60 * 1000; // 1 minuto de caché por par de coordenadas

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { startLat, startLng, endLat, endLng, profile = 'driving' } = body;

    const sLat = Number(startLat);
    const sLng = Number(startLng);
    const eLat = Number(endLat);
    const eLng = Number(endLng);

    if (isNaN(sLat) || isNaN(sLng) || isNaN(eLat) || isNaN(eLng)) {
      return NextResponse.json(
        { ok: false, error: 'Coordenadas inválidas para calcular la ruta vial.' },
        { status: 400 }
      );
    }

    // Clave de caché redondeada a 4 decimales (~11 metros de precisión)
    const cacheKey = `${sLat.toFixed(4)},${sLng.toFixed(4)}->${eLat.toFixed(4)},${eLng.toFixed(4)}:${profile}`;
    const cached = routeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({ ok: true, ...cached, fromCache: true });
    }

    // Servidores de ruteo vehicular / peatonal de código abierto
    const routingUrls = [
      `https://router.project-osrm.org/route/v1/${profile}/${sLng},${sLat};${eLng},${eLat}?overview=full&geometries=geojson&steps=true`,
      `https://routing.openstreetmap.de/routed-car/route/v1/driving/${sLng},${sLat};${eLng},${eLat}?overview=full&geometries=geojson&steps=true`,
    ];

    let routeData: any = null;

    for (const url of routingUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'RPuntoPersonal-Navigation/1.0',
            Accept: 'application/json',
          },
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          if (json.code === 'Ok' && json.routes && json.routes[0]) {
            routeData = json.routes[0];
            break;
          }
        }
      } catch (e) {
        // Intenta siguiente servidor espejo
      }
    }

    if (!routeData) {
      // Si el perfil driving no encuentra vía directa (ej. zona peatonal estricta), intentar perfil walking
      if (profile === 'driving') {
        try {
          const walkUrl = `https://router.project-osrm.org/route/v1/walking/${sLng},${sLat};${eLng},${eLat}?overview=full&geometries=geojson&steps=true`;
          const walkRes = await fetch(walkUrl);
          if (walkRes.ok) {
            const walkJson = await walkRes.json();
            if (walkJson.code === 'Ok' && walkJson.routes && walkJson.routes[0]) {
              routeData = walkJson.routes[0];
            }
          }
        } catch {
          // Ignorar y seguir al fallback
        }
      }
    }

    if (routeData && routeData.geometry && Array.isArray(routeData.geometry.coordinates)) {
      // Convertir de GeoJSON [lng, lat] a formato Leaflet [lat, lng]
      const coords: [number, number][] = routeData.geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]]
      );

      const distanceMeters = Number(routeData.distance) || 0;
      const durationSeconds = Number(routeData.duration) || 0;

      const distanceText =
        distanceMeters < 1000
          ? `${Math.round(distanceMeters)} m`
          : `${(distanceMeters / 1000).toFixed(1)} km`;

      const minutes = Math.max(1, Math.round(durationSeconds / 60));
      const durationText = minutes >= 60
        ? `${Math.floor(minutes / 60)} h ${minutes % 60} min`
        : `~${minutes} min`;

      // Extraer resumen de vías principales (ej: "Av. Progreso")
      let summary = '';
      if (routeData.legs && routeData.legs[0] && Array.isArray(routeData.legs[0].steps)) {
        const names: string[] = [];
        for (const step of routeData.legs[0].steps) {
          if (step.name && step.name.trim() && !names.includes(step.name.trim())) {
            names.push(step.name.trim());
          }
        }
        summary = names.slice(0, 3).join(' / ');
      }

      const result = {
        coords,
        distanceMeters,
        distanceText,
        durationSeconds,
        durationText,
        summary: summary || 'Vías principales',
        timestamp: Date.now(),
      };

      routeCache.set(cacheKey, result);

      return NextResponse.json({
        ok: true,
        ...result,
      });
    }

    // Fallback si ningún servidor responde: devuelve línea directa pero con estado
    return NextResponse.json({
      ok: false,
      error: 'No se pudo generar la ruta vial en este momento.',
      coords: [
        [sLat, sLng],
        [eLat, eLng],
      ],
      distanceText: 'Calculando...',
      durationText: '--',
    });
  } catch (error: any) {
    console.error('Error en /api/ruta:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Error al calcular la ruta.' },
      { status: 500 }
    );
  }
}
