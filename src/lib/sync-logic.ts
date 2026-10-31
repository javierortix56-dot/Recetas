/**
 * @fileOverview Lógica centralizada para la sincronización de la lista de compras.
 *
 * 1. Calcula desde cero lo que se necesita (MRP: plan + stock mínimo vs stock actual)
 * 2. Reconcilia contra la lista actual por nombre: actualiza los que siguen,
 *    crea los nuevos y borra los que ya no hacen falta. Así los ítems que ya
 *    estaban tildados en el carrito conservan su estado (antes se borraba y
 *    recreaba todo, y cualquier cambio en el plan destildaba el carrito).
 *
 * La lista es compartida, así que suma los planes de TODOS los perfiles
 * (antes solo los del perfil activo: si Mary planificaba, desaparecían de la
 * lista los ingredientes del plan de Javi).
 *
 * Los ítems manuales (source === "manual" | reason === "Manual") nunca se tocan.
 */

import {
  Firestore,
  collection,
  getDocs,
  writeBatch,
  WriteBatch,
  doc,
  serverTimestamp,
  query,
  where
} from "firebase/firestore";
import { USER_ID } from "@/lib/constants";
import type { UserProfileName } from "@/store/app-store";
import { categorizeIngredient, isSubPreparation } from "@/lib/categorizeIngredient";
import { convertirCantidad, sugerirUnidadLogica } from "@/lib/utils";
import { nameKey } from "@/lib/ingredient-groups";
import { format } from "date-fns";

// Bloqueo de concurrencia: si hay un sync en curso, el nuevo se encola
let isSyncing = false;
let pendingSync: Firestore | null = null;

/**
 * MRP de la lista de compras:
 * Para cada ingrediente: faltante = MAX(necesidadPlan, stockMínimo) - stockActual
 * Si faltante > 0 → agregar a la lista de compras
 *
 * El parámetro de perfil se mantiene por compatibilidad con los llamadores.
 */
export const syncShoppingList = async (db: Firestore, _activeProfile?: UserProfileName) => {
  if (!db) return;

  if (isSyncing) {
    pendingSync = db;
    return;
  }

  isSyncing = true;

  try {
    // 1. Cargar datos en paralelo
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const [plansSnap, ingsSnap, shoppingSnap] = await Promise.all([
      // Solo planes de hoy en adelante (antes se leía todo el historial)
      getDocs(query(
        collection(db, "users", USER_ID, "meal_plans"),
        where("date", ">=", todayStr)
      )),
      getDocs(collection(db, "users", USER_ID, "ingredients")),
      getDocs(collection(db, "users", USER_ID, "shopping_list_items"))
    ]);

    const allPlans       = plansSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    const allIngredients = ingsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    const allShoppingItems = shoppingSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

    const stockMap = new Map<string, any>(
      allIngredients.map(ing => [nameKey(ing.nombre), ing])
    );

    // 2. Calcular necesidades del plan (MRP)
    const neededMap = new Map<string, { nombre: string; cantidad: number; unidad: string; categoria: string }>();
    const recipesByIngredient = new Map<string, string[]>();

    allPlans.forEach((plan) => {
      const planPortions     = Number(plan.plannedPortions) || 1;
      const originalPortions = Number(plan.recipeOriginalPortions) || 1;
      const scale = (planPortions > 0 && originalPortions > 0) ? planPortions / originalPortions : 1;

      (plan.ingredientes || []).forEach((ing: any) => {
        const key = nameKey(ing.nombre);
        if (!key || isSubPreparation(key)) return;

        const recipes = recipesByIngredient.get(key) || [];
        if (!recipes.includes(plan.recipeName || "Receta")) recipes.push(plan.recipeName || "Receta");
        recipesByIngredient.set(key, recipes);

        const stockItem = stockMap.get(key);
        const rawQty = (Number(ing.cantidad) || 0) * scale;
        const qty = stockItem ? convertirCantidad(rawQty, ing.unidad, stockItem.unidad, ing.nombre) : rawQty;

        const existing = neededMap.get(key);
        if (existing) {
          existing.cantidad += qty;
        } else {
          neededMap.set(key, {
            nombre:    ing.nombre,
            cantidad:  qty,
            unidad:    stockItem?.unidad || ing.unidad || "unid",
            categoria: ing.categoria || categorizeIngredient(ing.nombre),
          });
        }
      });
    });

    // 3. Calcular qué debería haber en la lista (desiredItems)
    const desiredItems = new Map<string, any>();

    // A. Ingredientes del maestro: comparar plan + mínimo vs stock actual
    allIngredients.forEach((ing) => {
      const key      = nameKey(ing.nombre);
      const planNeed = neededMap.get(key)?.cantidad || 0;
      const minNeed  = Number(ing.stockMinimo ?? 0);
      const enStock  = Math.max(0, Number(ing.stockActual ?? 0));

      const totalRequerido = Math.max(planNeed, minNeed);
      const faltante       = totalRequerido - enStock;

      if (faltante > 0) {
        const recipes       = recipesByIngredient.get(key) || [];
        const justificacion = recipes.length > 0 ? recipes.join(" · ") : "Stock mínimo";
        const { cantidad: finalQty, unidad: finalUnit } = sugerirUnidadLogica(ing.nombre, faltante, ing.unidad);

        desiredItems.set(key, {
          nombre:        ing.nombre,
          cantidad:      Number(finalQty.toFixed(2)),
          unidad:        finalUnit,
          categoria:     ing.categoria || categorizeIngredient(ing.nombre),
          ingredienteId: ing.id,
          precioUnitario: ing.precioUnitario || 0,
          subtotal:      (ing.precioUnitario || 0) * finalQty,
          isPurchased:   false,
          source:        "plan",
          justificacion,
        });
      }
    });

    // B. Ingredientes del plan que no están en el maestro de stock
    neededMap.forEach((data, key) => {
      if (desiredItems.has(key) || stockMap.has(key)) return;
      const { cantidad: finalQty, unidad: finalUnit } = sugerirUnidadLogica(data.nombre, data.cantidad, data.unidad);
      const recipes = recipesByIngredient.get(key) || [];
      desiredItems.set(key, {
        ...data,
        cantidad:      Number(finalQty.toFixed(2)),
        unidad:        finalUnit,
        ingredienteId: "",
        precioUnitario: 0,
        subtotal:      0,
        isPurchased:   false,
        source:        "plan",
        justificacion: recipes.join(" · ") || "Plan de comidas",
      });
    });

    // 4. Reconciliar con la lista actual (los manuales no se tocan)
    const ops: ((batch: WriteBatch) => void)[] = [];
    const seen = new Set<string>();

    for (const item of allShoppingItems) {
      const isManual = item.source === "manual" || item.reason === "Manual";
      if (isManual) continue;
      const ref = doc(db, "users", USER_ID, "shopping_list_items", item.id);
      const key = nameKey(item.nombre);
      const desired = desiredItems.get(key);

      if (!desired || seen.has(key)) {
        // Ya no hace falta (o es un duplicado de otro ítem del plan)
        ops.push(b => b.delete(ref));
        continue;
      }
      seen.add(key);

      const changed =
        item.cantidad !== desired.cantidad ||
        item.unidad !== desired.unidad ||
        item.precioUnitario !== desired.precioUnitario ||
        item.justificacion !== desired.justificacion ||
        item.categoria !== desired.categoria ||
        item.ingredienteId !== desired.ingredienteId ||
        item.source !== "plan";
      if (changed) {
        const { isPurchased: _keep, ...fields } = desired;
        ops.push(b => b.update(ref, { ...fields, updatedAt: serverTimestamp() }));
      }
    }

    desiredItems.forEach((data, key) => {
      if (seen.has(key)) return;
      const ref = doc(collection(db, "users", USER_ID, "shopping_list_items"));
      ops.push(b => b.set(ref, { userId: USER_ID, ...data, createdAt: serverTimestamp() }));
    });

    // Firestore admite hasta 500 operaciones por batch
    for (let i = 0; i < ops.length; i += 450) {
      const batch = writeBatch(db);
      ops.slice(i, i + 450).forEach(op => op(batch));
      await batch.commit();
    }

  } catch (error) {
    console.error("[Sync] Error:", error);
    throw error;
  } finally {
    isSyncing = false;
    if (pendingSync) {
      const pDb = pendingSync;
      pendingSync = null;
      syncShoppingList(pDb).catch(() => {});
    }
  }
};
