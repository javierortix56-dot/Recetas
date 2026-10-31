import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cocina Familiar',
    short_name: 'CocinaFam',
    description: 'Gestión de recetas familiares y nutrición',
    start_url: '/inicio/',
    display: 'standalone',
    background_color: '#f2f4ee',
    theme_color: '#f2f4ee',
    // Íconos propios (fuente editable en docs/icon-burger.svg). Antes apuntaban a
    // picsum.photos, un servicio de fotos al azar.
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
