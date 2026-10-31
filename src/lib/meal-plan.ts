/**
 * @fileOverview Escritura de comidas planificadas. Antes la misma lógica
 * (plan + log diario + resumen de macros) estaba copiada en el diálogo de
 * planificar, en "planear día" y en "planear semana".
 */

import {
  Firestore,
  WriteBatch,
  collection,
  doc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { USER_ID } from "@/lib/constants";
import type { UserProfileName } from "@/store/app-store";

export type Macros = { calorias: number; proteinas: number; carbohidratos: number; grasas: number };

export const EMPTY_MACROS: Macros = { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };

export const MOMENTOS = ["Desayuno", "Almuerzo", "Merienda", "Cena"] as const;

/** Macros por porción de una receta, redondeados */
export function recipeMacros(recipe: any): Macros {
  const m = recipe?.macros || {};
  return {
    calorias: Math.round(Number(m.calorias || 0)),
    proteinas: Math.round(Number(m.proteinas || 0)),
    carbohidratos: Math.round(Number(m.carbohidratos || 0)),
    grasas: Math.round(Number(m.grasas || 0)),
  };
}

export function sumMacros(items: { macros?: Partial<Macros> }[]): Macros {
  return items.reduce<Macros>((acc, i) => ({
    calorias: acc.calorias + Number(i.macros?.calorias || 0),
    proteinas: acc.proteinas + Number(i.macros?.proteinas || 0),
    carbohidratos: acc.carbohidratos + Number(i.macros?.carbohidratos || 0),
    grasas: acc.grasas + Number(i.macros?.grasas || 0),
  }), { ...EMPTY_MACROS });
}

const summaryRef = (db: Firestore, date: string, profile: UserProfileName) =>
  doc(db, "users", USER_ID, "daily_macro_summaries", `${date}_${profile}`);

/** Suma (o resta, con sign = -1) macros al resumen diario del perfil */
export function addToSummary(batch: WriteBatch, db: Firestore, date: string, profile: UserProfileName, macros: Macros, sign: 1 | -1 = 1) {
  batch.set(summaryRef(db, date, profile), {
    date,
    userId: USER_ID,
    perfil: profile,
    totalesDia: {
      calorias: increment(sign * macros.calorias),
      proteinas: increment(sign * macros.proteinas),
      carbohidratos: increment(sign * macros.carbohidratos),
      grasas: increment(sign * macros.grasas),
    },
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/** Pone en cero el resumen de un día (antes de re-planificarlo) */
export function resetSummary(batch: WriteBatch, db: Firestore, date: string, profile: UserProfileName) {
  batch.set(summaryRef(db, date, profile), {
    date,
    userId: USER_ID,
    perfil: profile,
    totalesDia: { ...EMPTY_MACROS },
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Agrega una comida planificada al batch: plan + log diario (para Nutrición).
 * La foto NO se copia al plan (era base64 y multiplicaba el peso de cada
 * documento); las vistas la toman de la receta.
 * El resumen diario lo actualiza quien llama (una sola escritura por día).
 */
export function addMealPlan(batch: WriteBatch, db: Firestore, opts: {
  recipe: any
  date: string
  mealType: string
  portions: number
  profile: UserProfileName
}): Macros {
  const { recipe, date, mealType, portions, profile } = opts;
  const macros = recipeMacros(recipe);
  const planRef = doc(collection(db, "users", USER_ID, "meal_plans"));

  batch.set(planRef, {
    userId: USER_ID,
    perfil: profile,
    date,
    mealType,
    recipeId: recipe.id,
    recipeName: recipe.nombre,
    recipeCategory: recipe.categoria || recipe.categorias?.[0] || "Almuerzo",
    plannedPortions: portions,
    recipeOriginalPortions: recipe.porciones || 1,
    macros,
    ingredientes: recipe.ingredientes || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(collection(db, "users", USER_ID, "daily_logs")), {
    userId: USER_ID,
    perfil: profile,
    date,
    momento: mealType,
    recetaId: recipe.id,
    recetaNombre: recipe.nombre,
    recetaCategoria: recipe.categoria || recipe.categorias?.[0] || "Almuerzo",
    porciones: 1,
    macros,
    planId: planRef.id,
    createdAt: serverTimestamp(),
  });

  return macros;
}

/** Borra planes y logs del perfil para las fechas dadas y deja los resúmenes en cero */
export async function clearPlansForDates(batch: WriteBatch, db: Firestore, dates: string[], profile: UserProfileName) {
  // "in" admite hasta 30 valores; una semana son 7
  const [plansSnap, logsSnap] = await Promise.all([
    getDocs(query(collection(db, "users", USER_ID, "meal_plans"), where("date", "in", dates), where("perfil", "==", profile))),
    getDocs(query(collection(db, "users", USER_ID, "daily_logs"), where("date", "in", dates), where("perfil", "==", profile))),
  ]);
  plansSnap.docs.forEach(d => batch.delete(d.ref));
  logsSnap.docs.forEach(d => batch.delete(d.ref));
  dates.forEach(date => resetSummary(batch, db, date, profile));
}

/** Borra una comida planificada con su log y descuenta sus macros */
export async function removeMealPlan(batch: WriteBatch, db: Firestore, plan: any, profile: UserProfileName) {
  batch.delete(doc(db, "users", USER_ID, "meal_plans", plan.id));
  const logSnap = await getDocs(query(
    collection(db, "users", USER_ID, "daily_logs"),
    where("planId", "==", plan.id),
    where("perfil", "==", profile)
  ));
  logSnap.docs.forEach(d => batch.delete(d.ref));
  addToSummary(batch, db, plan.date, profile, recipeMacros(plan), -1);
}

/** Fecha (yyyy-MM-dd) de un resumen diario: el campo date o el prefijo del id "fecha_perfil" */
export function summaryDate(summary: any): string {
  return summary?.date || String(summary?.id || "").split("_")[0];
}

const LIGHT_MEALS = ["Desayuno", "Merienda"];
const HEAVY_MEALS = ["Almuerzo", "Cena"];

/**
 * Planificador local, sin IA ni costo (traído de la rama que estaba en
 * producción). Prioriza la categoría del momento, evita repetir recetas y no
 * cruza comidas livianas con fuertes salvo que no quede otra opción.
 * Se usa si la planificación con IA falla (sin clave, sin cuota o sin red).
 */
export function pickRecipesLocally(recetas: any[], dates: string[], momentos: readonly string[] = MOMENTOS) {
  const used = new Set<string>();
  const cats = (r: any): string[] => (Array.isArray(r.categorias) ? r.categorias : r.categoria ? [r.categoria] : []);
  const plans: { date: string; mealType: string; recipeId: string; recipeName: string }[] = [];

  for (const date of dates) {
    for (const momento of momentos) {
      const unused = recetas.filter(r => !used.has(r.id));
      const incompatible = LIGHT_MEALS.includes(momento) ? HEAVY_MEALS : HEAVY_MEALS.includes(momento) ? LIGHT_MEALS : [];
      const pools = [
        unused.filter(r => cats(r).includes(momento)),                        // 1. categoría exacta
        unused.filter(r => cats(r).length === 0),                             // 2. sin categoría
        unused.filter(r => !cats(r).some(c => incompatible.includes(c))),    // 3. sin cruzar liviano/fuerte
        unused,                                                               // 4. cualquiera sin usar
        recetas,                                                              // 5. repetir
      ];
      const pool = pools.find(p => p.length > 0) || [];
      const recipe = pool[Math.floor(Math.random() * pool.length)];
      if (recipe) {
        used.add(recipe.id);
        plans.push({ date, mealType: momento, recipeId: recipe.id, recipeName: recipe.nombre });
      }
    }
  }
  return plans;
}
