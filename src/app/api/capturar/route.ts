import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nombre, dni, lat, lng, punto } = body;

    const dniStr = String(dni || '').trim();
    const nombreStr = String(nombre || '').trim();
    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (!dniStr || !nombreStr) {
      return NextResponse.json(
        { ok: false, error: 'Nombre y DNI son requeridos.' },
        { status: 400 }
      );
    }

    if (isNaN(latNum) || isNaN(lngNum)) {
      return NextResponse.json(
        { ok: false, error: 'Coordenadas (lat, lng) inválidas.' },
        { status: 400 }
      );
    }

    const { db, auth } = getFirebaseServer();

    if (!auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch (authErr) {
        console.warn('[Captura] Advertencia en auth anónimo:', authErr);
      }
    }

    const fechaHora = new Date().toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      hour12: true,
    });

    const docData = {
      nombre: nombreStr,
      dni: dniStr,
      lat: latNum,
      lng: lngNum,
      punto: punto || null,
      fechaHora,
      timestamp: serverTimestamp(),
      creadoEn: Date.now(),
    };

    console.log('\n📥 ================= [GUARDANDO EN CAPTURA] =================');
    console.log(`👤 Pasajero: ${nombreStr} (DNI: ${dniStr})`);
    console.log(`📍 Coordenadas: Lat ${latNum.toFixed(6)}, Lng ${lngNum.toFixed(6)}`);
    console.log(`🕒 Fecha/Hora: ${fechaHora}`);
    console.log('===========================================================\n');

    const docRef = await addDoc(collection(db, DB_COLLECTIONS.CAPTURA), docData);

    console.log(`✅ [Captura] Documento registrado exitosamente con ID: ${docRef.id}`);

    return NextResponse.json({
      ok: true,
      id: docRef.id,
      mensaje: 'Registro guardado exitosamente en captura',
    });
  } catch (error: any) {
    console.error('❌ [Captura] Error al registrar en la colección captura:', error?.message || error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Error al guardar en la colección captura',
      },
      { status: 500 }
    );
  }
}
