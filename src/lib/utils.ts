import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Helper definitivo para obtener el origen de la imagen.
 * Resuelve problemas de caché y nombres de campos inconsistentes.
 */
export const getSafeImageSource = (item: any) => {
  if (!item) return null;
  const url = item.fotoURL || item.imageUrl || item.recipeImageUrl || (item.recipe && (item.recipe.fotoURL || item.recipe.imageUrl));
  if (!url) return null;
  // Data URLs (base64) y URLs externas se devuelven tal cual
  return url;
};

/** Reduce una imagen (src o data URL) a JPEG de máx. 700 px: entra cómoda en un documento de Firestore */
export function compressImageSrc(src: string, max = 700, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height) {
        if (width > max) { height = Math.round(height * max / width); width = max; }
      } else if (height > max) {
        width = Math.round(width * max / height); height = max;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = src;
  });
}

export async function compressImageToBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return compressImageSrc(dataUrl);
}

/**
 * Identificador de semana ISO (lunes a domingo), p. ej. "2026-W44".
 * Antes se usaba "yyyy-'W'ww": del 27 al 31/12/2026 daba "2026-W01" y esas
 * compras se sumaban a la primera semana de enero de 2026.
 */
export const weekId = (date: Date) => format(date, "RRRR-'W'II")

/**
 * Formatea un número como moneda ARS ($ 1.500)
 */
export const formatPrecio = (valor: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor)

/** Unidades oficiales (las mismas que pide el prompt de recetas) */
export const UNIDADES = ["g", "kg", "ml", "l", "unidad", "cucharada", "cucharadita", "taza", "docena"] as const

/**
 * Normaliza nombres de unidades a estándares internos
 */
export function normalizarUnidad(unidad: string): string {
  const map: Record<string, string> = {
    'g': 'g', 'gr': 'g', 'grs': 'g', 'gramo': 'g', 'gramos': 'g',
    'kg': 'kg', 'kilo': 'kg', 'kilos': 'kg', 'kilogramo': 'kg', 'kilogramos': 'kg',
    'ml': 'ml', 'mililitro': 'ml', 'mililitros': 'ml', 'cc': 'ml',
    'l': 'l', 'lt': 'l', 'litro': 'l', 'litros': 'l',
    'unid': 'unidad', 'unidad': 'unidad', 'unidades': 'unidad', 'u': 'unidad',
    // Piezas sueltas: un diente de ajo, un tallo de verdeo, una hoja de laurel
    'diente': 'unidad', 'dientes': 'unidad', 'tallo': 'unidad', 'tallos': 'unidad', 'hoja': 'unidad', 'hojas': 'unidad',
    'cucharada': 'cucharada', 'cucharadas': 'cucharada', 'cda': 'cucharada', 'cdas': 'cucharada',
    'cucharadita': 'cucharadita', 'cucharaditas': 'cucharadita', 'cdta': 'cucharadita', 'cdtas': 'cucharadita',
    'taza': 'taza', 'tazas': 'taza',
    'docena': 'docena', 'docenas': 'docena', 'doz': 'docena'
  };
  return map[(unidad || "").toLowerCase().trim()] || (unidad || "unid").toLowerCase().trim();
}

const sinTildes = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")

// Peso aproximado de una unidad (g). El orden importa: lo más específico primero.
const PESO_UNIDAD: [RegExp, number][] = [
  [/\bajo\b(?! en polvo)/, 5], [/cebolla larga|verdeo|cebolla de verdeo/, 40], [/\bcebolla\b(?! en polvo)/, 150],
  [/\bbatata/, 250], [/\bpapa/, 200], [/tomate cherry/, 15], [/tomate perita/, 80], [/\btomate\b(?!.*(pure|salsa|triturado))/, 150],
  [/zanahoria/, 100], [/\bhuevo/, 55], [/morron|pimiento/, 180], [/\blimon/, 100], [/\blima\b/, 60],
  [/manzana/, 180], [/banana/, 120], [/\bpera\b/, 180], [/palta|aguacate/, 200], [/platano/, 250],
  [/choclo/, 250], [/chorizo(?! .*bife)/, 100], [/jalapeno|\bchile\b/, 15], [/laurel/, 0.2], [/clavo de olor/, 0.1],
  [/anis estrellado/, 0.3], [/canela en rama/, 3], [/caldo .*cubo|cubo de caldo/, 10], [/tortilla/, 40], [/arepa/, 120],
  [/zapallito/, 200], [/berenjena/, 250], [/pepino/, 200], [/naranja/, 200], [/durazno/, 150], [/salchicha/, 50],
]
// Densidad aproximada (g por ml) para pasar cucharadas y tazas a peso
const DENSIDAD: [RegExp, number][] = [
  [/harina/, 0.55], [/avena/, 0.4], [/arroz/, 0.8], [/azucar/, 0.85], [/\bsal\b/, 1.2], [/aceite/, 0.92],
  [/en polvo|molid|pimienta|pimenton|comino|canela|oregano|aji|curry|paprika/, 0.5],
]
const buscar = (tabla: [RegExp, number][], nombre: string) => tabla.find(([re]) => re.test(sinTildes(nombre)))?.[1]

const BASE: Record<string, { tipo: 'peso' | 'volumen' | 'unidad'; factor: number }> = {
  g: { tipo: 'peso', factor: 1 }, kg: { tipo: 'peso', factor: 1000 },
  ml: { tipo: 'volumen', factor: 1 }, l: { tipo: 'volumen', factor: 1000 },
  cucharadita: { tipo: 'volumen', factor: 5 }, cucharada: { tipo: 'volumen', factor: 15 }, taza: { tipo: 'volumen', factor: 250 },
  unidad: { tipo: 'unidad', factor: 1 }, docena: { tipo: 'unidad', factor: 12 },
}

/**
 * Convierte una cantidad de una unidad a otra. Con el nombre del ingrediente también
 * convierte entre familias: 2 dientes de ajo → 10 g, 1 taza de arroz → 200 g.
 * Si no hay forma de convertir, devuelve la cantidad sin cambios.
 */
export function convertirCantidad(cantidad: number, desde: string, hacia: string, nombre = ""): number {
  const d = BASE[normalizarUnidad(desde)];
  const h = BASE[normalizarUnidad(hacia)];
  if (!d || !h || normalizarUnidad(desde) === normalizarUnidad(hacia)) return cantidad;

  const base = cantidad * d.factor; // en g, ml o unidades
  if (d.tipo === h.tipo) return base / h.factor;

  const densidad = buscar(DENSIDAD, nombre) ?? 1;
  const pesoUnidad = buscar(PESO_UNIDAD, nombre);
  let gramos: number | undefined;
  if (d.tipo === 'peso') gramos = base;
  else if (d.tipo === 'volumen') gramos = base * densidad;
  else if (pesoUnidad) gramos = base * pesoUnidad;
  if (gramos === undefined) return cantidad;

  if (h.tipo === 'peso') return gramos / h.factor;
  if (h.tipo === 'volumen') return gramos / densidad / h.factor;
  return pesoUnidad ? gramos / pesoUnidad / h.factor : cantidad;
}

/**
 * Sugiere una unidad lógica basada en la cantidad y el tipo de producto
 */
export function sugerirUnidadLogica(nombre: string, cantidad: number, unidadActual: string): { cantidad: number, unidad: string } {
  const u = normalizarUnidad(unidadActual);
  const n = (nombre || "").toLowerCase();

  // Productos que lógicamente deberían estar en KG si superan un umbral o por naturaleza
  const esPesado = /arroz|harina|azucar|papa|patata|cebolla|carne|pollo|cerdo|legumbre|lenteja|pan/.test(n);

  if (u === 'g') {
    if (cantidad >= 1000 || (esPesado && cantidad >= 500)) {
      return { cantidad: cantidad / 1000, unidad: 'kg' };
    }
  }
  if (u === 'ml' && cantidad >= 1000) {
    return { cantidad: cantidad / 1000, unidad: 'l' };
  }

  return { cantidad, unidad: u };
}

/**
 * Lógica de conversión de unidades para el cálculo de costos
 */
export function calcularCostoIngrediente(
  cantidad: number,
  unidadReceta: string,
  precioUnitario: number,
  unidadPrecio: string,
  nombre = ""
): number {
  if (!precioUnitario) return 0;
  
  // Convertimos la cantidad de la receta a la unidad en la que está expresado el precio
  const cantidadEnUnidadPrecio = convertirCantidad(cantidad, unidadReceta, unidadPrecio, nombre);
  return cantidadEnUnidadPrecio * precioUnitario;
}

/**
 * Calcula el precio por una unidad base del ingrediente a partir de un precio de compra
 * @param precioPagado El monto pagado (ej: 1500)
 * @param cantidadComprada La cantidad obtenida (ej: 500)
 * @param unidadCompra La unidad de esa cantidad (ej: 'g')
 * @param unidadBase La unidad base del ingrediente en el sistema (ej: 'kg')
 */
export function calcularPrecioUnitarioBase(
  precioPagado: number,
  cantidadComprada: number,
  unidadCompra: string,
  unidadBase: string
): number {
  if (!precioPagado || !cantidadComprada) return 0;
  
  // Convertimos la cantidad comprada a la unidad base
  const cantidadEnUnidadBase = convertirCantidad(cantidadComprada, unidadCompra, unidadBase);
  
  // Si la cantidad en base es 0 para evitar division por cero
  if (cantidadEnUnidadBase === 0) return 0;

  // Precio por 1 unidad base = Total / Cantidad en base
  return precioPagado / cantidadEnUnidadBase;
}
