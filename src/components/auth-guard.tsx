'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { initFirestoreListeners } from '@/firebase/init-listeners';

/**
 * @fileOverview Protector de rutas y punto de entrada para la sincronización de datos.
 * Utiliza initFirestoreListeners para conectar Firebase con el store global.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const db = useFirestore();
  const [mounted, setMounted] = React.useState(false);

  // Evitar errores de hidratación asegurando el primer renderizado del cliente
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Iniciar listeners de Firestore en cuanto el DB esté listo y el componente montado
  React.useEffect(() => {
    if (!db || !mounted) return;
    
    const cleanup = initFirestoreListeners(db);
    return () => {
      if (cleanup) cleanup();
    };
  }, [db, mounted]);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="font-black uppercase text-[10px] tracking-widest text-primary">Cargando Cocina Familiar...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
