import type { MetadataRoute } from 'next'
import { APPLE_TOUCH_ICON_DATA_URI } from '@/lib/icon-data'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cocina Familiar',
    short_name: 'CocinaFam',
    description: 'Gestión de recetas familiares y nutrición',
    // id y scope explícitos. Sin scope, iOS tomaba el directorio de start_url (/inicio/)
    // como único alcance de la app y al ir a Plan, Recetas o Compras mostraba la barra
    // de navegador (X, dirección y botones), como si fuera Safari.
    id: '/',
    start_url: '/inicio/',
    scope: '/',
    display: 'standalone',
    background_color: '#f2f4ee',
    theme_color: '#f2f4ee',
    // Mismas direcciones que las etiquetas del HTML (ver layout.tsx); fuente editable en
    // docs/icon-burger.svg. Antes apuntaban a picsum.photos, un servicio de fotos al azar.
    icons: [
      // Incrustado primero (no necesita descarga); los demás como respaldo
      { src: APPLE_TOUCH_ICON_DATA_URI, sizes: '180x180', type: 'image/png', purpose: 'any' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
