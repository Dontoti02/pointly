import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyDgrL9WfIakcs_Q1-ljM9ohhQtePg3b8PM",
  projectId: "asistencia-bus",
};

export const DB_COLLECTIONS = {
  MANIFIESTO: 'manifiesto',
  UBICACIONES: 'ubicaciones',
  UBICACIONES_ESTADO: 'ubicaciones',
  CAPTURA: 'captura',
} as const;

export const COLECCION_MANIFIESTO = DB_COLLECTIONS.MANIFIESTO;
export const COLECCION_UBICACIONES = DB_COLLECTIONS.UBICACIONES;
export const COLECCION_UBICACIONES_ESTADO = DB_COLLECTIONS.UBICACIONES_ESTADO;
export const COLECCION_CAPTURA = DB_COLLECTIONS.CAPTURA;

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (typeof window !== 'undefined') {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  db = getFirestore(app);
}

export async function ensureClientAuth() {
  if (typeof window === 'undefined') return null;
  try {
    if (!app) {
      app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    }
    if (!auth) {
      auth = getAuth(app);
    }
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
    return auth.currentUser;
  } catch (err) {
    console.warn('Aviso en autenticación anónima cliente:', err);
    return null;
  }
}

export { app, auth, db };