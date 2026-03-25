import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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

export async function compressImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 700;
        let { width, height } = img;
        if (width > height) {
          if (width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
        } else {
          if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

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
    'docena': 'docena', 'doz': 'docena'
  };
  return map[(unidad || "").toLowerCase().trim()] || (unidad || "unid").toLowerCase().trim();
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
 * Convierte una cantidad de una unidad a otra (para cálculos de peso y volumen)
 */
export function convertirCantidad(cantidad: number, desde: string, hacia: string): number {
  const d = normalizarUnidad(desde);
  const h = normalizarUnidad(hacia);
  
  if (!d || !h || d === h) return cantidad;

  // Peso: g <-> kg
  if (d === 'g' && h === 'kg') return cantidad / 1000;
  if (d === 'kg' && h === 'g') return cantidad * 1000;

  // Volumen: ml <-> l
  if (d === 'ml' && h === 'l') return cantidad / 1000;
  if (d === 'l' && h === 'ml') return cantidad * 1000;

  // Unidades / Docena
  if (d === 'docena' && h === 'unidad') return cantidad * 12;
  if (d === 'unidad' && h === 'docena') return cantidad / 12;

  // Cocina (aproximados estándar)
  if (d === 'taza' && h === 'g') return cantidad * 200;
  if (d === 'cucharada' && h === 'g') return cantidad * 15;
  if (d === 'taza' && h === 'ml') return cantidad * 250;

  return cantidad; 
}

/**
 * Lógica de conversión de unidades para el cálculo de costos
 */
export function calcularCostoIngrediente(
  cantidad: number,
  unidadReceta: string,
  precioUnitario: number,
  unidadPrecio: string
): number {
  if (!precioUnitario) return 0;
  
  // Convertimos la cantidad de la receta a la unidad en la que está expresado el precio
  const cantidadEnUnidadPrecio = convertirCantidad(cantidad, unidadReceta, unidadPrecio);
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
