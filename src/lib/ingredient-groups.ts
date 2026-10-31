import { convertirCantidad, normalizarUnidad } from "@/lib/utils"

/**
 * Clave para comparar nombres de ingredientes: sin mayúsculas, tildes ni plural.
 * "Morrón rojo", "morron rojo" y "Morrones rojos" dan la misma clave.
 */
export function nameKey(nombre: string): string {
  return (nombre || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(w => {
      if (w.length > 4 && /[^aeiou]es$/.test(w)) return w.slice(0, -2) // limones → limon
      if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1) // papas → papa
      return w
    })
    .join(" ")
}

const FAMILY: Record<string, string> = { g: "peso", kg: "peso", ml: "volumen", l: "volumen", unidad: "unidad", docena: "unidad" }

/** Dos unidades se pueden sumar solo si son de la misma familia (g/kg, ml/l, unidad/docena) */
export function unidadesCompatibles(a: string, b: string): boolean {
  const na = normalizarUnidad(a)
  const nb = normalizarUnidad(b)
  if (na === nb) return true
  return !!FAMILY[na] && FAMILY[na] === FAMILY[nb]
}

type Ing = { nombre: string; cantidad?: any; unidad?: string; preparacion?: string; [k: string]: any }

/**
 * Renombra los ingredientes de una lista (receta o plan) y junta los que quedan
 * repetidos: "Papa blanca 500 g" + "Papa negra 300 g" → "Papa 800 g".
 * Devuelve null si la lista no cambia.
 */
export function renameIngredients<T extends Ing>(list: T[] | undefined, keys: Set<string>, mainName: string): T[] | null {
  if (!list?.some(i => keys.has(nameKey(i.nombre)))) return null
  const out: T[] = []
  for (const ing of list) {
    if (!keys.has(nameKey(ing.nombre))) { out.push(ing); continue }
    const renamed = { ...ing, nombre: mainName }
    const prev = out.find(o => o.nombre === mainName)
    if (!prev) { out.push(renamed); continue }
    if (unidadesCompatibles(ing.unidad || "", prev.unidad || "")) {
      const suma = (Number(prev.cantidad) || 0) + convertirCantidad(Number(ing.cantidad) || 0, ing.unidad || "", prev.unidad || "")
      ;(prev as Ing).cantidad = typeof prev.cantidad === "string" ? String(+suma.toFixed(2)) : +suma.toFixed(2)
      const preps = [prev.preparacion, ing.preparacion].filter(Boolean)
      ;(prev as Ing).preparacion = Array.from(new Set(preps)).join(" / ")
    } else {
      // Unidades que no se pueden sumar (ej. 1 unidad + 200 g): se dejan las dos líneas
      out.push(renamed)
    }
  }
  return out
}
