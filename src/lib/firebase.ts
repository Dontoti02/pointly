import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyDgrL9WfIakcs_Q1-ljM9ohhQtePg3b8PM",
  projectId: "asistencia-bus",
};

// Constantes centralizadas para las colecciones de la base de datos Firestore
export const DB_COLLECTIONS = {
  MANIFIESTO: 'manifiesto1',
  UBICACIONES: 'ubicaciones1',
} as const;

export const COLECCION_MANIFIESTO = DB_COLLECTIONS.MANIFIESTO;
export const COLECCION_UBICACIONES = DB_COLLECTIONS.UBICACIONES;

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

export { app, auth, db };