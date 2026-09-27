import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { firebaseConfig, DB_COLLECTIONS } from '@/lib/firebase';

// Inicialización de Firebase en el entorno de servidor
function getFirebaseServer() {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  let db;
  try {
    db = initializeFirestore(app, { experimentalForceLongPolling: true });
  } catch {
    db = getFirestore(app);
  }
  const auth = getAuth(app);
  return { app, db, auth };
}



export async function POST(req: Request) {
  try {
    const body = await req.json();
    const dni = String(body.dni || '').trim();

    if (!dni || dni.length < 6) {
      return NextResponse.json(
        { ok: false, error: 'Por favor ingrese un número de DNI válido.' },
        { status: 400 }
      );
    }

    const { db, auth } = getFirebaseServer();

    // Autenticación anónima para cumplir con las reglas de seguridad
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }

    // 1. Lee la colección del manifiesto buscando de forma segura el registro del DNI
    const snapManifiesto = await getDocs(collection(db, DB_COLLECTIONS.MANIFIESTO));

    let pasajeroEncontrado: {
      nombre: string;
      dni: string | number;
      telefono?: string;
      punto?: string;
      abordo?: boolean;
      asiento?: number;
      lat?: number;
      lng?: number;
      latitude?: number;
      longitude?: number;
      referencia?: string;
      nombreLugar?: string;
    } | null = null;

    let uidpulser: string | null = null;
    let tipoOperacion: string | null = null;
    let puntosRuta: string[] = [];

    for (const docSnap of snapManifiesto.docs) {
      const data = docSnap.data();
      if (!data.registros || !Array.isArray(data.registros)) continue;

      for (const reg of data.registros) {
        if (String(reg.dni).trim() === dni) {
          pasajeroEncontrado = reg;
          uidpulser = data.uidpulser || null;
          tipoOperacion = data.tipo || 'subida';

          // Extraer secuencia de puntos de abordaje de este manifiesto
          for (const r of data.registros) {
            if (r.punto && !puntosRuta.includes(String(r.punto).toUpperCase())) {
              puntosRuta.push(String(r.punto).toUpperCase());
            }
          }
          break;
        }
      }
      if (pasajeroEncontrado) break;
    }

    if (!pasajeroEncontrado) {
      return NextResponse.json(
        {
          ok: false,
          error: `No se encontró ningún registro activo para el DNI ingresado. Verifique el número o consulte con el supervisor de ruta.`,
        },
        { status: 404 }
      );
    }

    // Determinar siguiente punto de abordaje en la ruta
    let siguientePunto: string | null = null;
    const puntoPasajeroUpper = String(pasajeroEncontrado.punto || '').toUpperCase().trim();
    if (puntoPasajeroUpper) {
      const idx = puntosRuta.indexOf(puntoPasajeroUpper);
      if (idx >= 0 && idx + 1 < puntosRuta.length) {
        siguientePunto = puntosRuta[idx + 1];
      } else if (puntosRuta.length > 1) {
        siguientePunto = puntosRuta.find((p) => p !== puntoPasajeroUpper) || null;
      }
    }

    // 2. Lee la ubicación y estado activo del pulser (en ubicaciones1 y ubicaciones)
    let coordenadasPulser: {
      lat: number;
      lng: number;
      activo: boolean;
      timestamp: number | null;
      horaGenerada: string | null;
      velocidad?: number | null;
      estado: 'LLEGO' | 'SALIDA' | 'EN_CAMINO';
      estadoTexto: string;
    } | null = null;

    if (uidpulser) {
      try {
        let pData1: any = null;
        let pData0: any = null;

        // Consulta en ubicaciones1 (GPS en vivo)
        try {
          const snap1 = await getDoc(doc(db, DB_COLLECTIONS.UBICACIONES, uidpulser));
          if (snap1.exists()) {
            pData1 = snap1.data();
          } else {
            const q1 = await getDocs(
              query(collection(db, DB_COLLECTIONS.UBICACIONES), where('uidpulser', '==', uidpulser))
            );
            if (!q1.empty) pData1 = q1.docs[0].data();
          }
        } catch (e1) {
          console.warn('Advertencia al consultar ubicaciones1:', e1);
        }

        // Consulta en ubicaciones (Marcaciones de llegada/salida y estado del pulser)
        try {
          const snap0 = await getDoc(doc(db, DB_COLLECTIONS.UBICACIONES_ESTADO, uidpulser));
          if (snap0.exists()) {
            pData0 = snap0.data();
          } else {
            const q0 = await getDocs(
              query(collection(db, DB_COLLECTIONS.UBICACIONES_ESTADO), where('uidpulser', '==', uidpulser))
            );
            if (!q0.empty) pData0 = q0.docs[0].data();
          }
        } catch (e0) {
          console.warn('Advertencia al consultar ubicaciones:', e0);
        }

        if (pData1 || pData0) {
          // Helper para normalizar 'activo' sin errores de tipo string/boolean
          const parseBoolActivo = (val: any): boolean | null => {
            if (val === undefined || val === null) return null;
            if (val === false || val === 'false' || val === 0 || val === '0' || val === 'FALSE') return false;
            if (val === true || val === 'true' || val === 1 || val === '1' || val === 'TRUE') return true;
            return Boolean(val);
          };

          const activo1 = parseBoolActivo(pData1?.activo);
          const activo0 = parseBoolActivo(pData0?.activo);

          // Extraer timestamps de llegada y salida
          const getTimestampSeconds = (t: any): number | null => {
            if (!t) return null;
            if (typeof t.seconds === 'number') return t.seconds;
            if (typeof t === 'number') return t;
            return null;
          };

          const llegadaSec = getTimestampSeconds(pData0?.llegada) || getTimestampSeconds(pData1?.llegada);
          const salidaSec = getTimestampSeconds(pData0?.salida) || getTimestampSeconds(pData1?.salida);
          const gpsTimestampSec = getTimestampSeconds(pData1?.timestamp) || getTimestampSeconds(pData0?.timestamp);

          // Coordenadas: preferir las de ubicaciones1 (GPS activo) o ubicaciones
          let lat = NaN;
          let lng = NaN;
          if (pData1 && !isNaN(Number(pData1.lat ?? pData1.latitude))) {
            lat = Number(pData1.lat ?? pData1.latitude);
            lng = Number(pData1.lng ?? pData1.lon ?? pData1.longitude);
          } else if (pData0 && !isNaN(Number(pData0.lat ?? pData0.latitude))) {
            lat = Number(pData0.lat ?? pData0.latitude);
            lng = Number(pData0.lng ?? pData0.lon ?? pData0.longitude);
          }

          // Determinar con certeza si está activo o desactivado (salida)
          let activo = true;
          if (activo0 === false || activo1 === false) {
            // Si el pulser desactivó explícitamente en cualquiera de las colecciones -> DESACTIVADO
            activo = false;
          } else if (salidaSec && llegadaSec && salidaSec >= llegadaSec) {
            // Si la hora de salida registrada es más reciente o igual a la llegada -> SALIDA realizada
            activo = false;
          } else if (activo0 === true || activo1 === true) {
            activo = true;
          } else {
            activo = false;
          }

          // Helper para dar formato a la hora en es-PE
          const formatHora = (sec: number | null): string | null => {
            if (!sec) return null;
            const dateObj = new Date(sec * 1000);
            return dateObj.toLocaleTimeString('es-PE', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            });
          };

          // Determinación estricta de estados:
          // 1. SALIDA: El pulser desactivó (activo === false) o marcó salida
          // 2. LLEGO: El pulser está activo y marcó llegada a la zona de abordaje
          // 3. EN_CAMINO: No se ha confirmado llegada o está en tránsito
          let estado: 'LLEGO' | 'SALIDA' | 'EN_CAMINO' = 'EN_CAMINO';
          let estadoTexto = 'En camino a la zona de abordaje';
          let horaReferenciaSec: number | null = null;

          if (!activo || (salidaSec && llegadaSec && salidaSec >= llegadaSec)) {
            estado = 'SALIDA';
            horaReferenciaSec = salidaSec || gpsTimestampSec;
            const horaStr = formatHora(horaReferenciaSec);
            estadoTexto = horaStr ? `Salida realizada (${horaStr})` : 'Salida realizada (Esperando siguiente punto)';
          } else if (activo === true) {
            estado = 'LLEGO';
            horaReferenciaSec = llegadaSec || gpsTimestampSec;
            const horaStr = formatHora(horaReferenciaSec);
            estadoTexto = horaStr ? `Ya llegó (${horaStr})` : 'Ya llegó el bus';
          } else {
            estado = 'EN_CAMINO';
            estadoTexto = 'Esperando confirmación de llegada del bus';
          }

          const horaGenerada = formatHora(horaReferenciaSec);

          if (!isNaN(lat) && !isNaN(lng)) {
            coordenadasPulser = {
              lat,
              lng,
              activo,
              timestamp: horaReferenciaSec || gpsTimestampSec,
              horaGenerada,
              velocidad: pData1?.velocidad || pData0?.velocidad || null,
              estado,
              estadoTexto,
            };
          }
        }
      } catch (err) {
        console.warn('Advertencia al consultar ubicaciones del pulser:', err);
      }
    }

    // 4. Determina la coordenada de la zona de abordaje (únicamente si viene registrada dinámicamente)
    let coordenadasAbordaje: {
      lat: number;
      lng: number;
      nombreLugar: string;
      referencia?: string;
    } | null = null;

    const rawLat = pasajeroEncontrado.lat ?? pasajeroEncontrado.latitude;
    const rawLng = pasajeroEncontrado.lng ?? pasajeroEncontrado.longitude;

    if (rawLat !== undefined && rawLat !== null && rawLng !== undefined && rawLng !== null) {
      const parsedLat = Number(rawLat);
      const parsedLng = Number(rawLng);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        coordenadasAbordaje = {
          lat: parsedLat,
          lng: parsedLng,
          nombreLugar:
            pasajeroEncontrado.nombreLugar ||
            pasajeroEncontrado.punto ||
            'Zona de Abordaje',
          referencia: pasajeroEncontrado.referencia,
        };
      }
    }

    // 5. Retorna la respuesta MÍNIMA y EXCLUSIVA de este único pasajero
    // Cero exposición de datos de terceros
    return NextResponse.json({
      ok: true,
      pasajero: {
        nombre: pasajeroEncontrado.nombre,
        punto: pasajeroEncontrado.punto || 'Punto Asignado',
        abordo: Boolean(pasajeroEncontrado.abordo),
        asiento: pasajeroEncontrado.asiento || null,
        tipo: tipoOperacion,
        uidpulser: uidpulser,
        siguientePunto: siguientePunto,
        puntosRuta: puntosRuta,
        coordenadasAbordaje: coordenadasAbordaje,
        coordenadasPulser: coordenadasPulser,
      },
    });
  } catch (error: any) {
    console.error('Error al consultar pasajero:', error);
    return NextResponse.json(
      { ok: false, error: `Error: ${error?.message || error}` },
      { status: 500 }
    );
  }
}
