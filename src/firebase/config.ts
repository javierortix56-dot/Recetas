// Solo la configuración: la app y Firestore se inicializan en firebase/index.ts
// (inicializar Firestore acá impedía activar la caché persistente).
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  // Con el login activo, Firebase Auth usa el dominio de la app (src/middleware.ts hace de proxy):
  // en iPhone el login por redirección no vuelve bien a un dominio distinto
  authDomain: process.env.NEXT_PUBLIC_REQUIRE_LOGIN === '1' && typeof window !== 'undefined'
    ? window.location.host
    : process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};
