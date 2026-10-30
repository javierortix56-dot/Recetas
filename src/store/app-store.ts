import { create } from 'zustand';
import { format } from 'date-fns';

// Solo se guarda el perfil activo. Los datos los cachea Firestore en IndexedDB
// (ver firebase/index.ts); antes se serializaba todo el store en localStorage
// en cada snapshot, lo que bloqueaba el hilo principal y superaba la cuota
// con las fotos en base64.
const PROFILE_KEY = 'cocina_familiar_profile';

const getCachedProfile = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    if (saved) return saved;
    // Migración del caché anterior (pesado): rescata el perfil y lo borra
    const legacy = localStorage.getItem('cocina_familiar_cache');
    if (legacy) {
      localStorage.removeItem('cocina_familiar_cache');
      const profile = /"activeProfile":"(\w+)"/.exec(legacy)?.[1] ?? null;
      if (profile) localStorage.setItem(PROFILE_KEY, profile);
      return profile;
    }
    return null;
  } catch {
    return null;
  }
};

const saveProfile = (profile: string) => {
  try { localStorage.setItem(PROFILE_KEY, profile); } catch {}
};

export type UserProfileName = 'javi' | 'mary';

interface AppState {
  // Perfil activo
  activeProfile: UserProfileName;
  isProfileConfirmed: boolean;
  
  // Datos
  recetas: any[];
  ingredientes: any[];
  planificacion: any[];
  listaCompras: any[];
  macrosHoy: any | null;
  macrosSemana: any[];
  historialCompras: any[];
  userProfile: any | null;
  
  // Estados de carga
  recetasCargadas: boolean;
  ingredientesCargadas: boolean;
  planificacionCargada: boolean;
  listaComprasCargada: boolean;
  macrosCargados: boolean;
  profileCargado: boolean;

  // UI
  activeTab: string;

  // Setters
  setActiveProfile: (profile: UserProfileName) => void;
  confirmProfile: () => void;
  setRecetas: (data: any[]) => void;
  setIngredientes: (data: any[]) => void;
  setPlanificacion: (data: any[]) => void;
  setListaCompras: (data: any[]) => void;
  setMacrosHoy: (data: any | null) => void;
  setMacrosSemana: (data: any[]) => void;
  setHistorialCompras: (data: any[]) => void;
  setUserProfile: (data: any | null) => void;
  setActiveTab: (tab: string) => void;
  
  resetStore: () => void;
  optimisticToggleCompra: (id: string) => void;
}

const cachedProfile = getCachedProfile();

const initialState = {
  activeProfile: (cachedProfile === 'mary' ? 'mary' : 'javi') as UserProfileName,
  isProfileConfirmed: true,

  recetas: [] as any[],
  ingredientes: [] as any[],
  planificacion: [] as any[],
  listaCompras: [] as any[],
  macrosHoy: null as any | null,
  macrosSemana: [] as any[],
  historialCompras: [] as any[],
  userProfile: null as any | null,

  recetasCargadas: false,
  ingredientesCargadas: false,
  planificacionCargada: false,
  listaComprasCargada: false,
  macrosCargados: false,
  profileCargado: false,

  activeTab: 'inicio',
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setActiveProfile: (profile) => {
    saveProfile(profile);
    set({
      activeProfile: profile,
      isProfileConfirmed: true,
      macrosCargados: false,
      macrosHoy: null,
      macrosSemana: [],
      planificacion: [],
      planificacionCargada: false,
      userProfile: null,
      profileCargado: false,
    });
  },

  confirmProfile: () => set({ isProfileConfirmed: true }),

  setRecetas: (data) => {
    set({ recetas: data, recetasCargadas: true });
  },
  setIngredientes: (data) => {
    set({ ingredientes: data, ingredientesCargadas: true });
  },
  setPlanificacion: (data) => {
    set({ planificacion: data, planificacionCargada: true });
  },
  setListaCompras: (data) => {
    set({ listaCompras: data, listaComprasCargada: true });
  },
  
  setMacrosSemana: (data) => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const todayMacros = data.find(m => (m.date || m.id) === todayStr || m.id === `${todayStr}_${m.perfil}`) || null;
    
    set({ macrosSemana: data, macrosHoy: todayMacros, macrosCargados: true });
  },

  setMacrosHoy: (data) => {
    set({ macrosHoy: data, macrosCargados: true });
  },

  setHistorialCompras: (data) => {
    set({ historialCompras: data });
  },
  
  setUserProfile: (data) => {
    set({ userProfile: data, profileCargado: true });
  },
  
  setActiveTab: (tab) => set({ activeTab: tab }),

  optimisticToggleCompra: (id) => set((state) => ({
    listaCompras: state.listaCompras.map(item => 
      item.id === id ? { ...item, isPurchased: !item.isPurchased } : item
    )
  })),

  resetStore: () => set(initialState),
}));

