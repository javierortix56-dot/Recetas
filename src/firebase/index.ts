'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  Firestore,
  getFirestore,
  initializeFirestore,
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
function getFirestoreWithCache(app: FirebaseApp): Firestore {
  if (firestoreInstance) return firestoreInstance;
  try {
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Ya inicializado (p. ej. HMR en desarrollo) o IndexedDB no disponible
    firestoreInstance = getFirestore(app);
  }
  return firestoreInstance;
}

export function initializeFirebase() {
  const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getSdks(firebaseApp);
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    firestore: getFirestoreWithCache(firebaseApp),
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
