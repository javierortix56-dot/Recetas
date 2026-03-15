/**
 * @fileOverview Utilidad para categorizar y normalizar ingredientes automáticamente.
 */

export function normalizeIngredientName(nombre: string): string {
  if (!nombre) return "";
  const n = nombre.toLowerCase().trim();

  // Regla de Sal: Todo lo que sea sal -> Sal Fina
  if (n.includes('sal') && !n.includes('salsa') && !n.includes('salmón') && !n.includes('salmon')) {
    return 'Sal Fina';
  }

  // Otros básicos comunes para evitar duplicados
  if (n.includes('pimienta')) return 'Pimienta';
  if (n.includes('aceite') && !n.includes('aceituna')) return 'Aceite';
  if (n.includes('azúcar') || n.includes('azucar')) return 'Azúcar';
  if (n === 'agua' || n.includes('agua mineral')) return 'Agua';
  if (n.includes('ajo') && !n.includes('ajonjolí')) return 'Ajo';

  // Devolver con la primera letra en mayúscula para consistencia
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

export function categorizeIngredient(nombre: string): string {
  const n = nombre.toLowerCase().trim();

  // 1. VERDURAS Y HIERBAS FRESCAS (Prioridad para frescos)
  if (/albahaca|perejil|cilantro|romero|tomillo|laurel|orégano fresco|menta|ciboulette|verdeo|cebollino|eneldo|salvia|cebolla|ajo|tomate|zanahoria|papa|patata|espinaca|lechuga|pimiento|morron|ají|zapallo|calabaza|brócoli|coliflor|apio|puerro|pepino|berenjena|choclo|maíz|arveja|poroto|frijol|lenteja|garbanzo|acelga|repollo|rúcula|champiñon|hongo|gírgola|batata|remolacha|rabanito|nabo|chaucha|palta|aguacate/.test(n))
    return 'Verduras';

  // 2. LÁCTEOS Y HUEVOS
  if (/leche|queso|yogur|crema|manteca|mantequilla|nata|ricota|mozzarella|parmesano|cheddar|huevo|rebozado|provoleta|reggianito|cremoso|tybo|danbo|gouda/.test(n))
    return 'Lácteos';

  // 3. CARNES Y EMBUTIDOS
  if (/pollo|pechuga|muslo|carne|res|vacuno|cerdo|tocino|bacon|jamón|salchicha|chorizo|pescado|atún|salmón|camarón|langostino|pavo|cordero|lomo|costilla|milanesa|bife|peceto|cuadril|bola de lomo|nalga|asado|vacio|matambre|merluza|marisco|bondiola|panceta/.test(n))
    return 'Carnes';

  // 4. FRUTAS
  if (/manzana|banana|naranja|limón|limon|fresa|frutilla|uva|pera|durazno|mango|piña|sandía|melón|kiwi|ciruela|cereza|coco|arándano|mora|frambuesa|higo|dátil|nuez|almendra|castaña|mani|maní/.test(n))
    return 'Frutas';

  // 5. BEBIDAS
  if (/agua|jugo|vino|cerveza|leche vegetal|caldo|té|cafe|café|gaseosa|bebida|soda|sifón|fernet|aperitivo|espumante|sidra/.test(n))
    return 'Bebidas';

  // 6. ALMACÉN (Secos, condimentos, aceites, panadería)
  if (/arroz|harina|azúcar|sal|aceite|pasta|fideos|pan|galleta|avena|quinoa|maicena|levadura|polvo de hornear|bicarbonato|vinagre|soja|mostaza|mayonesa|ketchup|pimienta|comino|pimentón|canela|curry|especias|condimento|jengibre|nuez moscada|clavo|miel|mermelada|chocolate|cacao|whey|proteina|suplemento|extracto|esencia|vainilla|aderezo|caldo en cubos|salsa/.test(n))
    return 'Almacén';

  return 'Otros';
}

export function isSubPreparation(nombre: string): boolean {
  // Detecta si es un ingrediente que en realidad es una receta ya hecha (sofrito, salsa casera, etc.)
  return /sofrito|hogao|salsa casera|roux|marinada|fondo de|caldo casero|masa casera|aliño/i.test(nombre);
}
