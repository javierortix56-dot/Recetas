import { Firestore, collection, deleteField, doc, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { USER_ID } from '@/lib/constants';
import { uploadRecipeImage } from '@/app/actions/recipe-images';
import { isInlineImage } from '@/lib/recipe-image';

const inlineUrlOf = (r: any): string | null => {
  const url = r.fotoURL || r.imageUrl || null;
  return isInlineImage(url) ? url : null;
};

/** Recetas cuya foto sigue guardada como base64 dentro del documento */
export const recipesWithInlinePhoto = (recetas: any[]) => recetas.filter(r => inlineUrlOf(r));

/**
 * Mueve a Blob las fotos que están dentro de las recetas y quita las copias
 * que los planes viejos guardaban de esas mismas fotos. Es idempotente: se
 * puede repetir sin duplicar nada y no borra una foto hasta que la nueva
 * subió bien.
 */
export async function migrateInlinePhotos(
  db: Firestore,
  recetas: any[],
  onProgress?: (done: number, total: number) => void
): Promise<{ moved: number; failed: number; plansCleaned: number }> {
  const pending = recipesWithInlinePhoto(recetas);
  let moved = 0, failed = 0;

  for (const [i, r] of pending.entries()) {
    try {
      const url = await uploadRecipeImage(inlineUrlOf(r)!);
      await updateDoc(doc(db, 'users', USER_ID, 'recipes', r.id), { fotoURL: url, imageUrl: null });
      moved++;
    } catch (e) {
      console.error('No se pudo mover la foto de', r.nombre, e);
      failed++;
    }
    onProgress?.(i + 1, pending.length);
  }

  // Los planes viejos guardaban su propia copia base64 de la foto (todos los perfiles)
  let plansCleaned = 0;
  if (failed === 0) {
    const snap = await getDocs(collection(db, 'users', USER_ID, 'meal_plans'));
    const withCopy = snap.docs.filter(d => {
      const data = d.data();
      return isInlineImage(data.recipeImageUrl) || isInlineImage(data.imageUrl);
    });
    for (let i = 0; i < withCopy.length; i += 450) {
      const batch = writeBatch(db);
      withCopy.slice(i, i + 450).forEach(d => batch.update(d.ref, { recipeImageUrl: deleteField(), imageUrl: deleteField() }));
      await batch.commit();
    }
    plansCleaned = withCopy.length;
  }

  return { moved, failed, plansCleaned };
}
