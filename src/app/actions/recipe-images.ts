'use server';
import { requireUser } from '@/lib/server-auth';
/**
 * @fileOverview Almacenamiento de fotos de recetas en Vercel Blob.
 * Antes la foto se guardaba como base64 dentro del documento de la receta y
 * viajaba completa con cada listener de Firestore.
 */

import { put, del } from '@vercel/blob';

const MAX_BYTES = 1_500_000;
const BLOB_HOST = /\.public\.blob\.vercel-storage\.com$/;

/** Sube una imagen (data URL JPEG/PNG/WebP) y devuelve su URL pública y estable */
export async function uploadRecipeImage(dataUrl: string): Promise<string> {
  await requireUser();
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error('Formato de imagen no válido');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_BYTES) throw new Error('La imagen es demasiado grande');

  const ext = match[1] === 'image/png' ? 'png' : match[1] === 'image/webp' ? 'webp' : 'jpg';
  const blob = await put(`recetas/foto.${ext}`, buffer, {
    access: 'public',
    contentType: match[1],
    addRandomSuffix: true,
    cacheControlMaxAge: 31_536_000,
  });
  return blob.url;
}

/** Borra una foto de Blob. Ignora URLs que no son de la tienda (base64 u otras). */
export async function deleteRecipeImage(url: string | null | undefined): Promise<void> {
  await requireUser();
  if (!url) return;
  try {
    if (!BLOB_HOST.test(new URL(url).hostname)) return;
    await del(url);
  } catch {
    // Mejor esfuerzo: una foto huérfana no rompe nada
  }
}
