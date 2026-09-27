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

    // 2. Lee la ubicación activa del pulser en la colección ubicaciones1
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
        let pData: any = null;

        // Opción A: Documento con ID igual a uidpulser
        const pulserDoc = await getDoc(doc(db, DB_COLLECTIONS.UBICACIONES, uidpulser));
        if (pulserDoc.exists()) {
          pData = pulserDoc.data();
        } else {
          // Opción B: Documento con campo uidpulser == uidpulser
          const qSnap = await getDocs(
            query(collection(db, DB_COLLECTIONS.UBICACIONES), where('uidpulser', '==', uidpulser))
          );
          if (!qSnap.empty) {
            pData = qSnap.docs[0].data();
          }
        }

        if (pData) {
          const lat = Number(pData.lat ?? pData.latitude);
          const lng = Number(pData.lng ?? pData.lon ?? pData.longitude);
          const activo = pData.activo !== undefined ? Boolean(pData.activo) : true;

          let rawSeconds: number | null = null;
          if (pData.timestamp?.seconds) {
            rawSeconds = pData.timestamp.seconds;
          } else if (pData.actualizado?.seconds) {
            rawSeconds = pData.actualizado.seconds;
          } else if (typeof pData.timestamp === 'number') {
            rawSeconds = pData.timestamp;
          }

          let horaGenerada: string | null = null;
          if (rawSeconds) {
            const dateObj = new Date(rawSeconds * 1000);
            horaGenerada = dateObj.toLocaleTimeString('es-PE', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            });
          }

          // Lógica de estados solicitada:
          // 1. Si tiene hora generada exacta y activo === true -> YA LLEGÓ
          // 2. Si el pulser desactivó (activo === false) -> SALIDA (esperará el otro punto de abordaje)
          // 3. Mientras tanto no tenga la hora exacta o no esté activo -> EN CAMINO
          let estado: 'LLEGO' | 'SALIDA' | 'EN_CAMINO' = 'EN_CAMINO';
          let estadoTexto = 'En camino a la zona de abordaje';

          if (horaGenerada && activo) {
            estado = 'LLEGO';
            estadoTexto = `Ya llegó (${horaGenerada})`;
          } else if (activo === false) {
            estado = 'SALIDA';
            estadoTexto = 'Salida realizada (Esperando siguiente punto)';
          } else {
            estado = 'EN_CAMINO';
            estadoTexto = 'Esperando llegada del bus';
          }

          if (!isNaN(lat) && !isNaN(lng)) {
            coordenadasPulser = {
              lat,
              lng,
              activo,
              timestamp: rawSeconds,
              horaGenerada,
              velocidad: pData.velocidad || null,
              estado,
              estadoTexto,
            };
          }
        }
      } catch (err) {
        console.warn('Advertencia al consultar ubicaciones1:', err);
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
