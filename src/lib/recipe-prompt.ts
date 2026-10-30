/**
 * Prompt maestro de recetas: es el mismo con el que se cargaron las recetas
 * existentes. Se usa tal cual para que las recetas nuevas salgan igual.
 */
export const PROMPT_TEMPLATE = `Generame recetas en formato JSON. Una sola receta = objeto {}. Varias = array [{}, {}].

REGLAS ESTRICTAS — seguir sin excepción:

━━━ NOMBRE ━━━
- Nombre del plato tal cual se conoce. Sin marcas comerciales.

━━━ DESCRIPCIÓN ━━━
- 2-3 oraciones: sabor, textura, ocasión ideal y origen del plato.

━━━ HISTORIA ━━━
- 1-2 oraciones sobre el origen cultural o anécdota del plato. Si no tiene historia conocida, inventar un dato curioso relacionado con el ingrediente principal.

━━━ MOMENTOS (categorias) ━━━
- Array con uno o varios de estos valores EXACTOS:
  "Desayuno" | "Almuerzo" | "Cena" | "Merienda" | "Postre" | "Snack"

━━━ PORCIONES ━━━
- Número entero entre 2 y 6. Representa porciones para adultos.

━━━ DIFICULTAD ━━━
- "Fácil": menos de 30 min total, sin técnica especial.
- "Media": 30-60 min total o requiere alguna técnica (ej: punto de caramelo, corte juliana).
- "Difícil": más de 60 min o técnicas avanzadas (ej: masa hojaldrada, temperado de chocolate).

━━━ TIEMPOS ━━━
- tiempoPreparacion: minutos de trabajo activo (picar, mezclar, armar).
- tiempoCoccion: minutos de cocción pasiva (horno, hervor, reposo en heladera).
- Ambos son números enteros.

━━━ INGREDIENTES ━━━
- Listar SOLO ingredientes crudos tal como se compran en el supermercado.
- NUNCA poner subpreparaciones ("sofrito", "salsa", "caldo casero"). Descomponer en ingredientes base.
- PROHIBIDO: "c/n", "a gusto", "pizca", "un poco", "al gusto". TODO debe tener cantidad numérica exacta.
- "nombre": sustantivo genérico en singular y minúsculas (ej: "cebolla", "pechuga de pollo", "sal fina"). NUNCA incluir cantidad, tamaño o marca en el nombre.
- "cantidad": número > 0. Puede ser decimal (ej: 0.5).
- "unidad": OBLIGATORIO usar una de estas EXACTAS: "g" | "kg" | "ml" | "l" | "unidad" | "cucharada" | "cucharadita" | "taza" | "docena"
- "preparacion": cómo preparar el ingrediente antes de usarlo (ej: "picada en cubos", "rallado", "en juliana", "a temperatura ambiente"). Dejar "" si se usa tal cual.
- "categoria": EXACTAMENTE una de:
  "Lácteos y Huevos" | "Carnes y Aves" | "Pescados y Mariscos" | "Frutas y Verduras" | "Almacén" | "Especias y Condimentos" | "Bebidas" | "Otros"

━━━ UTENSILIOS ━━━
- Inferir de las técnicas usadas en los pasos. Incluir todos los necesarios.
- Ejemplos: "Sartén antiadherente", "Cuchillo de chef", "Tabla de picar", "Horno", "Batidora eléctrica".

━━━ PASOS ━━━
- Cada paso debe ser ejecutable por alguien que nunca cocinó. Ser explícito con temperaturas, tiempos y señales visuales ("hasta que dore", "cuando burbujee").
- Mínimo de pasos según dificultad: Fácil = 3, Media = 5, Difícil = 7. No agrupar acciones distintas en un solo paso.
- "orden": número secuencial empezando en 1.
- "titulo": resumen corto de la acción (ej: "Preparar la masa", "Sellar la carne").
- "descripcion": instrucción detallada. Mencionar utensilios, fuego (bajo/medio/alto), y qué resultado esperar.
- "timerSegundos": EN SEGUNDOS. Ej: 5 minutos = 300, 1 hora = 3600. Usar null si el paso es acción activa sin espera.

━━━ TIPS DEL CHEF ━━━
- 2-4 consejos prácticos: sustituciones, cómo potenciar sabor, métodos de conservación, errores comunes a evitar.

━━━ MACROS (por porción individual) ━━━
- Calcular con precisión nutricional real considerando las cantidades EXACTAS de todos los ingredientes (incluido aceite, manteca, sal).
- Dividir el total entre el número de porciones.
- calorias: kcal | proteinas: g | carbohidratos: g | grasas: g | fibra: g | azucar: g | sodio: mg
- pesoPorPorcion: peso aproximado en gramos de una porción servida (suma del peso cocido total dividido porciones). Número entero.
- Todos los valores son números, no strings.

━━━ TAGS ━━━
- 6 a 12 tags en minúsculas y sin tildes.
- Ejemplos: "rapido", "alto-en-proteina", "sin-gluten", "vegetariano", "italiana", "horno", "comfort-food", "meal-prep", "economico", "para-ninos", "picante", "sin-lactosa"

━━━ FORMATO DE SALIDA (RFC 8259) ━━━
- SOLO JSON válido. Sin markdown, sin texto fuera del JSON, sin backticks.

{
  "nombre": "",
  "descripcion": "",
  "historia": "",
  "categorias": ["Almuerzo"],
  "porciones": 4,
  "tiempoPreparacion": 0,
  "tiempoCoccion": 0,
  "dificultad": "Fácil|Media|Difícil",
  "ingredientes": [
    {"nombre": "", "cantidad": 0, "unidad": "g", "preparacion": "", "categoria": ""}
  ],
  "utensilios": [""],
  "pasos": [
    {"orden": 1, "titulo": "", "descripcion": "", "timerSegundos": null}
  ],
  "tips": [""],
  "macros": {"calorias": 0, "proteinas": 0, "carbohidratos": 0, "grasas": 0, "fibra": 0, "azucar": 0, "sodio": 0, "pesoPorPorcion": 0},
  "tags": [""]
}`
