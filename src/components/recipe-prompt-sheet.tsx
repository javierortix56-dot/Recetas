"use client"

import * as React from "react"
import { Bot, Copy, Check, Download, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet"
import { toast } from "@/hooks/use-toast"

const PROMPT_TEMPLATE = `Generame una lista de recetas (pueden ser una o varias) en formato JSON.
Si son varias, devolvelas dentro de un array [{}, {}].

REGLAS ESTRICTAS — seguirlas sin excepción:

━━━ DESCRIPCIÓN ━━━
- 2-3 oraciones que describan el plato, su sabor, textura y ocasión ideal.

━━━ MOMENTOS ━━━
- El campo "categorias" debe ser un array con uno o varios de:
  Desayuno | Almuerzo | Cena | Merienda | Postre | Snack

━━━ INGREDIENTES ━━━
- Listar SOLO ingredientes crudos tal como se compran en el supermercado.
- NUNCA usar como ingrediente una subpreparación como "sofrito", "salsa", etc.
- El campo "categoria" debe ser exactamente uno de:
  Lácteos | Carnes | Verduras | Frutas | Almacén | Bebidas | Otros

━━━ PASOS ━━━
- Cada paso debe ser ejecutable por alguien que nunca cocinó.
- timerSegundos: número si hay tiempo de espera, null si es acción activa.

━━━ MACROS ━━━
- Calcular con precisión nutricional real POR PORCIÓN INDIVIDUAL.
- Incluir: calorías (kcal), proteínas (g), carbohidratos (g), grasas (g), fibra (g), azúcar (g), sodio (mg).

━━━ TAGS ━━━
- Incluir entre 6 y 12 tags descriptivos (cocina, dieta, ocasión, técnica, tiempo).

━━━ FORMATO ━━━
- Respondé SOLO con JSON válido (objeto único o array de objetos).

{
  "nombre": "",
  "descripcion": "",
  "categorias": ["Almuerzo", "Cena"],
  "porciones": 0,
  "tiempoPreparacion": 0,
  "tiempoCoccion": 0,
  "dificultad": "Fácil|Media|Difícil",
  "ingredientes": [{"nombre":"", "cantidad":0, "unidad":"", "preparacion":"", "categoria":""}],
  "pasos": [{"orden":1, "titulo":"", "descripcion":"", "timerSegundos":null}],
  "macros": {"calorias":0, "proteinas":0, "carbohidratos":0, "grasas":0, "fibra":0, "azucar":0, "sodio":0},
  "tags": [""]
}`

export function RecipePromptSheet({ onOpenImport }: { onOpenImport: () => void }) {
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
        <Button variant="ghost" size="icon" className="rounded-full bg-accent/10 text-accent">
          <Bot className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-[2rem] p-6 max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left font-black text-primary text-2xl flex items-center gap-2">
            <Bot className="h-6 w-6 text-accent" />
            Generá con IA
          </SheetTitle>
          <SheetDescription className="text-left text-xs font-bold text-muted-foreground uppercase tracking-widest pt-2">
            Copiá este prompt para obtener colecciones de recetas con tags y macros precisos.
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
            <p className="text-[10px] font-bold text-primary/80 leading-relaxed uppercase tracking-wider">
              Podés pedirle a la IA: "Dame 5 recetas de pollo" y pegar el resultado completo. El sistema las separará automáticamente.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
