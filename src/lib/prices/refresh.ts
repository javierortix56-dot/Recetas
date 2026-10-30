import { Firestore, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { USER_ID } from '@/lib/constants';
import { refreshPrices } from '@/app/actions/prices';
import { pricePerBaseUnit, type PriceRef } from '@/lib/prices/types';

export const linkedIngredients = (ingredientes: any[]) =>
  ingredientes.filter(i => Array.isArray(i.fuentesPrecio) && i.fuentesPrecio.length > 0);

/**
 * Actualiza el precio de cada ingrediente vinculado con el promedio actual de
 * sus productos (por código de barras). Si ninguna fuente responde, deja el
 * precio anterior. Procesa de a 3 ingredientes para no saturar las webs.
 */
export async function refreshLinkedPrices(
  db: Firestore,
  ingredientes: any[],
  onProgress?: (done: number, total: number) => void
): Promise<{ updated: number; unchanged: number; notFound: number }> {
  const items = linkedIngredients(ingredientes);
  let updated = 0, unchanged = 0, notFound = 0, done = 0;

  const queue = [...items];
  const worker = async () => {
    let ing: any;
    while ((ing = queue.shift())) {
      try {
        const offers = await refreshPrices(ing.fuentesPrecio as PriceRef[]);
        const values = offers.map(o => pricePerBaseUnit(o, ing.unidad)).filter((v): v is number => v !== null);
        if (values.length === 0) {
          notFound++;
        } else {
          const avg = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
          if (Math.abs(avg - Number(ing.precioUnitario || 0)) < 0.01) {
            unchanged++;
          } else {
            await updateDoc(doc(db, 'users', USER_ID, 'ingredients', ing.id), {
              precioUnitario: avg,
              ultimaActualizacionPrecio: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            updated++;
          }
        }
      } catch (e) {
        console.error('No se pudo actualizar', ing.nombre, e);
        notFound++;
      }
      onProgress?.(++done, items.length);
    }
  };

  await Promise.all([worker(), worker(), worker()]);
  return { updated, unchanged, notFound };
}
