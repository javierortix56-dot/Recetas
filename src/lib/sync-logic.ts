/**
 * @fileOverview Lógica centralizada para la sincronización de la lista de compras.
 *
 * Estrategia: DELETE + RECREATE
 * En lugar de lógica diferencial compleja (que tiene edge cases), este sync:
 * 1. Borra TODOS los ítems del plan (source === "plan") de Firestore
 * 2. Calcula desde cero lo que se necesita (MRP: plan + stock mínimo vs stock actual)
 * 3. Crea solo los ítems necesarios
 *
 * Los ítems manuales (source === "manual" | reason === "Manual") nunca se tocan.
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
import { UserProfileName } from "@/store/app-store";
import { categorizeIngredient, isSubPreparation } from "@/lib/categorizeIngredient";
import { convertirCantidad, sugerirUnidadLogica } from "@/lib/utils";

// Bloqueo de concurrencia: si hay un sync en curso, el nuevo se encola
let isSyncing = false;
let pendingSync: { db: Firestore; profile: UserProfileName } | null = null;

/**
 * MRP de la lista de compras:
 * Para cada ingrediente: faltante = MAX(necesidadPlan, stockMínimo) - stockActual
 * Si faltante > 0 → agregar a la lista de compras
 *
 * Solo considera los planes del perfil activo.
 */
export const syncShoppingList = async (db: Firestore, activeProfile: UserProfileName) => {
  if (!db) return;

  if (isSyncing) {
    pendingSync = { db, profile: activeProfile };
    return;
  }

  isSyncing = true;
  console.log(`[Sync] Iniciando para perfil="${activeProfile}"...`);

  try {
    // 1. Cargar datos en paralelo
    const [plansSnap, ingsSnap, shoppingSnap] = await Promise.all([
      getDocs(query(
        collection(db, "users", USER_ID, "meal_plans"),
        where("perfil", "==", activeProfile)
      )),
      getDocs(collection(db, "users", USER_ID, "ingredients")),
      getDocs(collection(db, "users", USER_ID, "shopping_list_items"))
    ]);

    const allPlans       = plansSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    const allIngredients = ingsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    const allShoppingItems = shoppingSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

    console.log(`[Sync] Planes(${activeProfile}): ${allPlans.length} | Ingredientes: ${allIngredients.length} | Items actuales: ${allShoppingItems.length}`);

    const stockMap = new Map<string, any>(
      allIngredients.map(ing => [(ing.nombre || "").toLowerCase().trim(), ing])
    );

    // 2. Calcular necesidades del plan (MRP)
    const neededMap = new Map<string, { nombre: string; cantidad: number; unidad: string; categoria: string }>();
    const recipesByIngredient = new Map<string, string[]>();

    allPlans.forEach((plan) => {
      const planPortions     = Number(plan.plannedPortions) || 1;
      const originalPortions = Number(plan.recipeOriginalPortions) || 1;
      const scale = (planPortions > 0 && originalPortions > 0) ? planPortions / originalPortions : 1;

      (plan.ingredientes || []).forEach((ing: any) => {
        const key = (ing.nombre || "").toLowerCase().trim();
        if (!key || isSubPreparation(key)) return;

        const recipes = recipesByIngredient.get(key) || [];
        if (!recipes.includes(plan.recipeName || "Receta")) recipes.push(plan.recipeName || "Receta");
        recipesByIngredient.set(key, recipes);

        const stockItem = stockMap.get(key);
        const rawQty = (Number(ing.cantidad) || 0) * scale;
        const qty = stockItem ? convertirCantidad(rawQty, ing.unidad, stockItem.unidad) : rawQty;

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

    console.log(`[Sync] Ingredientes requeridos por plan: [${[...neededMap.keys()].join(", ") || "ninguno"}]`);

    // 3. Calcular qué debería haber en la lista (desiredItems)
    const desiredItems = new Map<string, any>();

    // A. Ingredientes del maestro: comparar plan + mínimo vs stock actual
    allIngredients.forEach((ing) => {
      const key      = (ing.nombre || "").toLowerCase().trim();
      const planNeed = neededMap.get(key)?.cantidad || 0;
      const minNeed  = Number(ing.stockMinimo ?? 0);
      const enStock  = Math.max(0, Number(ing.stockActual ?? 0));

      const totalRequerido = Math.max(planNeed, minNeed);
      const faltante       = totalRequerido - enStock;

      if (faltante > 0) {
        const recipes       = recipesByIngredient.get(key) || [];
        const justificacion = recipes.length > 0 ? recipes.join(" · ") : "Stock mínimo";
        const { cantidad: finalQty, unidad: finalUnit } = sugerirUnidadLogica(ing.nombre, faltante, ing.unidad);

        console.log(`[Sync] NECESITA COMPRA → "${ing.nombre}": plan=${planNeed}, min=${minNeed}, stock=${enStock}, faltante=${faltante.toFixed(2)} | motivo="${justificacion}"`);

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
      console.log(`[Sync] NECESITA COMPRA (sin stock) → "${data.nombre}": sin entrada en ingredientes`);
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

    console.log(`[Sync] Lista deseada: ${desiredItems.size} ítems → [${[...desiredItems.keys()].join(", ") || "vacía"}]`);

    // 4. ESTRATEGIA DELETE + RECREATE para ítems del plan
    const batch = writeBatch(db);
    let ops = 0;

    // Borrar TODOS los ítems actuales del plan (source="plan" o sin source y sin reason Manual)
    // Preservar siempre los ítems manuales
    for (const item of allShoppingItems) {
      const isManual = item.source === "manual" || item.reason === "Manual";
      const isPlanItem = item.source === "plan" || (!item.source && !isManual);
      if (isPlanItem) {
        batch.delete(doc(db, "users", USER_ID, "shopping_list_items", item.id));
        ops++;
      }
    }

    // Crear los ítems nuevos desde desiredItems
    desiredItems.forEach((data) => {
      const ref = doc(collection(db, "users", USER_ID, "shopping_list_items"));
      batch.set(ref, { userId: USER_ID, ...data, createdAt: serverTimestamp() });
      ops++;
    });

    if (ops > 0) {
      await batch.commit();
      console.log(`[Sync] Completado: ${ops} operaciones (borrados + creados).`);
    } else {
      console.log("[Sync] Sin cambios.");
    }

  } catch (error) {
    console.error("[Sync] ERROR:", error);
    throw error;
  } finally {
    isSyncing = false;
    if (pendingSync) {
      const { db: pDb, profile: pProfile } = pendingSync;
      pendingSync = null;
      syncShoppingList(pDb, pProfile);
    }
  }
};
