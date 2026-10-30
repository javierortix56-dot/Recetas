/**
 * Tipos y conversiones compartidos entre el servidor (adaptadores de cada
 * supermercado) y el cliente (búsqueda de precios en la despensa).
 */

export type PriceSource = 'coto' | 'carrefour' | 'dia' | 'jumbo' | 'vea' | 'masonline';

export const SOURCE_LABEL: Record<PriceSource, string> = {
  coto: 'Coto',
  carrefour: 'Carrefour',
  dia: 'Día',
  jumbo: 'Jumbo',
  vea: 'Vea',
  masonline: 'ChangoMás',
};

export type SizeUnit = 'g' | 'kg' | 'ml' | 'l' | 'unidad';

export interface PriceOffer {
  source: PriceSource;
  name: string;
  /** Código de barras; las actualizaciones posteriores buscan por este código */
  ean: string | null;
  /** Precio del envase (o del kg/l si se vende suelto), en ARS */
  price: number;
  /** Contenido del envase al que corresponde `price` */
  qty: number;
  unit: SizeUnit;
}

/** Referencia guardada en el ingrediente para volver a consultar el mismo producto */
export interface PriceRef {
  source: PriceSource;
  ean: string | null;
  name: string;
}

const UNIT_ALIASES: Record<string, SizeUnit> = {
  g: 'g', gr: 'g', grs: 'g', gramo: 'g', gramos: 'g',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogramo: 'kg', kilogramos: 'kg',
  ml: 'ml', cc: 'ml', cm3: 'ml', mililitro: 'ml', mililitros: 'ml',
  l: 'l', lt: 'l', lts: 'l', ltr: 'l', ltrs: 'l', litro: 'l', litros: 'l',
  u: 'unidad', un: 'unidad', uni: 'unidad', unid: 'unidad', unidad: 'unidad', unidades: 'unidad',
};

/** "Leche 1 Lt" → 1 l · "Arroz 500 Gr." → 500 g · "Cebolla x kg" → 1 kg. Sin dato → 1 unidad. */
export function parseSize(text: string): { qty: number; unit: SizeUnit } {
  const t = (text || '').toLowerCase();
  if (/\b(x|por|el)\s*(kg|kilo)\b/.test(t)) return { qty: 1, unit: 'kg' };
  const re = /(\d+(?:[.,]\d+)?)\s*(kilogramos|kilogramo|kilos|kilo|kgs|kg|gramos|gramo|grs|gr|g|mililitros|mililitro|ml|cm3|cc|litros|litro|ltrs|ltr|lts|lt|l|unidades|unidad|unid|uni|un|u)\b\.?/g;
  let match: RegExpExecArray | null;
  let last: { qty: number; unit: SizeUnit } | null = null;
  while ((match = re.exec(t))) {
    const qty = parseFloat(match[1].replace(',', '.'));
    if (qty > 0) last = { qty, unit: UNIT_ALIASES[match[2]] };
  }
  if (last) return last;
  // "Huevos blancos x 12" → 12 unidades
  const pack = /\bx\s*(\d+)\b/.exec(t);
  if (pack) return { qty: parseInt(pack[1], 10), unit: 'unidad' };
  return { qty: 1, unit: 'unidad' };
}

export function normalizeUnit(u: string): SizeUnit | null {
  return UNIT_ALIASES[(u || '').toLowerCase().trim().replace(/\.$/, '')] ?? null;
}

const FAMILY: Record<SizeUnit, { family: 'masa' | 'volumen' | 'cantidad'; factor: number }> = {
  g: { family: 'masa', factor: 1 },
  kg: { family: 'masa', factor: 1000 },
  ml: { family: 'volumen', factor: 1 },
  l: { family: 'volumen', factor: 1000 },
  unidad: { family: 'cantidad', factor: 1 },
};

/**
 * Precio por 1 unidad base del ingrediente (p. ej. $/kg si la despensa usa kg).
 * Devuelve null si las unidades no son comparables (un paquete de 500 g no
 * dice cuánto cuesta "1 unidad").
 */
export function pricePerBaseUnit(offer: PriceOffer, baseUnit: string): number | null {
  if (!(offer.qty > 0) || !(offer.price > 0)) return null;
  const from = FAMILY[offer.unit];
  const base = normalizeUnit(baseUnit);
  const to = baseUnit === 'docena' ? { family: 'cantidad' as const, factor: 12 } : base ? FAMILY[base] : null;
  if (!to) return null;
  if (from.family !== to.family) return null;
  const qtyInBase = (offer.qty * from.factor) / to.factor;
  return offer.price / qtyInBase;
}
