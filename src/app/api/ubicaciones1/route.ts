import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  collection,
  getDocs,
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { firebaseConfig, DB_COLLECTIONS } from '@/lib/firebase';

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

function parseTimestamp(ts: any): { text: string | null; seconds: number | null } {
  if (!ts) return { text: null, seconds: null };
  let sec: number | null = null;
  if (typeof ts?.seconds === 'number') {
    sec = ts.seconds;
  } else if (typeof ts === 'number') {
    sec = ts > 1e11 ? Math.floor(ts / 1000) : ts;
  } else if (typeof ts?.toDate === 'function') {
    sec = Math.floor(ts.toDate().getTime() / 1000);
  } else if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    if (!isNaN(parsed)) sec = Math.floor(parsed / 1000);
  }

  if (sec == null) return { text: null, seconds: null };

  const date = new Date(sec * 1000);
  const text = date.toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return { text, seconds: sec };
}

export async function GET() {
  try {
    const { db, auth } = getFirebaseServer();

    if (!auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch (authErr) {
        console.warn('Anonymous auth warning in /api/ubicaciones1:', authErr);
      }
    }

    // Consultar puntos de abordaje y coordenadas registrados en manifiesto1
    const manifestPointsByUid: Record<string, string[]> = {};
    const manifestCoordsByUid: Record<string, { lat: number; lng: number }> = {};

    try {
      const snapManifiesto = await getDocs(collection(db, DB_COLLECTIONS.MANIFIESTO));
      snapManifiesto.forEach((mDoc) => {
        const mData = mDoc.data();
        if (!mData.uidpulser) return;
        const uid = String(mData.uidpulser).trim();
        if (Array.isArray(mData.registros)) {
          if (!manifestPointsByUid[uid]) manifestPointsByUid[uid] = [];
          for (const r of mData.registros) {
            if (r.punto && !manifestPointsByUid[uid].includes(String(r.punto).toUpperCase().trim())) {
              manifestPointsByUid[uid].push(String(r.punto).toUpperCase().trim());
            }
            if (!manifestCoordsByUid[uid] && !isNaN(Number(r.lat)) && !isNaN(Number(r.lng))) {
              manifestCoordsByUid[uid] = { lat: Number(r.lat), lng: Number(r.lng) };
            }
          }
        }
      });
    } catch (eMan) {
      console.warn('Aviso al consultar manifiesto complementario:', eMan);
    }

    const snap = await getDocs(collection(db, DB_COLLECTIONS.UBICACIONES));
    const pulsers: any[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const uid = String(data.uid || docSnap.id).trim();

      const activo =
        data.activo === true ||
        data.activo === 'true' ||
        data.activo === 1 ||
        data.activo === '1';

      const manifiestoPuntos = manifestPointsByUid[uid] || [];
      const manifiestoCoords = manifestCoordsByUid[uid] || null;

      // Escanear dinámicamente todos los puntos incrementales: punto1, punto2, punto3, ...
      const puntos: any[] = [];
      Object.keys(data).forEach((key) => {
        const match = key.match(/^punto(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          const pData = data[key];
          let lat = Number(pData?.lat);
          let lng = Number(pData?.lng);

          if (num === 1 && (isNaN(lat) || isNaN(lng)) && manifiestoCoords) {
            lat = manifiestoCoords.lat;
            lng = manifiestoCoords.lng;
          }

          if (!isNaN(lat) && !isNaN(lng)) {
            const llegada = parseTimestamp(pData?.llegada);
            const salida = parseTimestamp(pData?.salida);
            puntos.push({
              numero: num,
              key: `punto${num}`,
              lat,
              lng,
              llegada: llegada.text,
              llegadaSec: llegada.seconds,
              salida: salida.text,
              salidaSec: salida.seconds,
              lugarManifiesto: manifiestoPuntos[num - 1] || null,
            });
          }
        }
      });

      puntos.sort((a, b) => a.numero - b.numero);

      const punto1 = puntos.find((p) => p.numero === 1) || null;
      const punto2 = puntos.find((p) => p.numero === 2) || null;

      pulsers.push({
        uid,
        id: docSnap.id,
        activo,
        punto1,
        punto2,
        puntos,
        manifiestoPuntos,
      });
    });

    return NextResponse.json({
      ok: true,
      coleccion: DB_COLLECTIONS.UBICACIONES,
      pulsers,
    });
  } catch (error: any) {
    console.error('Error al consultar ubicaciones1:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Error al obtener ubicaciones1' },
      { status: 500 }
    );
  }
}
