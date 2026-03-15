'use client';

import { collection, onSnapshot, doc, query, Firestore, orderBy, limit, where } from 'firebase/firestore';
import { useAppStore, UserProfileName } from '@/store/app-store';
import { USER_ID } from '@/lib/constants';

let initialized = false;
let currentProfile: UserProfileName | null = null;
let unsubs: (() => void)[] = [];

/**
 * @fileOverview Inicialización temprana de listeners de Firestore.
 * Sincroniza datos compartidos y datos específicos de perfil.
 */
export function initFirestoreListeners(db: Firestore, activeProfile: UserProfileName) {
  // Si ya estamos escuchando al perfil correcto, no hacemos nada
  if (initialized && currentProfile === activeProfile) return;

  // Si el perfil cambió, limpiamos los listeners anteriores
  if (unsubs.length > 0) {
    unsubs.forEach(u => u());
    unsubs = [];
  }

  initialized = true;
  currentProfile = activeProfile;

  const store = useAppStore.getState();

  // Listeners de datos COMPARTIDOS (Globales)
  unsubs.push(
    onSnapshot(collection(db, "users", USER_ID, "recipes"), (snap) => {
      store.setRecetas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }),
    
    onSnapshot(collection(db, "users", USER_ID, "ingredients"), (snap) => {
      store.setIngredientes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }),
    
    onSnapshot(collection(db, "users", USER_ID, "meal_plans"), (snap) => {
      store.setPlanificacion(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }),
    
    onSnapshot(collection(db, "users", USER_ID, "shopping_list_items"), (snap) => {
      store.setListaCompras(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }),

    onSnapshot(query(collection(db, "users", USER_ID, "historial_compras"), orderBy("creadoEn", "desc"), limit(10)), (snap) => {
      store.setHistorialCompras(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    })
  );

  // Listeners de datos INDIVIDUALES (Por Perfil)
  // Perfil y Metas (Buscamos el documento del perfil dentro de la colección perfiles)
  unsubs.push(
    onSnapshot(doc(db, "users", USER_ID, "profiles", activeProfile), (snap) => {
      store.setUserProfile(snap.exists() ? snap.data() : { 
        displayName: activeProfile.charAt(0).toUpperCase() + activeProfile.slice(1),
        objetivosMacros: { calorias: 2000, proteinas: 150, carbohidratos: 250, grasas: 65 }
      });
    })
  );

  // Logs diarios de comida filtrados por perfil
  unsubs.push(
    onSnapshot(
      query(
        collection(db, "users", USER_ID, "daily_macro_summaries"), 
        where("perfil", "==", activeProfile)
      ), 
      (snap) => {
        store.setMacrosSemana(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    )
  );

  return () => {
    unsubs.forEach(u => u());
    unsubs = [];
    initialized = false;
    currentProfile = null;
  };
}