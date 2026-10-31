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
  // Sin callback de error, un fallo dejaba la app cargando para siempre
  const onError = (what: string) => (err: Error) => {
    console.error(`[Firestore] ${what}:`, err);
    useAppStore.getState().setSyncError(err.message || String(err));
  };

  // Listeners de datos COMPARTIDOS (Globales para la familia)
  unsubs.push(
    onSnapshot(collection(db, "users", USER_ID, "recipes"), (snap) => {
      store.setRecetas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, onError('recetas')),
    
    onSnapshot(collection(db, "users", USER_ID, "ingredients"), (snap) => {
      store.setIngredientes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, onError('ingredientes')),
    
    onSnapshot(collection(db, "users", USER_ID, "shopping_list_items"), (snap) => {
      store.setListaCompras(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, onError('compras')),

    onSnapshot(query(collection(db, "users", USER_ID, "historial_compras"), orderBy("creadoEn", "desc"), limit(10)), (snap) => {
      store.setHistorialCompras(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, onError('historial'))
  );

  // Listeners de datos INDIVIDUALES (Por Perfil)
  
  // Perfil y Metas
  unsubs.push(
    onSnapshot(doc(db, "users", USER_ID, "profiles", activeProfile), (snap) => {
      store.setUserProfile(snap.exists() ? snap.data() : { 
        displayName: activeProfile.charAt(0).toUpperCase() + activeProfile.slice(1),
        objetivosMacros: { calorias: 2000, proteinas: 150, carbohidratos: 250, grasas: 65 }
      });
    }, onError('perfil'))
  );

  // Planificación individual (Si Javi desplanifica, Mary no se ve afectada)
  unsubs.push(
    onSnapshot(
      query(
        collection(db, "users", USER_ID, "meal_plans"), 
        where("perfil", "==", activeProfile)
      ), 
      (snap) => {
        store.setPlanificacion(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      onError('plan')
    )
  );

  // Resúmenes de macros por perfil
  unsubs.push(
    onSnapshot(
      query(
        collection(db, "users", USER_ID, "daily_macro_summaries"), 
        where("perfil", "==", activeProfile)
      ), 
      (snap) => {
        store.setMacrosSemana(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      onError('macros')
    )
  );

  return () => {
    unsubs.forEach(u => u());
    unsubs = [];
    initialized = false;
    currentProfile = null;
  };
}