'use client';

import { collection, onSnapshot, doc, query, Firestore, orderBy, limit } from 'firebase/firestore';
import { useAppStore } from '@/store/app-store';
import { USER_ID } from '@/lib/constants';

let initialized = false;

/**
 * @fileOverview Inicialización temprana de listeners de Firestore.
 */
export function initFirestoreListeners(db: Firestore) {
  if (initialized || !db) return;
  initialized = true;

  const store = useAppStore.getState();

  const unsubs = [
    // Recetas
    onSnapshot(collection(db, "users", USER_ID, "recipes"), (snap) => {
      store.setRecetas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }),
    
    // Stock / Despensa
    onSnapshot(collection(db, "users", USER_ID, "ingredients"), (snap) => {
      store.setIngredientes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }),
    
    // Planificación Semanal
    onSnapshot(collection(db, "users", USER_ID, "meal_plans"), (snap) => {
      store.setPlanificacion(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }),
    
    // Lista de Compras
    onSnapshot(collection(db, "users", USER_ID, "shopping_list_items"), (snap) => {
      store.setListaCompras(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }),
    
    // Perfil y Metas
    onSnapshot(doc(db, "users", USER_ID), (snap) => {
      store.setUserProfile(snap.exists() ? snap.data() : null);
    }),

    // Resúmenes de Macros
    onSnapshot(collection(db, "users", USER_ID, "daily_macro_summaries"), (snap) => {
      store.setMacrosSemana(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }),

    // Historial de Compras
    onSnapshot(query(collection(db, "users", USER_ID, "historial_compras"), orderBy("creadoEn", "desc"), limit(10)), (snap) => {
      store.setHistorialCompras(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    })
  ];

  return () => {
    unsubs.forEach(u => u());
    initialized = false;
  };
}
