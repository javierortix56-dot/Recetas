/**
 * @fileOverview Utilidad para categorizar y normalizar ingredientes automáticamente basándose en las nuevas reglas estrictas.
 */

// Nombres que se unifican siempre (solo coincidencia exacta: "Salvia" o "Salchicha" ya no pasan a "Sal Fina")
const NOMBRES_FIJOS: [RegExp, string][] = [
  [/^sal( fina| de mesa| comun| entrefina)?$/, 'Sal Fina'],
  [/^pimienta( negra)?( molida| recien molida| en grano)?$/, 'Pimienta Negra'],
  [/^aceite( de girasol| vegetal| neutro| de maiz)?$/, 'Aceite de Girasol'],
  [/^azucar( blanca| comun| refinada)?$/, 'Azúcar'],
  [/^agua( mineral| potable| fria| tibia| caliente| natural)?$/, 'Agua'],
  [/^(ajo|ajo fresco|diente de ajo|dientes de ajo|cabeza de ajo)$/, 'Ajo'],
]

export function normalizeIngredientName(nombre: string): string {
  if (!nombre) return "";
  const limpio = nombre.trim().replace(/\s+/g, ' ');
  const n = limpio.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

  if (/^aceite de oliva( extra ?virgen)?$/.test(n)) return 'Aceite de Oliva';
  for (const [re, fijo] of NOMBRES_FIJOS) if (fijo && re.test(n)) return fijo;

  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

export type IngredientCategory = 
  | 'Lácteos y Huevos'
  | 'Carnes y Aves'
  | 'Pescados y Mariscos'
  | 'Frutas y Verduras'
  | 'Almacén'
  | 'Especias y Condimentos'
  | 'Bebidas'
  | 'Otros';

/** Palabras completas, sin tildes y con plural opcional: "res" ya no coincide con "fresca" */
const words = (list: string) => new RegExp(`\\b(?:${list})(?:es|s)?\\b`)
const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()

// Envasados y secos: van antes que el resto ("Leche de coco", "Ravioles de queso", "Caldo de carne")
const ALMACEN = words('pure|salsa|caldo|leche de coco|mantequilla de mani|pasta|espagueti|fideo|raviol|noqui|tortilla|totopo|harina|pan|arepa|galleta|conserva|lata|mermelada|polvo para hornear|polvo de hornear|bicarbonato|levadura|proteina|whey|avena|arroz|azucar|aceite|vinagre|miel|cacao|chocolate|maicena|mayonesa|mostaza|ketchup|aderezo|frijol|poroto|lenteja|garbanzo|alcaparra|aceituna|quinoa|vainilla|esencia|extracto|soja|cuscus|polenta')
const BEBIDAS = words('agua|jugo|vino|cerveza|gaseosa|soda|te|cafe|sidra|espumante|fernet|vermut|licor|ron|whisky')
const ESPECIAS = words('sal|pimienta|oregano|comino|pimenton|paprika|curry|garam masala|especia|condimento|nuez moscada|clavo de olor|canela|laurel|achiote|aji molido|anis|anis estrellado|cardamomo|azafran|guasca|ajo en polvo|cebolla en polvo|jengibre en polvo|hierbas de provenza|provenzal')
// Fresco frente a seco: "Jengibre" es verdura, "Jengibre en polvo" es especia
const FORMA_SECA = /\b(en polvo|molid[oa]s?|sec[oa]s?|en rama|en hebras|deshidratad[oa]s?|en hojuelas|hojuelas)\b/
const CARNES = words('pollo|pechuga|muslo|pata muslo|ala|carne|vacuno|res|cerdo|tocino|bacon|panceta|jamon|salchicha|chorizo|pavo|cordero|lomo|solomillo|costilla|milanesa|bife|peceto|cuadril|nalga|asado|vacio|matambre|bondiola|osobuco|roast beef|entrana|colita|tapa de asado|morcilla|hamburguesa')
const PESCADOS = words('pescado|atun|salmon|camaron|langostino|merluza|marisco|corvina|trucha|bacalao|calamar|pulpo|mejillon|almeja|tilapia|abadejo|lenguado|sardina|anchoa|kani')
const LACTEOS = words('leche|queso|yogur|yogurt|crema|crema de leche|manteca|nata|ricota|mozzarella|muzzarella|parmesano|reggianito|cheddar|huevo|provoleta|cremoso|tybo|danbo|gouda|dulce de leche|queso crema')
const FRUTAS_VERDURAS = words('albahaca|perejil|cilantro|romero|tomillo|menta|ciboulette|verdeo|cebollino|eneldo|salvia|cebolla|ajo|tomate|zanahoria|papa|batata|espinaca|lechuga|pimiento|morron|chile|jalapeno|zapallo|zapallito|calabaza|brocoli|coliflor|apio|puerro|pepino|berenjena|choclo|maiz|arveja|acelga|repollo|rucula|champinon|hongo|girgola|remolacha|rabanito|nabo|chaucha|palta|aguacate|yuca|mandioca|platano|jengibre|manzana|banana|naranja|limon|lima|mandarina|pomelo|fresa|frutilla|uva|pera|durazno|mango|anana|pina|sandia|melon|kiwi|ciruela|cereza|coco|arandano|mora|frambuesa|higo|datil')

export function categorizeIngredient(nombre: string): IngredientCategory {
  const n = strip(nombre);
  if (ALMACEN.test(n)) return 'Almacén';
  if (/\bjugo de (limon|lima|naranja|pomelo)\b/.test(n)) return 'Frutas y Verduras';
  if (BEBIDAS.test(n)) return 'Bebidas';
  if (ESPECIAS.test(n) || (FORMA_SECA.test(n) && FRUTAS_VERDURAS.test(n))) return 'Especias y Condimentos';
  if (PESCADOS.test(n)) return 'Pescados y Mariscos';
  if (CARNES.test(n)) return 'Carnes y Aves';
  if (LACTEOS.test(n)) return 'Lácteos y Huevos';
  if (FRUTAS_VERDURAS.test(n)) return 'Frutas y Verduras';
  return 'Otros';
}

export const INGREDIENT_CATEGORIES: IngredientCategory[] = [
  'Lácteos y Huevos', 'Carnes y Aves', 'Pescados y Mariscos', 'Frutas y Verduras',
  'Almacén', 'Especias y Condimentos', 'Bebidas', 'Otros',
];

/**
 * Lleva categorías viejas o sueltas ("Carnes", "Verduras", "Lácteos") a las 8 oficiales.
 * Una categoría oficial ya elegida se respeta, salvo con preferAuto (limpieza de datos).
 */
export function canonicalCategory(categoria: string | undefined, nombre: string, preferAuto = false): IngredientCategory {
  const valid = INGREDIENT_CATEGORIES.includes(categoria as IngredientCategory) && categoria !== 'Otros';
  if (valid && !preferAuto) return categoria as IngredientCategory;
  const auto = categorizeIngredient(nombre);
  if (auto !== 'Otros') return auto;
  if (INGREDIENT_CATEGORIES.includes(categoria as IngredientCategory)) return categoria as IngredientCategory;
  const c = strip(categoria || '');
  if (/carne|ave|pollo/.test(c)) return 'Carnes y Aves';
  if (/pescado|marisco/.test(c)) return 'Pescados y Mariscos';
  if (/lacteo|huevo/.test(c)) return 'Lácteos y Huevos';
  if (/fruta|verdura/.test(c)) return 'Frutas y Verduras';
  if (/especia|condimento/.test(c)) return 'Especias y Condimentos';
  if (/bebida/.test(c)) return 'Bebidas';
  if (/almacen/.test(c)) return 'Almacén';
  return 'Otros';
}

export function isSubPreparation(nombre: string): boolean {
  return /sofrito|hogao|salsa casera|roux|marinada|fondo de|caldo casero|masa casera|aliño/i.test(nombre);
}
