"use client"

import * as React from "react"
import { Bot, Copy, Check, Download, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"

const PROMPT_TEMPLATE = `Generame recetas en formato JSON. Una sola receta = objeto {}. Varias = array [{}, {}].

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
- "preparacion": cómo preparar el ingrediente ANTES de usarlo. Especificar el corte exacto: brunoise (cubos 3-5mm), juliana (tiras 3mm × 5cm), pluma (media luna fina), rodajas (grosor en mm), chiffonade, rallado grueso/fino. Dejar "" si se usa sin preparación previa.
- "categoria": EXACTAMENTE una de:
  "Lácteos y Huevos" | "Carnes y Aves" | "Pescados y Mariscos" | "Frutas y Verduras" | "Almacén" | "Especias y Condimentos" | "Bebidas" | "Otros"

━━━ UTENSILIOS ━━━
- Ser EXHAUSTIVO. Incluir absolutamente todos los elementos necesarios:
  tabla de picar, tipo exacto de cuchillo (de chef 20cm, de sierra, pelador), tipo y tamaño de sartén/olla (ej: "Sartén antiadherente 28cm", "Olla 4 litros"), bowls, coladores, espátulas, pinzas, fuentes para horno, papel aluminio, papel manteca, batidores, moldes, etc.
- Mínimo 5 utensilios por receta. No omitir ninguno aunque parezca obvio.
- Ejemplos: "Cuchillo de chef 20cm", "Tabla de picar grande", "Sartén antiadherente 28cm", "Olla mediana 3L", "Espátula de silicona", "Bowl grande", "Colador", "Papel aluminio".

━━━ PASOS — REGLAS CRÍTICAS ━━━
NUNCA omitir pasos intermedios aunque parezcan obvios. Cada acción es un paso o sub-acción detallada.

CORTES: En todo paso donde se use un cuchillo, indicar el corte exacto con medida aproximada (ej: "cortá la cebolla en brunoise: cubos de 3-4mm"; "laminar el ajo en rodajas de 1-2mm de espesor").

ORDEN DE INGREDIENTES: Cuando se agregan varios ingredientes a una sartén/olla, explicar SIEMPRE cuál va primero y por qué (ej: "primero la cebolla porque necesita más tiempo para ablandarse; 3 minutos después el ajo, que se quema más rápido").

SAL Y CONDIMENTOS: Especificar EXACTAMENTE en qué momento se agrega la sal y cada condimento. Si se sala en varias etapas (agua de cocción, durante el salteo, al final), detallar cada instancia con la cantidad aproximada.

SEÑALES VISUALES Y SENSORIALES: Describir cómo debe verse, oler o sonar el ingrediente en cada etapa (ej: "la cebolla estará lista cuando esté translúcida y ligeramente dorada en los bordes, unos 8-10 minutos"; "el ajo está listo cuando empieza a largar aroma sin tomar color dorado").

UTENSILIOS EN CADA PASO: Mencionar el utensilio específico en cada paso (ej: "con la espátula de silicona", "usando el cuchillo de chef sobre la tabla de picar").

TEMPERATURA: Siempre indicar nivel de fuego (bajo, medio-bajo, medio, medio-alto, alto) y temperatura en °C cuando aplica al horno.

- Mínimo de pasos según dificultad: Fácil = 6, Media = 9, Difícil = 14. NO agrupar acciones distintas en un solo paso.
- "orden": número secuencial empezando en 1.
- "titulo": resumen corto de la acción (ej: "Cortar la cebolla en brunoise", "Sellar la carne a fuego alto").
- "descripcion": instrucción detallada con todo lo anterior. Mínimo 2-3 oraciones por paso.
- "timerSegundos": EN SEGUNDOS. Ej: 5 minutos = 300, 1 hora = 3600. Usar null si el paso es acción activa sin espera.

━━━ TIPS DEL CHEF ━━━
- Exactamente 4 consejos, uno de cada tipo:
  1. TÉCNICA: un truco o secreto para mejorar la ejecución del plato.
  2. SABOR: cómo potenciar el sabor, un sustituto válido de ingrediente o una variación recomendada.
  3. ERROR COMÚN: el error más frecuente al preparar este plato y cómo evitarlo.
  4. CONSERVACIÓN: cómo guardar el plato o los ingredientes sobrantes (temperatura, recipiente, días máximos).

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
  "tips": ["", "", "", ""],
  "macros": {"calorias": 0, "proteinas": 0, "carbohidratos": 0, "grasas": 0, "fibra": 0, "azucar": 0, "sodio": 0, "pesoPorPorcion": 0},
  "tags": [""]
}`

export function RecipePromptSheet({ onOpenImport, asMenuItem }: { onOpenImport: () => void; asMenuItem?: boolean }) {
  const [copied, setCopied] = React.useState(false)
  const [isOpen, setIsOpen] = React.useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(PROMPT_TEMPLATE)
    setCopied(true)
    toast({ title: "Prompt copiado", description: "Pegalo en tu IA favorita." })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {asMenuItem ? (
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setIsOpen(true); }} className="gap-3 font-bold">
            <Bot className="h-4 w-4" /> Prompt IA
          </DropdownMenuItem>
        ) : (
          <Button variant="ghost" size="icon" className="rounded-full bg-accent/10 text-accent">
            <Bot className="h-6 w-6" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-[2rem] p-6 max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left font-black text-primary text-2xl flex items-center gap-2">
            <Bot className="h-6 w-6 text-accent" />
            Prompt Maestro Actualizado
          </SheetTitle>
          <SheetDescription className="text-left text-xs font-bold text-muted-foreground uppercase tracking-widest pt-2">
            Copiá este prompt para obtener recetas con cantidades exactas y utensilios.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 pb-6">
          <div className="bg-muted p-4 rounded-2xl border-2 border-border/50 relative overflow-hidden group">
            <pre className="text-[10px] font-mono whitespace-pre-wrap leading-relaxed text-muted-foreground select-all max-h-48 overflow-y-auto">
              {PROMPT_TEMPLATE}
            </pre>
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-muted to-transparent pointer-events-none" />
          </div>

          <div className="grid gap-3">
            <Button 
              onClick={handleCopy}
              className={`w-full h-14 rounded-2xl font-black uppercase text-xs transition-all ${copied ? 'bg-primary' : 'bg-accent'}`}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" /> ¡Copiado! ✓
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" /> Copiar Prompt Maestro
                </>
              )}
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                setIsOpen(false)
                onOpenImport()
              }}
              className="w-full h-14 rounded-2xl border-2 font-black uppercase text-xs"
            >
              <Download className="h-4 w-4 mr-2" /> Ir a Importar
            </Button>
          </div>

          <div className="flex items-start gap-3 bg-primary-suave p-4 rounded-2xl border border-primary/10">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] font-medium text-primary/80 leading-relaxed">
              El prompt exige: cortes exactos (brunoise, juliana…), orden de vegetales con justificación, cuándo y cuánto salar, señales visuales en cada paso, utensilios con tamaño, y 4 consejos del chef obligatorios.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
