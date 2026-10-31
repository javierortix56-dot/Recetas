'use client';

import * as React from 'react';
import { getAuth, GoogleAuthProvider, onIdTokenChanged, signInWithRedirect, signOut, type User } from 'firebase/auth';
import { useFirebaseApp, useFirestore } from '@/firebase';
import { initFirestoreListeners } from '@/firebase/init-listeners';
import { useAppStore } from '@/store/app-store';
import { Button } from '@/components/ui/button';
import { LOGIN_REQUIRED, TOKEN_COOKIE, parseEmails } from '@/lib/access';

const ALLOWED = parseEmails(process.env.NEXT_PUBLIC_ALLOWED_EMAILS);

type AuthState = { status: 'loading' } | { status: 'signed-out' } | { status: 'denied'; email: string } | { status: 'ok' };

/** Token para las server actions: Firebase lo renueva solo cada hora y avisa con onIdTokenChanged */
function saveToken(token: string | null) {
  document.cookie = token
    ? `${TOKEN_COOKIE}=${token}; Path=/; Max-Age=3600; Secure; SameSite=Strict`
    : `${TOKEN_COOKIE}=; Path=/; Max-Age=0; Secure; SameSite=Strict`;
}

function useFamilyAuth(): AuthState & { user?: User } {
  const app = useFirebaseApp();
  const [state, setState] = React.useState<AuthState & { user?: User }>(LOGIN_REQUIRED ? { status: 'loading' } : { status: 'ok' });

  React.useEffect(() => {
    if (!LOGIN_REQUIRED) return;
    return onIdTokenChanged(getAuth(app), async (user) => {
      if (!user) { saveToken(null); setState({ status: 'signed-out' }); return; }
      const email = (user.email || '').toLowerCase();
      if (ALLOWED.length > 0 && !ALLOWED.includes(email)) { saveToken(null); setState({ status: 'denied', email }); return; }
      // Sin conexión el token vencido no se puede renovar: la app igual abre con los datos guardados
      try { saveToken(await user.getIdToken()); } catch (e) { console.warn('[Auth] sin token nuevo', e); }
      setState({ status: 'ok', user });
    });
  }, [app]);

  return state;
}

function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        {label && <p className="font-bold uppercase text-[10px] tracking-widest text-primary">{label}</p>}
      </div>
    </div>
  );
}

function LoginScreen({ denied }: { denied?: string }) {
  const app = useFirebaseApp();
  const [busy, setBusy] = React.useState(false);
  const login = async () => {
    setBusy(true);
    try {
      if (denied) await signOut(getAuth(app));
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      // Redirección (no ventana emergente): es lo que funciona en la app instalada del iPhone
      await signInWithRedirect(getAuth(app), provider);
    } catch (e) {
      console.error(e);
      setBusy(false);
    }
  };
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-6">
      <div className="glass w-full max-w-sm rounded-[28px] p-7 text-center space-y-5">
        <div className="text-5xl">🍔</div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold">Cocina Familiar</h1>
          <p className="text-sm text-muted-foreground">
            {denied
              ? `La cuenta ${denied} no tiene acceso. Entrá con la cuenta de la familia.`
              : 'Entrá con tu cuenta de Google para ver las recetas y la despensa.'}
          </p>
        </div>
        <Button className="w-full h-12" onClick={login} disabled={busy}>
          {busy ? 'Abriendo Google…' : denied ? 'Usar otra cuenta' : 'Continuar con Google'}
        </Button>
      </div>
    </div>
  );
}

/**
 * Punto de entrada: pide iniciar sesión (si está activado) y conecta Firestore
 * con el store global. Los listeners arrancan solo con un usuario autorizado,
 * porque las reglas de Firestore rechazan al resto.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const db = useFirestore();
  const activeProfile = useAppStore(s => s.activeProfile);
  const [mounted, setMounted] = React.useState(false);
  const auth = useFamilyAuth();

  // Evitar errores de hidratación asegurando el primer renderizado del cliente
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const ready = mounted && auth.status === 'ok';
  React.useEffect(() => {
    if (!db || !ready) return;
    const cleanup = initFirestoreListeners(db, activeProfile);
    return () => {
      if (cleanup) cleanup();
    };
  }, [db, ready, activeProfile]);

  if (!mounted || auth.status === 'loading') return <Spinner label="Cargando Cocina Familiar..." />;
  if (auth.status === 'signed-out') return <LoginScreen />;
  if (auth.status === 'denied') return <LoginScreen denied={auth.email} />;
  return <>{children}</>;
}
