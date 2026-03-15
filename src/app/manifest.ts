
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cocina Familiar',
    short_name: 'CocinaFam',
    description: 'Gestión de recetas familiares y nutrición',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7FAF8',
    theme_color: '#2D9A6B',
    icons: [
      {
        src: 'https://picsum.photos/seed/app-icon/192/192',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'https://picsum.photos/seed/app-icon/512/512',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
