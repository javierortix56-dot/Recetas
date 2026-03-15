"use client"

import * as React from "react"
import { Download, AlertCircle, CheckCircle2, Copy } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { useFirestore } from "@/firebase"
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { USER_ID } from "@/lib/constants"
import { categorizeIngredient, normalizeIngredientName } from "@/lib/categorizeIngredient"

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

export function RecipeImportModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const db = useFirestore()
  const [jsonText, setJsonText] = React.useState("")
  const [isValid, setIsValid] = React.useState<boolean | null>(null)
  const [errors, setErrors] = React.useState<string[]>([])
  const [isImporting, setIsImporting] = React.useState(false)
  const [importCount, setImportCount] = React.useState(0)

  const validateJson = (text: string) => {
    setJsonText(text)
    if (!text.trim()) {
      setIsValid(null)
      setErrors([])
      setImportCount(0)
      return
    }

    try {
      const parsed = JSON.parse(text)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      const requiredFields = ["nombre", "descripcion", "porciones", "ingredientes", "pasos", "macros"]
      
      const newErrors: string[] = []
      items.forEach((item, index) => {
        const hasLegacy = !!item.categoria;
        const hasNew = !!item.categorias;
        if (!hasLegacy && !hasNew) {
          newErrors.push(`Receta ${index + 1}: Falta campo de categoría/momentos.`)
        }
        const missing = requiredFields.filter(f => !item[f])
        if (missing.length > 0) {
          newErrors.push(`Receta ${index + 1}: Faltan campos (${missing.join(", ")})`)
        }
      })

      if (newErrors.length > 0) {
        setIsValid(false)
        setErrors(newErrors)
        setImportCount(0)
      } else {
        setIsValid(true)
        setErrors([])
        setImportCount(items.length)
      }
    } catch (e) {
      setIsValid(false)
      setErrors(["JSON no válido. Revisá los corchetes y comillas."])
      setImportCount(0)
    }
  }

  const handleImport = async () => {
    if (!isValid || !db) return
    setIsImporting(true)
    try {
      const parsed = JSON.parse(jsonText)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      
      const ingredientsCol = collection(db, "users", USER_ID, "ingredients")
      const recipesCol = collection(db, "users", USER_ID, "recipes")

      let firstRecipeId = ""

      for (const recipeData of items) {
        let rawCats = recipeData.categorias || recipeData.categoria || ["Almuerzo"];
        const categorias = Array.isArray(rawCats) ? rawCats : [rawCats];
        recipeData.categorias = categorias;
        recipeData.categoria = categorias[0];

        recipeData.ingredientes = (recipeData.ingredientes || []).map((ing: any) => {
          const normalizedName = normalizeIngredientName(ing.nombre);
          return {
            ...ing,
            nombre: normalizedName,
            categoria: (!ing.categoria || ing.categoria === 'Almacén' || ing.categoria === 'Otros') 
              ? categorizeIngredient(normalizedName) 
              : ing.categoria
          }
        });

        recipeData.fotoURL = null
        recipeData.userId = USER_ID
        recipeData.createdAt = serverTimestamp()
        recipeData.updatedAt = serverTimestamp()

        const docRef = await addDoc(recipesCol, recipeData)
        if (!firstRecipeId) firstRecipeId = docRef.id

        for (const ing of recipeData.ingredientes || []) {
          if (!ing.nombre) continue;
          const normalizedName = normalizeIngredientName(ing.nombre);
          const q = query(ingredientsCol, where("nombre", "==", normalizedName))
          const snap = await getDocs(q)
          
          if (snap.empty) {
            await addDoc(ingredientsCol, {
              nombre: normalizedName,
              categoria: ing.categoria || categorizeIngredient(normalizedName),
              unidad: ing.unidad || "unidad",
              stockActual: 0,
              stockMinimo: 0, 
              userId: USER_ID,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            })
          }
        }
      }

      toast({ 
        title: "¡Importación exitosa!", 
        description: `Se han guardado ${items.length} recetas correctamente.` 
      })
      onOpenChange(false)
      if (items.length === 1 && firstRecipeId) {
        router.push(`/recetas/${firstRecipeId}`)
      } else {
        router.push("/recetas")
      }
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar las recetas." })
    } finally {
      setIsImporting(false)
    }
  }

  const copyPrompt = () => {
    navigator.clipboard.writeText(PROMPT_TEMPLATE)
    toast({ title: "Prompt copiado", description: "Pegalo en tu IA favorita." })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-primary flex items-center gap-2">
            <Download className="h-6 w-6" /> Importar IA
          </DialogTitle>
          <DialogDescription className="text-sm font-bold text-muted-foreground uppercase tracking-widest pt-2">
            Cargá una o varias recetas en segundos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-primary-suave p-4 rounded-2xl border border-primary/10 relative">
             <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black uppercase text-primary">Prompt Sugerido</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyPrompt}>
                  <Copy className="h-4 w-4" />
                </Button>
             </div>
             <p className="text-[10px] text-primary/70 font-medium line-clamp-3 italic">
               {PROMPT_TEMPLATE}
             </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Contenido JSON</label>
            <Textarea 
              placeholder='Pegá el JSON aquí (puede ser un array [{},{}])...' 
              className="min-h-[160px] rounded-2xl border-2 font-mono text-xs focus-visible:ring-primary"
              value={jsonText}
              onChange={(e) => validateJson(e.target.value)}
            />
          </div>

          {isValid === false && (
            <div className="bg-destructive/10 p-3 rounded-xl flex items-start gap-2 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="flex-1 overflow-y-auto max-h-24">
                {errors.map((err, i) => <p key={i} className="text-xs font-bold text-destructive">{err}</p>)}
              </div>
            </div>
          )}

          {isValid === true && (
            <div className="bg-primary/10 p-3 rounded-xl flex items-center gap-2 border border-primary/20">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <p className="text-xs font-bold text-primary">Listo para importar {importCount} {importCount === 1 ? 'receta' : 'recetas'}.</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1 rounded-2xl h-12" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              className="flex-1 rounded-2xl h-12 bg-primary text-white font-black" 
              disabled={!isValid || isImporting}
              onClick={handleImport}
            >
              {isImporting ? "Importando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
