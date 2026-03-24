/**
 * @fileOverview Lógica centralizada y optimizada para la sincronización de la lista de compras.
 * Minimiza las escrituras en Firestore mediante comparaciones diferenciales y bloqueo de concurrencia.
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

// Bloqueo de concurrencia: si hay un sync en curso y llega otro, lo ejecutamos al terminar
let isSyncing = false;
let pendingSync: { db: Firestore; profile: UserProfileName } | null = null;

/**
 * Sincroniza la lista de compras basándose en los planes de comida del perfil activo y el stock actual.
 * Utiliza una estrategia diferencial para minimizar las escrituras.
 *
 * La lista de compras es COMPARTIDA por la familia. Este sync considera solo los planes del
 * perfil activo para evitar que los planes de otro perfil generen ítems inesperados.
 */
export const syncShoppingList = async (db: Firestore, activeProfile: UserProfileName) => {
  if (!db) return;

  // Si ya hay un sync corriendo, guardar la solicitud y ejecutarla al terminar
  if (isSyncing) {
    pendingSync = { db, profile: activeProfile };
    return;
  }

  isSyncing = true;
  console.log(`Iniciando sync de lista de compras para perfil: ${activeProfile}...`);

  try {
    // 1. Cargar datos necesarios en paralelo — planes filtrados por perfil activo
    const [plansSnap, ingsSnap, shoppingSnap] = await Promise.all([
      getDocs(query(
        collection(db, "users", USER_ID, "meal_plans"),
        where("perfil", "==", activeProfile)
      )),
      getDocs(collection(db, "users", USER_ID, "ingredients")),
      getDocs(collection(db, "users", USER_ID, "shopping_list_items"))
    ]);

    const allPlans = plansSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allIngredients = ingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const currentShoppingItems = shoppingSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

    // Mapas para procesamiento eficiente
    const stockMap = new Map(allIngredients.map(ing => [(ing.nombre || "").toLowerCase().trim(), ing as any]));
    const neededMap = new Map<string, { nombre: string, cantidad: number, unidad: string, categoria: string }>();
    // Mapa de justificación: qué recetas necesitan cada ingrediente
    const recipesByIngredient = new Map<string, string[]>();

    // 2. Calcular necesidades desde el plan del perfil activo
    allPlans.forEach((plan: any) => {
      const planPortions = Number(plan.plannedPortions) || 1;
      const originalPortions = Number(plan.recipeOriginalPortions) || 1;
      const scale = planPortions > 0 && originalPortions > 0
        ? planPortions / originalPortions
        : 1;

      (plan.ingredientes || []).forEach((ing: any) => {
        const nombreIng = (ing.nombre || "").toLowerCase().trim();
        if (!nombreIng || isSubPreparation(nombreIng)) return;

        // Registrar qué recetas usan este ingrediente
        const recipes = recipesByIngredient.get(nombreIng) || [];
        const recipeName = plan.recipeName || "Receta";
        if (!recipes.includes(recipeName)) recipes.push(recipeName);
        recipesByIngredient.set(nombreIng, recipes);

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
      // Usar ?? 0 para que stock negativo (error de datos) se trate como 0
      const enStock = Math.max(0, Number(ing.stockActual ?? 0));

      const totalRequerido = Math.max(planNeed, minNeed);
      const faltante = totalRequerido - enStock;

      if (faltante > 0) {
        const precio = ing.precioUnitario || 0;
        const { cantidad: finalQty, unidad: finalUnit } = sugerirUnidadLogica(ing.nombre, faltante, ing.unidad);

        const recipes = recipesByIngredient.get(nombreNorm) || [];
        const justificacion = recipes.length > 0
          ? recipes.join(" · ")
          : "Stock mínimo";

        desiredShoppingMap.set(nombreNorm, {
          nombre: ing.nombre,
          cantidad: Number(finalQty.toFixed(2)),
          unidad: finalUnit,
          categoria: ing.categoria || categorizeIngredient(ing.nombre),
          ingredienteId: ing.id,
          precioUnitario: precio,
          subtotal: precio * finalQty,
          isPurchased: false,
          source: "plan",
          justificacion,
        });
      }
    });

    // B. Agregar ítems del plan que no están en el maestro de ingredientes
    neededMap.forEach((data, nombreNorm) => {
      if (!desiredShoppingMap.has(nombreNorm) && !stockMap.has(nombreNorm)) {
        const { cantidad: finalQty, unidad: finalUnit } = sugerirUnidadLogica(data.nombre, data.cantidad, data.unidad);
        const recipes = recipesByIngredient.get(nombreNorm) || [];
        desiredShoppingMap.set(nombreNorm, {
          ...data,
          cantidad: Number(finalQty.toFixed(2)),
          unidad: finalUnit,
          ingredienteId: "",
          precioUnitario: 0,
          subtotal: 0,
          isPurchased: false,
          source: "plan",
          justificacion: recipes.join(" · ") || "Plan de comidas",
        });
      }
    });

    // 4. ESTRATEGIA DIFERENCIAL (Escritura inteligente)
    const batch = writeBatch(db);
    let writeCount = 0;

    // A. Identificar qué borrar — NUNCA borrar ítems manuales.
    // Los ítems del plan se borran si ya no son necesarios, incluso si están marcados como comprados,
    // para que una desplanificación deje la lista limpia.
    for (const current of currentShoppingItems) {
      // Preservar items manuales siempre
      if (current.source === "manual" || current.reason === "Manual") continue;

      const nombreNorm = (current.nombre || "").toLowerCase().trim();
      if (!desiredShoppingMap.has(nombreNorm)) {
        batch.delete(doc(db, "users", USER_ID, "shopping_list_items", current.id));
        writeCount++;
      }
    }

    // B. Identificar qué crear o actualizar
    desiredShoppingMap.forEach((desiredData, nombreNorm) => {
      const existing = currentShoppingItems.find(i =>
        !i.isPurchased &&
        (i.source === "plan" || (!i.source && i.reason !== "Manual")) &&
        (i.nombre || "").toLowerCase().trim() === nombreNorm
      );

      if (existing) {
        const hasChanges =
          Math.abs(existing.cantidad - desiredData.cantidad) > 0.01 ||
          existing.unidad !== desiredData.unidad ||
          existing.categoria !== desiredData.categoria ||
          existing.precioUnitario !== desiredData.precioUnitario ||
          existing.justificacion !== desiredData.justificacion;

        if (hasChanges) {
          batch.update(doc(db, "users", USER_ID, "shopping_list_items", existing.id), {
            ...desiredData,
            updatedAt: serverTimestamp()
          });
          writeCount++;
        }
      } else {
        const newRef = doc(collection(db, "users", USER_ID, "shopping_list_items"));
        batch.set(newRef, {
          userId: USER_ID,
          ...desiredData,
          createdAt: serverTimestamp()
        });
        writeCount++;
      }
    });

    if (writeCount > 0) {
      await batch.commit();
      console.log(`Sync completado: ${writeCount} operaciones realizadas.`);
    } else {
      console.log("Sync completado: sin cambios.");
    }

  } catch (error) {
    console.error("Error en syncShoppingList:", error);
    throw error;
  } finally {
    isSyncing = false;
    // Si hubo una solicitud pendiente mientras corría este sync, ejecutarla ahora
    if (pendingSync) {
      const { db: pendingDb, profile: pendingProfile } = pendingSync;
      pendingSync = null;
      syncShoppingList(pendingDb, pendingProfile);
    }
  }
};
