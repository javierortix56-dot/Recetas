/**
 * @fileOverview Utilidad para categorizar y normalizar ingredientes automáticamente basándose en las nuevas reglas estrictas.
 */

export function normalizeIngredientName(nombre: string): string {
  if (!nombre) return "";
  const n = nombre.toLowerCase().trim();

  // Regla de Sal: Todo lo que sea sal -> Sal Fina
  if (n.includes('sal') && !n.includes('salsa') && !n.includes('salmón') && !n.includes('salmon')) {
    return 'Sal Fina';
  }

  if (n.includes('pimienta')) return 'Pimienta Negra';
  if (n.includes('aceite de oliva')) return 'Aceite de Oliva';
  if (n.includes('aceite') && !n.includes('oliva') && !n.includes('aceituna')) return 'Aceite de Girasol';
  if (n.includes('azúcar') || n.includes('azucar')) return 'Azúcar';
  if (n === 'agua' || n.includes('agua mineral')) return 'Agua';
  if (n.includes('ajo') && !n.includes('ajonjolí')) return 'Ajo';

  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
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

export function categorizeIngredient(nombre: string): IngredientCategory {
  const n = nombre.toLowerCase().trim();

  // 1. ESPECIAS Y CONDIMENTOS (Prioridad para evitar confusión con Almacén)
  if (/sal|pimienta|orégano|oregano|comino|pimentón|curry|especias|condimento|jengibre|nuez moscada|clavo|canela|laurel|tomillo|romero fresco|albahaca seca/.test(n))
    return 'Especias y Condimentos';

  // 2. FRUTAS Y VERDURAS
  if (/albahaca|perejil|cilantro|romero|tomillo|menta|ciboulette|verdeo|cebollino|eneldo|salvia|cebolla|ajo|tomate|zanahoria|papa|patata|espinaca|lechuga|pimiento|morron|ají|zapallo|calabaza|brócoli|coliflor|apio|puerro|pepino|berenjena|choclo|maíz|arveja|poroto|frijol|lenteja|garbanzo|acelga|repollo|rúcula|champiñon|hongo|gírgola|batata|remolacha|rabanito|nabo|chaucha|palta|aguacate|manzana|banana|naranja|limón|limon|fresa|frutilla|uva|pera|durazno|mango|piña|sandía|melón|kiwi|ciruela|cereza|coco|arándano|mora|frambuesa|higo|dátil/.test(n))
    return 'Frutas y Verduras';

  // 3. LÁCTEOS Y HUEVOS
  if (/leche|queso|yogur|crema|manteca|mantequilla|nata|ricota|mozzarella|parmesano|cheddar|huevo|provoleta|reggianito|cremoso|tybo|danbo|gouda/.test(n))
    return 'Lácteos y Huevos';

  // 4. CARNES Y AVES
  if (/pollo|pechuga|muslo|carne|res|vacuno|cerdo|tocino|bacon|jamón|salchicha|chorizo|pavo|cordero|lomo|costilla|milanesa|bife|peceto|cuadril|bola de lomo|nalga|asado|vacio|matambre|bondiola|panceta/.test(n))
    return 'Carnes y Aves';

  // 5. PESCADOS Y MARISCOS
  if (/pescado|atún|salmón|camarón|langostino|merluza|marisco|corvina|trucha|bacalao|calamar|pulpo|mejillón|almeja/.test(n))
    return 'Pescados y Mariscos';

  // 6. BEBIDAS
  if (/agua|jugo|vino|cerveza|leche vegetal|caldo|té|cafe|café|gaseosa|bebida|soda|sifón|fernet|aperitivo|espumante|sidra/.test(n))
    return 'Bebidas';

  // 7. ALMACÉN (Secos, harinas, legumbres, conservas, aceites)
  if (/arroz|harina|azúcar|azucar|aceite|pasta|fideos|pan|galleta|avena|quinoa|maicena|levadura|polvo de hornear|bicarbonato|vinagre|soja|mostaza|mayonesa|ketchup|miel|mermelada|chocolate|cacao|whey|proteina|extracto|esencia|vainilla|aderezo|conserva|lata/.test(n))
    return 'Almacén';

  return 'Otros';
}

export function isSubPreparation(nombre: string): boolean {
  return /sofrito|hogao|salsa casera|roux|marinada|fondo de|caldo casero|masa casera|aliño/i.test(nombre);
}
