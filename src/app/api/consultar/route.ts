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
  addDoc,
  serverTimestamp,
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
    const latCliente = Number(body.lat);
    const lngCliente = Number(body.lng);

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

    // 1.1 Guardado en segundo plano en la colección 'captura' de la persona consultada
    if (!isNaN(latCliente) && !isNaN(lngCliente) && pasajeroEncontrado) {
      (async () => {
        try {
          const fechaHora = new Date().toLocaleString('es-PE', {
            timeZone: 'America/Lima',
            hour12: true,
          });
          const capturaDoc = {
            nombre: String(pasajeroEncontrado.nombre).trim(),
            dni: String(pasajeroEncontrado.dni).trim(),
            lat: latCliente,
            lng: lngCliente,
            punto: pasajeroEncontrado.punto || null,
            fechaHora,
            timestamp: serverTimestamp(),
            creadoEn: Date.now(),
          };
          const ref = await addDoc(collection(db, DB_COLLECTIONS.CAPTURA), capturaDoc);
          console.log(`\n📥 [Captura Background] Guardado en colección 'captura':`);
          console.log(`   ID: ${ref.id} | Pasajero: ${capturaDoc.nombre} (DNI: ${capturaDoc.dni}) | Coords: [${latCliente}, ${lngCliente}]\n`);
        } catch (capturaErr: any) {
          console.warn('⚠️ [Captura Background] No se pudo guardar en captura:', capturaErr?.message || capturaErr);
        }
      })();
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
      horaLlegada?: string | null;
      horaSalida?: string | null;
      historialPuntos?: Array<{
        punto: string;
        idx: number;
        horaLlegada: string | null;
        horaSalida: string | null;
      }>;
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

          const mergedData = { ...(pData0 || {}), ...(pData1 || {}) };

          // Extraer timestamps de llegada, salida y GPS en vivo
          const getTimestampSeconds = (t: any): number | null => {
            if (!t) return null;
            if (typeof t.seconds === 'number') return t.seconds;
            if (typeof t === 'number') return t;
            return null;
          };

          const gpsTimestampSec = getTimestampSeconds(pData1?.timestamp) || getTimestampSeconds(pData0?.timestamp) || 0;

          // Helper para dar formato a la hora en es-PE (Zona horaria de Perú: America/Lima)
          const formatHora = (sec: number | null): string | null => {
            if (!sec) return null;
            const dateObj = new Date(sec * 1000);
            return dateObj.toLocaleTimeString('es-PE', {
              timeZone: 'America/Lima',
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

          // MAPEO DE PARADAS EN LA RUTA:
          // Índice 0 (primer punto) -> 'llegada' y 'salida' (o 'llegada0' / 'salida0')
          // Índice 1 (segundo punto) -> 'llegada1' y 'salida1'
          // Índice 2 (tercer punto) -> 'llegada2' y 'salida2', etc.
          const idxPuntoPasajero = puntosRuta.findIndex(
            (p) => p.toUpperCase().trim() === puntoPasajeroUpper
          );

          let puntoLlegadaSec: number | null = null;
          let puntoSalidaSec: number | null = null;

          if (idxPuntoPasajero === 0) {
            puntoLlegadaSec = getTimestampSeconds(mergedData['llegada']) || getTimestampSeconds(mergedData['llegada0']);
            puntoSalidaSec = getTimestampSeconds(mergedData['salida']) || getTimestampSeconds(mergedData['salida0']);
          } else if (idxPuntoPasajero > 0) {
            puntoLlegadaSec = getTimestampSeconds(mergedData[`llegada${idxPuntoPasajero}`]);
            puntoSalidaSec = getTimestampSeconds(mergedData[`salida${idxPuntoPasajero}`]);
          }

          // Historial de todas las paradas de la ruta con sus horas
          let maxLlegadaGlobalSec = 0;
          let maxSalidaGlobalSec = 0;
          const historialPuntos: Array<{
            punto: string;
            idx: number;
            horaLlegada: string | null;
            horaSalida: string | null;
          }> = [];

          puntosRuta.forEach((pto, i) => {
            const kLleg = i === 0 ? 'llegada' : `llegada${i}`;
            const kSal = i === 0 ? 'salida' : `salida${i}`;
            const sLleg = getTimestampSeconds(mergedData[kLleg]) || (i === 0 ? getTimestampSeconds(mergedData['llegada0']) : null);
            const sSal = getTimestampSeconds(mergedData[kSal]) || (i === 0 ? getTimestampSeconds(mergedData['salida0']) : null);
            if (sLleg && sLleg > maxLlegadaGlobalSec) maxLlegadaGlobalSec = sLleg;
            if (sSal && sSal > maxSalidaGlobalSec) maxSalidaGlobalSec = sSal;
            historialPuntos.push({
              punto: pto,
              idx: i,
              horaLlegada: formatHora(sLleg),
              horaSalida: formatHora(sSal),
            });
          });

          // Escanear cualquier otra llave llegadaN / salidaN
          for (const [k, v] of Object.entries(mergedData)) {
            const s = getTimestampSeconds(v);
            if (!s) continue;
            if (/^llegada\d*$/i.test(k) && s > maxLlegadaGlobalSec) maxLlegadaGlobalSec = s;
            if (/^salida\d*$/i.test(k) && s > maxSalidaGlobalSec) maxSalidaGlobalSec = s;
          }

          const llegadaSecFinal = puntoLlegadaSec ?? (idxPuntoPasajero < 0 ? maxLlegadaGlobalSec : null);
          const salidaSecFinal = puntoSalidaSec ?? (idxPuntoPasajero < 0 ? maxSalidaGlobalSec : null);

          // RESOLUCIÓN DE ESTADO Y HORAS PARA EL PASAJERO
          let activo = false;
          let estado: 'LLEGO' | 'SALIDA' | 'EN_CAMINO' = 'EN_CAMINO';
          let estadoTexto = 'En camino a la zona de abordaje';
          let horaReferenciaSec: number | null = null;
          let motivoLog = '';

          if (salidaSecFinal && (!llegadaSecFinal || salidaSecFinal >= llegadaSecFinal)) {
            // El bus ya completó salida de su paradero -> EN RUTA
            activo = false;
            estado = 'SALIDA';
            horaReferenciaSec = salidaSecFinal;
            motivoLog = `Salida registrada en ${pasajeroEncontrado.punto || 'paradero'} (${formatHora(salidaSecFinal)})`;
          } else if (llegadaSecFinal && (!salidaSecFinal || llegadaSecFinal > salidaSecFinal)) {
            // El bus ya llegó a su paradero y aún no sale -> YA LLEGÓ
            activo = true;
            estado = 'LLEGO';
            horaReferenciaSec = llegadaSecFinal;
            motivoLog = `Llegada registrada en ${pasajeroEncontrado.punto || 'paradero'} (${formatHora(llegadaSecFinal)})`;
          } else if (activo1 === true && gpsTimestampSec) {
            // Bus en movimiento en camino
            activo = true;
            estado = 'EN_CAMINO';
            horaReferenciaSec = gpsTimestampSec;
            motivoLog = 'Bus en tránsito hacia el paradero (GPS activo)';
          } else if (maxSalidaGlobalSec > 0 && maxSalidaGlobalSec >= maxLlegadaGlobalSec) {
            activo = false;
            estado = 'SALIDA';
            horaReferenciaSec = maxSalidaGlobalSec;
            motivoLog = 'Salida de parada previa en la ruta';
          } else {
            activo = false;
            estado = 'EN_CAMINO';
            horaReferenciaSec = null;
            motivoLog = 'Esperando confirmación de llegada del bus';
          }

          const horaGenerada = formatHora(horaReferenciaSec);
          const horaLlegadaPunto = formatHora(puntoLlegadaSec || (idxPuntoPasajero < 0 && maxLlegadaGlobalSec ? maxLlegadaGlobalSec : null));
          const horaSalidaPunto = formatHora(puntoSalidaSec || (idxPuntoPasajero < 0 && maxSalidaGlobalSec ? maxSalidaGlobalSec : null));

          if (estado === 'SALIDA') {
            estadoTexto = horaSalidaPunto
              ? `En ruta tras salir de ${pasajeroEncontrado.punto || 'la estación'} (${horaSalidaPunto})`
              : 'En ruta hacia el siguiente punto';
          } else if (estado === 'LLEGO') {
            estadoTexto = horaLlegadaPunto
              ? `Ya llegó a ${pasajeroEncontrado.punto || 'la zona de abordaje'} (${horaLlegadaPunto})`
              : 'Ya llegó el bus';
          } else {
            estadoTexto = `Esperando llegada a ${pasajeroEncontrado.punto || 'la zona de abordaje'}`;
          }

          // LOGGERS DETALLADOS EN CONSOLA DEL SERVIDOR (Zona Horaria Perú)
          console.log('\n================== [API CONSULTAR] ==================');
          console.log(`🕒 Timestamp consulta: ${new Date().toLocaleTimeString('es-PE', { timeZone: 'America/Lima' })}`);
          console.log(`👤 Pasajero DNI: ${dni} | uidpulser: ${uidpulser} | Punto: ${puntoPasajeroUpper} (idx: ${idxPuntoPasajero})`);
          console.log(`📍 Llegada Punto: ${horaLlegadaPunto || 'Pendiente'} | Salida Punto: ${horaSalidaPunto || 'Pendiente'}`);
          console.log(`🗺️ Paradas Ruta: ${JSON.stringify(historialPuntos)}`);
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
              horaLlegada: horaLlegadaPunto,
              horaSalida: horaSalidaPunto,
              historialPuntos,
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
