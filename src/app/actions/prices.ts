'use server';
import { requireUser } from '@/lib/server-auth';
/**
 * @fileOverview Precios de supermercados para la despensa.
 *
 * Fuentes (todas públicas y sin clave, consultadas en paralelo; si una falla
 * o no tiene el producto, siguen las demás):
 * - Catálogos VTEX: Carrefour, Día, Jumbo, Vea y ChangoMás.
 * - Coto Digital (Endeca, formato JSON): trae además el precio por kg/l.
 *
 * Son los endpoints públicos que usan las propias webs, no APIs con
 * contrato: pueden cambiar sin aviso. Cada adaptador falla en silencio y los
 * pedidos se identifican con un User-Agent propio (sin simular un navegador
 * ni otro sitio). Precios Claros no se consulta por acá: su endpoint web no
 * acepta pedidos de terceros; la vía oficial son los datos abiertos SEPA.
 */

import { parseSize, type PriceOffer, type PriceRef, type PriceSource, type SizeUnit } from '@/lib/prices/types';

const TIMEOUT_MS = 8000;
const UA = 'Mozilla/5.0 (compatible; CocinaFamiliar/1.0)';

const VTEX_STORES: Partial<Record<PriceSource, string>> = {
  carrefour: 'https://www.carrefour.com.ar',
  dia: 'https://diaonline.supermercadosdia.com.ar',
  jumbo: 'https://www.jumbo.com.ar',
  vea: 'https://www.vea.com.ar',
  masonline: 'https://www.masonline.com.ar',
};

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  });
  // VTEX responde 206 (Partial Content) en búsquedas paginadas
  if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── VTEX ─────────────────────────────────────────────────────────────────────

function fromVtex(source: PriceSource, products: any[]): PriceOffer[] {
  const out: PriceOffer[] = [];
  for (const p of products || []) {
    const item = p.items?.[0];
    const offer = item?.sellers?.[0]?.commertialOffer;
    const price = Number(offer?.Price);
    if (!item || !(price > 0) || offer?.AvailableQuantity === 0) continue;
    // Los productos sueltos ("Cebolla x kg.") tienen measurementUnit "kg" y el precio es por kg
    const size = item.measurementUnit === 'kg' && /\bx\s*kg|por\s*kg/i.test(p.productName)
      ? { qty: 1, unit: 'kg' as SizeUnit }
      : parseSize(p.productName);
    out.push({ source, name: p.productName, ean: item.ean || null, price, ...size });
  }
  return out;
}

async function vtexSearch(source: PriceSource, query: string, limit: number): Promise<PriceOffer[]> {
  const base = VTEX_STORES[source]!;
  const data = await getJson(`${base}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(query)}&_from=0&_to=${limit - 1}`);
  return fromVtex(source, data);
}

async function vtexByEan(source: PriceSource, ean: string): Promise<PriceOffer[]> {
  const base = VTEX_STORES[source]!;
  const data = await getJson(`${base}/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${encodeURIComponent(ean)}`);
  return fromVtex(source, data);
}

// ── Coto ─────────────────────────────────────────────────────────────────────

const COTO_FORMAT: Record<string, SizeUnit> = { kilogramo: 'kg', litro: 'l', unidad: 'unidad' };

async function cotoSearch(query: string, limit: number): Promise<PriceOffer[]> {
  const data = await getJson(
    `https://www.coto.com.ar/sitios/cdigi/categoria?_dyncharset=utf-8&Ntt=${encodeURIComponent(query)}&Nrpp=${limit}&format=json`
  );
  const records: any[] = [];
  const walk = (o: any) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== 'object') return;
    if (typeof o['@class'] === 'string' && o['@class'].endsWith('Record') && Array.isArray(o.records) && o.attributes) {
      o.records.forEach((r: any) => r?.attributes && records.push(r.attributes));
      return;
    }
    Object.values(o).forEach(walk);
  };
  walk(data);

  const out: PriceOffer[] = [];
  for (const a of records.slice(0, limit)) {
    const name = a['product.displayName']?.[0];
    const active = Number(a['sku.activePrice']?.[0]);
    if (!name || !(active > 0)) continue;
    const ean = a['product.eanPrincipal']?.[0] || null;
    const format = COTO_FORMAT[(a['product.cFormato']?.[0] || '').trim().toLowerCase()];
    const reference = Number(a['sku.referencePrice']?.[0]);
    // Coto informa el precio por kg o litro (referencePrice); para "Unidad" se usa el envase
    if ((format === 'kg' || format === 'l') && reference > 0) {
      out.push({ source: 'coto', name, ean, price: reference, qty: 1, unit: format });
    } else {
      out.push({ source: 'coto', name, ean, price: active, ...parseSize(name) });
    }
  }
  return out;
}

// ── API pública de la acción ─────────────────────────────────────────────────

const settle = async (tasks: Promise<PriceOffer[]>[]): Promise<PriceOffer[]> =>
  (await Promise.allSettled(tasks)).flatMap(r => (r.status === 'fulfilled' ? r.value : []));

/** Busca un producto por texto en todos los supermercados a la vez */
export async function searchPrices(query: string): Promise<PriceOffer[]> {
  await requireUser();
  const q = (query || '').trim().slice(0, 80);
  if (q.length < 2) return [];
  const perSource = 6;
  return settle([
    ...Object.keys(VTEX_STORES).map(s => vtexSearch(s as PriceSource, q, perSource)),
    cotoSearch(q, perSource),
  ]);
}

/**
 * Vuelve a consultar los productos vinculados a un ingrediente. Busca por
 * código de barras en la misma fuente; Coto no busca por código, así que se
 * busca por nombre y se filtra por código.
 */
export async function refreshPrices(refs: PriceRef[]): Promise<PriceOffer[]> {
  await requireUser();
  const tasks = (refs || []).slice(0, 12).map(async (ref): Promise<PriceOffer[]> => {
    if (ref.source === 'coto') {
      const found = await cotoSearch(ref.name, 12);
      return found.filter(o => (ref.ean ? o.ean === ref.ean : o.name === ref.name)).slice(0, 1);
    }
    if (VTEX_STORES[ref.source]) {
      const found = ref.ean ? await vtexByEan(ref.source, ref.ean) : await vtexSearch(ref.source, ref.name, 6);
      return found.filter(o => (ref.ean ? o.ean === ref.ean : o.name === ref.name)).slice(0, 1);
    }
    return [];
  });
  return settle(tasks);
}
