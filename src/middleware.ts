import { NextResponse, type NextRequest } from 'next/server';

/**
 * 1. Proxy de las páginas de inicio de sesión de Firebase (/__/auth/*) en el mismo dominio
 *    de la app: en iPhone (Safari y app instalada) el login con Google por redirección solo
 *    funciona si vuelve al mismo dominio.
 * 2. Barra final en las rutas (antes la ponía trailingSlash, pero Firebase responde 404 a
 *    "/__/auth/handler/", así que esas rutas se excluyen).
 */
const FIREBASE_HOST = `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`;

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith('/__/auth/') || pathname.startsWith('/__/firebase/')) {
    return NextResponse.rewrite(new URL(pathname + search, FIREBASE_HOST));
  }
  if (!pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(pathname)) {
    // URL cruda: req.nextUrl normaliza la barra final y la redirección quedaba en bucle
    const url = new URL(req.url);
    url.pathname = `${url.pathname}/`;
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  // Ni los archivos de Next ni las server actions pasan por acá
  matcher: ['/((?!_next/|api/).*)'],
};
