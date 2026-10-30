"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, Copy, Sparkles } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { useFirestore } from "@/firebase"
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore"
import { useAppStore } from "@/store/app-store"
import { useRouter } from "next/navigation"
import { USER_ID } from "@/lib/constants"
import { categorizeIngredient, normalizeIngredientName } from "@/lib/categorizeIngredient"
import { PROMPT_TEMPLATE } from "@/lib/recipe-prompt"


export function RecipeImportModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const db = useFirestore()
  const [jsonText, setJsonText] = React.useState("")
  const [isValid, setIsValid] = React.useState<boolean | null>(null)
  const [errors, setErrors] = React.useState<string[]>([])
  const [isImporting, setIsImporting] = React.useState(false)
  const [importCount, setImportCount] = React.useState(0)

  React.useEffect(() => {
    if (!open) {
      setJsonText("")
      setIsValid(null)
      setErrors([])
      setImportCount(0)
    }
  }, [open])

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

      // La despensa ya está en memoria: no hace falta una consulta por ingrediente
      const knownIngredients = new Set(
        useAppStore.getState().ingredientes.map(i => (i.nombre || "").toLowerCase().trim())
      )
      const batch = writeBatch(db)
      let firstRecipeId = ""

      for (const recipeData of items) {
        // Normalización de categorías de receta
        let rawCats = recipeData.categorias || recipeData.categoria || ["Almuerzo"];
        const categorias = Array.isArray(rawCats) ? rawCats : [rawCats];
        recipeData.categorias = categorias;
        recipeData.categoria = categorias[0];

        // Asegurar campos nuevos si no existen
        recipeData.utensilios = recipeData.utensilios || [];
        recipeData.tips = recipeData.tips || [];

        recipeData.ingredientes = (recipeData.ingredientes || []).map((ing: any) => {
          const normalizedName = normalizeIngredientName(ing.nombre);
          return {
            ...ing,
            nombre: normalizedName,
            categoria: categorizeIngredient(normalizedName)
          }
        });

        recipeData.fotoURL = null
        recipeData.userId = USER_ID
        recipeData.createdAt = serverTimestamp()
        recipeData.updatedAt = serverTimestamp()

        const docRef = doc(recipesCol)
        batch.set(docRef, recipeData)
        if (!firstRecipeId) firstRecipeId = docRef.id

        // Guardar ingredientes en la despensa si no existen
        for (const ing of recipeData.ingredientes || []) {
          if (!ing.nombre) continue;
          const normalizedName = normalizeIngredientName(ing.nombre);
          const key = normalizedName.toLowerCase().trim()

          if (!knownIngredients.has(key)) {
            knownIngredients.add(key)
            batch.set(doc(ingredientsCol), {
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

      await batch.commit()
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Importar recetas con IA
          </DialogTitle>
          <DialogDescription>
            Copiá el prompt, pedile las recetas a tu IA (ChatGPT, Gemini, Claude) y pegá acá el JSON que te devuelva.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <button
            type="button"
            onClick={copyPrompt}
            className="w-full glass rounded-[20px] p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
          >
            <span className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Copy className="h-4 w-4 text-primary" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold">1 · Copiar prompt</span>
              <span className="block text-xs text-muted-foreground truncate">Reglas de formato, unidades y categorías</span>
            </span>
          </button>

          <div className="space-y-2">
            <p className="eyebrow px-1">2 · Pegar JSON</p>
            <Textarea
              placeholder='{"nombre": "...", "ingredientes": [...], "pasos": [...]}'
              className="min-h-[160px] font-mono text-xs"
              value={jsonText}
              onChange={(e) => validateJson(e.target.value)}
            />
          </div>

          {isValid === false && (
            <div className="bg-destructive/10 p-3 rounded-2xl flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1 overflow-y-auto max-h-24 space-y-0.5">
                {errors.map((err, i) => <p key={i} className="text-xs font-medium text-destructive">{err}</p>)}
              </div>
            </div>
          )}

          {isValid === true && (
            <div className="bg-primary/10 p-3 rounded-2xl flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold text-primary">Listo para importar {importCount} {importCount === 1 ? "receta" : "recetas"}.</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" disabled={!isValid || isImporting} onClick={handleImport}>
              {isImporting ? "Importando..." : "Importar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
