'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  Firestore,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

let firestoreInstance: Firestore | null = null;

/**
 * Firestore con caché persistente en IndexedDB: al abrir la app los listeners
 * responden al instante desde el disco (y funcionan sin conexión), y luego
 * se sincronizan con el servidor. Reemplaza el caché manual en localStorage,
 * que serializaba todas las recetas (con fotos base64) en cada cambio.
 */
function getFirestoreWithCache(app: FirebaseApp, persistent: boolean): Firestore {
  if (firestoreInstance) return firestoreInstance;
  try {
    firestoreInstance = initializeFirestore(app, {
      localCache: persistent
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : memoryLocalCache(),
    });
  } catch {
    // Ya inicializado (p. ej. HMR en desarrollo) o IndexedDB no disponible
    firestoreInstance = getFirestore(app);
  }
  return firestoreInstance;
}

/**
 * Comprueba que IndexedDB responda antes de usarlo como caché. En iOS, después
 * de borrar los datos del sitio (o en algunas apps instaladas en la pantalla de
 * inicio) la apertura puede quedar colgada sin error: Firestore se queda
 * esperando y la app no carga nunca. Si no responde a tiempo, se usa caché en memoria.
 */
export function canUseIndexedDB(timeoutMs = 1500): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(false);
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    const done = (ok: boolean) => { clearTimeout(timer); resolve(ok); };
    try {
      const req = indexedDB.open('cocina-idb-probe');
      req.onsuccess = () => { try { req.result.close(); } catch {} done(true); };
      req.onerror = () => done(false);
      req.onblocked = () => done(false);
    } catch {
      done(false);
    }
  });
}

export function initializeFirebase(persistent = true) {
  const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getSdks(firebaseApp, persistent);
}

export function getSdks(firebaseApp: FirebaseApp, persistent = true) {
  return {
    firebaseApp,
    firestore: getFirestoreWithCache(firebaseApp, persistent),
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
