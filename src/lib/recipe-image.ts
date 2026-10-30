import { compressImageSrc } from '@/lib/utils';
import { uploadRecipeImage } from '@/app/actions/recipe-images';

/** True si la foto sigue guardada como base64 dentro del documento */
export const isInlineImage = (url?: string | null): boolean => !!url && url.startsWith('data:');

/** Comprime (JPEG 700 px) y sube a Blob; devuelve la URL pública */
export async function uploadImageSrc(src: string): Promise<string> {
  return uploadRecipeImage(await compressImageSrc(src));
}
