
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  trailingSlash: true,
  // La barra final la agrega src/middleware.ts, salvo en /__/auth (Firebase responde 404 con barra)
  skipTrailingSlashRedirect: true,
  // El service worker se revisa en cada visita: así una versión nueva llega sin quedar atrapada en caché
  async headers() {
    return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
  experimental: {
    // Las fotos (JPEG de 700 px) viajan como data URL hacia la server action
    serverActions: { bodySizeLimit: '3mb' },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
