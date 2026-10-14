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

          // MAPEO DE PARADAS EN LA RUTA (Indexadas desde 1, confirmado por el usuario):
          // Parada 1 (idx 0) -> 'llegada1' y 'salida1' (con fallback a 'llegada'/'salida')
          // Parada 2 (idx 1) -> 'llegada2' y 'salida2'
          // Parada 3 (idx 2) -> 'llegada3' y 'salida3'
          // Parada N (idx N-1) -> 'llegadaN' y 'salidaN'
          const idxPuntoPasajero = puntosRuta.findIndex(
            (p) => p.toUpperCase().trim() === puntoPasajeroUpper
          );

          // Construcción del historial ordenado y resolución de parada activa
          let encontradaActiva = false;
          let paradaActivaPunto: string | null = null;
          let paradaActivaEstado: 'EN_PARADA' | 'EN_CAMINO' = 'EN_CAMINO';

          const historialPuntos: Array<{
            punto: string;
            idx: number;
            numeroParada: number;
            horaLlegada: string | null;
            horaSalida: string | null;
            estado: 'TERMINADO' | 'EN_PARADA' | 'EN_CAMINO' | 'PENDIENTE';
            estadoTexto: string;
          }> = [];

          puntosRuta.forEach((pto, i) => {
            const num = i + 1; // 1-based (Parada 1, Parada 2...)
            const kLleg = `llegada${num}`;
            const kSal = `salida${num}`;

            let sLleg = getTimestampSeconds(mergedData[kLleg]);
            let sSal = getTimestampSeconds(mergedData[kSal]);

            // Fallback para Parada 1 si existen claves sin número 'llegada' / 'salida'
            if (num === 1) {
              if (!sLleg) sLleg = getTimestampSeconds(mergedData['llegada']) || getTimestampSeconds(mergedData['llegada0']);
              if (!sSal) sSal = getTimestampSeconds(mergedData['salida']) || getTimestampSeconds(mergedData['salida0']);
            }

            let estadoPto: 'TERMINADO' | 'EN_PARADA' | 'EN_CAMINO' | 'PENDIENTE' = 'PENDIENTE';
            let estadoPtoTexto = 'Pendiente en la ruta';

            if (sSal) {
              // Ya registró salida -> BLOQUEADA / COMPLETADA
              estadoPto = 'TERMINADO';
              estadoPtoTexto = 'Salida completada';
              
            } else if (sLleg) {
              // Ya llegó pero aún no sale -> EN PARADA
              estadoPto = 'EN_PARADA';
              estadoPtoTexto = 'En zona de abordaje';
              if (!encontradaActiva) {
                encontradaActiva = true;
                paradaActivaPunto = pto;
                paradaActivaEstado = 'EN_PARADA';
              }
            } else if (!encontradaActiva) {
              // Es la primera parada que aún no tiene llegada ni salida -> EN CAMINO hacia aquí
              estadoPto = 'EN_CAMINO';
              estadoPtoTexto = i === 0 ? 'En camino al 1er embarque' : 'Próxima parada a llegar';
              encontradaActiva = true;
              paradaActivaPunto = pto;
              paradaActivaEstado = 'EN_CAMINO';
            } else {
              // Parada futura
              estadoPto = 'PENDIENTE';
              estadoPtoTexto = 'Pendiente';
            }

            historialPuntos.push({
              punto: pto,
              idx: i,
              numeroParada: num,
              horaLlegada: formatHora(sLleg),
              horaSalida: formatHora(sSal),
              estado: estadoPto,
              estadoTexto: estadoPtoTexto,
            });
          });

          // Obtener los timestamps específicos de la parada del pasajero
          let puntoLlegadaSec: number | null = null;
          let puntoSalidaSec: number | null = null;
          let puntoPasajeroEstado: 'TERMINADO' | 'EN_PARADA' | 'EN_CAMINO' | 'PENDIENTE' = 'EN_CAMINO';

          if (idxPuntoPasajero >= 0 && idxPuntoPasajero < historialPuntos.length) {
            const h = historialPuntos[idxPuntoPasajero];
            const num = idxPuntoPasajero + 1;
            puntoLlegadaSec = getTimestampSeconds(mergedData[`llegada${num}`]);
            puntoSalidaSec = getTimestampSeconds(mergedData[`salida${num}`]);
            if (num === 1) {
              if (!puntoLlegadaSec) puntoLlegadaSec = getTimestampSeconds(mergedData['llegada']) || getTimestampSeconds(mergedData['llegada0']);
              if (!puntoSalidaSec) puntoSalidaSec = getTimestampSeconds(mergedData['salida']) || getTimestampSeconds(mergedData['salida0']);
            }
            puntoPasajeroEstado = h.estado;
          }

          // RESOLUCIÓN DE ESTADO Y HORAS PARA EL PASAJERO
          let activo = false;
          let estado: 'LLEGO' | 'SALIDA' | 'EN_CAMINO' = 'EN_CAMINO';
          let estadoTexto = 'En camino a la zona de abordaje';
          let horaReferenciaSec: number | null = null;
          let motivoLog = '';

          const horaLlegadaPunto = formatHora(puntoLlegadaSec);
          const horaSalidaPunto = formatHora(puntoSalidaSec);

          if (puntoSalidaSec) {
            // El bus ya completó salida del paradero del pasajero -> Parada bloqueada, bus EN RUTA al siguiente punto
            activo = false;
            estado = 'SALIDA';
            horaReferenciaSec = puntoSalidaSec;
            motivoLog = `Salida completada de ${pasajeroEncontrado.punto} (${horaSalidaPunto}). Próxima parada: ${paradaActivaPunto || 'Destino final'}`;
            estadoTexto = `El bus completó salida de tu punto de abordaje a las ${horaSalidaPunto} y se encuentra en ruta${paradaActivaPunto ? ` hacia ${paradaActivaPunto}` : ''}.`;
          } else if (puntoLlegadaSec && !puntoSalidaSec) {
            // El bus ya llegó al paradero del pasajero y aún no sale -> YA LLEGÓ
            activo = true;
            estado = 'LLEGO';
            horaReferenciaSec = puntoLlegadaSec;
            motivoLog = `Bus en zona de abordaje de ${pasajeroEncontrado.punto} (${horaLlegadaPunto})`;
            estadoTexto = `¡El bus ya llegó a tu zona de abordaje a las ${horaLlegadaPunto}!`;
          } else {
            // El bus aún no llega al paradero del pasajero
            activo = Boolean(activo1);
            estado = 'EN_CAMINO';
            horaReferenciaSec = gpsTimestampSec;

            if (idxPuntoPasajero === 0) {
              motivoLog = `Esperando llegada a la 1ª parada (${pasajeroEncontrado.punto})`;
              estadoTexto = `El bus aún no llega al primer punto de embarque (${pasajeroEncontrado.punto}).`;
            } else if (paradaActivaPunto === pasajeroEncontrado.punto) {
              motivoLog = `Bus en camino directo hacia ${pasajeroEncontrado.punto}`;
              estadoTexto = `El bus se encuentra en camino hacia tu punto de abordaje (${pasajeroEncontrado.punto}).`;
            } else {
              motivoLog = `Bus completando paradas previas. Próxima: ${paradaActivaPunto || 'en ruta'}`;
              estadoTexto = `El bus está completando el itinerario previo en camino a ${pasajeroEncontrado.punto}.`;
            }
          }

          const horaGenerada = horaSalidaPunto || horaLlegadaPunto || formatHora(horaReferenciaSec);

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
