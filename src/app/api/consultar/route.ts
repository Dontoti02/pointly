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

          // Extraer timestamps de llegada, salida y GPS en vivo
          const getTimestampSeconds = (t: any): number | null => {
            if (!t) return null;
            if (typeof t.seconds === 'number') return t.seconds;
            if (typeof t === 'number') return t;
            return null;
          };

          const llegadaSec = getTimestampSeconds(pData0?.llegada) || getTimestampSeconds(pData1?.llegada) || 0;
          const salidaSec = getTimestampSeconds(pData0?.salida) || getTimestampSeconds(pData1?.salida) || 0;
          const gpsTimestampSec = getTimestampSeconds(pData1?.timestamp) || getTimestampSeconds(pData0?.timestamp) || 0;

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

          // RESOLUCIÓN CRONOLÓGICA Y DETERMINACIÓN DE ESTADOS
          let activo = false;
          let estado: 'LLEGO' | 'SALIDA' | 'EN_CAMINO' = 'EN_CAMINO';
          let estadoTexto = 'En camino a la zona de abordaje';
          let horaReferenciaSec: number | null = null;
          let motivoLog = '';

          if (salidaSec > llegadaSec && (salidaSec >= gpsTimestampSec || activo1 === false)) {
            // Caso 1: La salida registrada es posterior a la llegada y el pulser no está activo posteriormente
            activo = false;
            estado = 'SALIDA';
            horaReferenciaSec = salidaSec || gpsTimestampSec;
            motivoLog = `Salida registrada posterior a llegada (salida: ${formatHora(salidaSec)} > llegada: ${formatHora(llegadaSec)})`;
          } else if (llegadaSec > salidaSec) {
            // Caso 2: Se registró una nueva llegada posterior a la salida
            activo = true;
            estado = 'LLEGO';
            horaReferenciaSec = llegadaSec || gpsTimestampSec;
            motivoLog = `Nueva llegada registrada posterior a salida (llegada: ${formatHora(llegadaSec)} > salida: ${formatHora(salidaSec)})`;
          } else if (activo1 === true && gpsTimestampSec >= salidaSec) {
            // Caso 3: El pulser activó a true y está transmitiendo GPS después de la salida
            activo = true;
            estado = 'LLEGO';
            horaReferenciaSec = llegadaSec || gpsTimestampSec;
            motivoLog = `Pulser reactivado a TRUE en ubicaciones1 (GPS: ${formatHora(gpsTimestampSec)} >= salida: ${formatHora(salidaSec)})`;
          } else if (activo1 === false) {
            // Caso 4: Pulser desactivó explícitamente en ubicaciones1
            activo = false;
            estado = 'SALIDA';
            horaReferenciaSec = salidaSec || gpsTimestampSec;
            motivoLog = 'Pulser desactivado (activo === false en ubicaciones1)';
          } else if (activo0 === false && salidaSec > 0) {
            // Caso 5: Marcación de salida en ubicaciones
            activo = false;
            estado = 'SALIDA';
            horaReferenciaSec = salidaSec || gpsTimestampSec;
            motivoLog = 'Salida realizada (activo === false en ubicaciones)';
          } else if (activo1 === true || activo0 === true) {
            // Caso 6: Pulser activo general
            activo = true;
            estado = 'LLEGO';
            horaReferenciaSec = llegadaSec || gpsTimestampSec;
            motivoLog = 'Pulser activo (true)';
          } else {
            // Caso 7: En camino
            activo = false;
            estado = 'EN_CAMINO';
            horaReferenciaSec = null;
            motivoLog = 'En espera / en camino';
          }

          const horaGenerada = formatHora(horaReferenciaSec);

          if (estado === 'SALIDA') {
            estadoTexto = horaGenerada ? `En ruta (${horaGenerada})` : 'En ruta (Hacia el siguiente punto)';
          } else if (estado === 'LLEGO') {
            estadoTexto = horaGenerada ? `Ya llegó (${horaGenerada})` : 'Ya llegó el bus';
          } else {
            estadoTexto = 'Esperando confirmación de llegada del bus';
          }

          // LOGGERS DETALLADOS EN CONSOLA DEL SERVIDOR
          console.log('\n================== [API CONSULTAR] ==================');
          console.log(`🕒 Timestamp consulta: ${new Date().toLocaleTimeString('es-PE')}`);
          console.log(`👤 Pasajero DNI: ${dni} | uidpulser: ${uidpulser}`);
          console.log(`📍 ubicaciones1 -> activo: ${activo1} | GPS: ${gpsTimestampSec ? formatHora(gpsTimestampSec) : 'N/A'} | Coords: [${lat}, ${lng}]`);
          console.log(`🛑 ubicaciones  -> activo: ${activo0} | llegada: ${llegadaSec ? formatHora(llegadaSec) : 'N/A'} | salida: ${salidaSec ? formatHora(salidaSec) : 'N/A'}`);
          console.log(`🎯 RESOLUCIÓN   -> ACTIVO: ${activo} | ESTADO: ${estado} | HORA: ${horaGenerada}`);
          console.log(`💡 MOTIVO       -> ${motivoLog}`);
          console.log('=====================================================\n');

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
