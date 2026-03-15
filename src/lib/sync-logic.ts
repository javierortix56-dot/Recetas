/**
 * @fileOverview Lógica centralizada y optimizada para la sincronización de la lista de compras.
 * Minimiza las escrituras en Firestore mediante comparaciones diferenciales.
 */

import { 
  Firestore, 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  serverTimestamp, 
  query, 
  where 
} from "firebase/firestore";
import { USER_ID } from "@/lib/constants";
import { categorizeIngredient, isSubPreparation } from "@/lib/categorizeIngredient";
import { convertirCantidad, sugerirUnidadLogica } from "@/lib/utils";

/**
 * Sincroniza la lista de compras basándose en los planes de comida y el stock actual.
 * Utiliza una estrategia diferencial para minimizar las escrituras (evita el error resource-exhausted).
 */
export const syncShoppingList = async (db: Firestore) => {
  if (!db) return;

  try {
    // 1. Cargar datos necesarios en paralelo
    const [plansSnap, ingsSnap, shoppingSnap] = await Promise.all([
      getDocs(collection(db, "users", USER_ID, "meal_plans")),
      getDocs(collection(db, "users", USER_ID, "ingredients")),
      getDocs(collection(db, "users", USER_ID, "shopping_list_items"))
    ]);

    const allPlans = plansSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allIngredients = ingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const currentShoppingItems = shoppingSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    
    // Mapas para procesamiento eficiente
    const stockMap = new Map(allIngredients.map(ing => [(ing.nombre || "").toLowerCase().trim(), ing as any]));
    const neededMap = new Map<string, { nombre: string, cantidad: number, unidad: string, categoria: string }>();
    
    // 2. Calcular necesidades desde el plan
    allPlans.forEach((plan: any) => {
      const planPortions = Number(plan.plannedPortions) || 1;
      const originalPortions = Number(plan.recipeOriginalPortions) || 1;
      const scale = planPortions / originalPortions;

      (plan.ingredientes || []).forEach((ing: any) => {
        const nombreIng = (ing.nombre || "").toLowerCase().trim();
        if (!nombreIng || isSubPreparation(nombreIng)) return;
        
        const rawQty = (Number(ing.cantidad) || 0) * scale;
        const stockItem = stockMap.get(nombreIng);
        
        const convertedQty = stockItem 
          ? convertirCantidad(rawQty, ing.unidad, stockItem.unidad)
          : rawQty;

        const existing = neededMap.get(nombreIng);
        if (existing) {
          existing.cantidad += convertedQty;
        } else {
          neededMap.set(nombreIng, { 
            nombre: ing.nombre, 
            cantidad: convertedQty, 
            unidad: stockItem?.unidad || ing.unidad || "unid", 
            categoria: ing.categoria || categorizeIngredient(ing.nombre) 
          });
        }
      });
    });

    // 3. Generar el mapa de lo que REALMENTE debería estar en la lista de compras
    const desiredShoppingMap = new Map<string, any>();

    // A. Basado en stock mínimo vs actual y necesidades del plan
    allIngredients.forEach((ing: any) => {
      const nombreNorm = (ing.nombre || "").toLowerCase().trim();
      const planNeed = neededMap.get(nombreNorm)?.cantidad || 0;
      const minNeed = Number(ing.stockMinimo ?? 0);
      const enStock = Number(ing.stockActual || 0);
      
      const totalRequerido = Math.max(planNeed, minNeed);
      const faltante = totalRequerido - enStock;

      if (faltante > 0) {
        const precio = ing.precioUnitario || 0;
        const { cantidad: finalQty, unidad: finalUnit } = sugerirUnidadLogica(ing.nombre, faltante, ing.unidad);
        
        desiredShoppingMap.set(nombreNorm, {
          nombre: ing.nombre,
          cantidad: Number(finalQty.toFixed(2)),
          unidad: finalUnit,
          categoria: ing.categoria || categorizeIngredient(ing.nombre),
          ingredienteId: ing.id,
          precioUnitario: precio,
          subtotal: precio * finalQty,
          isPurchased: false
        });
      }
    });

    // B. Agregar ítems del plan que no están en el maestro de ingredientes
    neededMap.forEach((data, nombreNorm) => {
      if (!desiredShoppingMap.has(nombreNorm) && !stockMap.has(nombreNorm)) {
        const { cantidad: finalQty, unidad: finalUnit } = sugerirUnidadLogica(data.nombre, data.cantidad, data.unidad);
        desiredShoppingMap.set(nombreNorm, {
          ...data,
          cantidad: Number(finalQty.toFixed(2)),
          unidad: finalUnit,
          ingredienteId: "",
          precioUnitario: 0,
          subtotal: 0,
          isPurchased: false
        });
      }
    });

    // 4. ESTRATEGIA DIFERENCIAL (Escritura inteligente)
    const batch = writeBatch(db);
    let writeCount = 0;

    // A. Identificar qué borrar (están en Firestore pero no en el mapa deseado y NO han sido comprados)
    for (const current of currentShoppingItems) {
      if (current.isPurchased) continue; // No tocamos lo ya comprado
      
      const nombreNorm = (current.nombre || "").toLowerCase().trim();
      if (!desiredShoppingMap.has(nombreNorm)) {
        batch.delete(doc(db, "users", USER_ID, "shopping_list_items", current.id));
        writeCount++;
      }
    }

    // B. Identificar qué crear o actualizar
    desiredShoppingMap.forEach((desiredData, nombreNorm) => {
      const existing = currentShoppingItems.find(i => 
        !i.isPurchased && (i.nombre || "").toLowerCase().trim() === nombreNorm
      );

      if (existing) {
        // Solo actualizar si hay cambios significativos
        const hasChanges = 
          Math.abs(existing.cantidad - desiredData.cantidad) > 0.01 ||
          existing.unidad !== desiredData.unidad ||
          existing.categoria !== desiredData.categoria ||
          existing.precioUnitario !== desiredData.precioUnitario;

        if (hasChanges) {
          batch.update(doc(db, "users", USER_ID, "shopping_list_items", existing.id), {
            ...desiredData,
            updatedAt: serverTimestamp()
          });
          writeCount++;
        }
      } else {
        // Crear nuevo
        const newRef = doc(collection(db, "users", USER_ID, "shopping_list_items"));
        batch.set(newRef, {
          userId: USER_ID,
          ...desiredData,
          createdAt: serverTimestamp()
        });
        writeCount++;
      }
    });

    // 5. Ejecutar batch solo si hay cambios
    if (writeCount > 0) {
      await batch.commit();
      console.log(`Sync completado: ${writeCount} operaciones realizadas.`);
    }

  } catch (error) {
    console.error("Error en syncShoppingList:", error);
    throw error;
  }
};
