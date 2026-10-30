
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cocina Familiar',
    short_name: 'CocinaFam',
    description: 'Gestión de recetas familiares y nutrición',
    start_url: '/',
    display: 'standalone',
    background_color: '#f2f4ee',
    theme_color: '#f2f4ee',
    icons: [
      {
        src: 'https://picsum.photos/seed/hamburger/192/192',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'https://picsum.photos/seed/hamburger/512/512',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
