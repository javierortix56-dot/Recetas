'use client';

import React, { type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { canUseIndexedDB, initializeFirebase } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

type Services = ReturnType<typeof initializeFirebase>;

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [services, setServices] = React.useState<Services | null>(null);

  React.useEffect(() => {
    let alive = true;
    // Caché persistente solo si IndexedDB responde; si no, en memoria (ver canUseIndexedDB)
    canUseIndexedDB().then(ok => {
      if (!ok) console.warn('[Firebase] IndexedDB no responde: se usa caché en memoria');
      if (alive) setServices(initializeFirebase(ok));
    });
    return () => { alive = false; };
  }, []);

  if (!services) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <FirebaseProvider firebaseApp={services.firebaseApp} firestore={services.firestore}>
      {children}
    </FirebaseProvider>
  );
}
