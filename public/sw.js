/*
 * Service worker de Cocina Familiar: permite abrir la app sin conexión.
 * - Código y estilos de Next (/_next/static, con hash en el nombre): caché primero.
 * - Páginas y datos de navegación: red primero, caché si no hay conexión.
 * - No toca POST (server actions) ni otros dominios (Firestore, Blob, Google).
 * Los datos de recetas y despensa los guarda Firestore en el iPhone por su cuenta.
 */
const VERSION = 'v1';
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const RUTAS = ['/inicio/', '/recetas/', '/stock/', '/compras/', '/planificacion/', '/macros/'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // Las secciones principales quedan guardadas desde la primera visita
  event.waitUntil(caches.open(PAGES).then((c) => Promise.allSettled(RUTAS.map((r) => c.add(r)))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== STATIC && k !== PAGES).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const esEstatico = (url) =>
  url.pathname.startsWith('/_next/static/') || /\.(png|ico|svg|woff2?|webmanifest)$/.test(url.pathname);

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(STATIC)).put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(PAGES)).put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await caches.match(req, { ignoreVary: true });
    if (hit) return hit;
    // Página que nunca se visitó: se abre el inicio, que funciona con los datos guardados
    if (req.mode === 'navigate') {
      const inicio = await caches.match('/inicio/');
      if (inicio) return inicio;
    }
    throw e;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/__/')) return;
  event.respondWith(esEstatico(url) ? cacheFirst(req) : networkFirst(req));
});
