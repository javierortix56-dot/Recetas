"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Sparkles, Loader2, RefreshCw, Minus, Plus, Clock, Flame, ImageOff, Check } from "lucide-react"
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { easeOut } from "@/components/ui/motion"
import { useFirestore } from "@/firebase"
import { toast } from "@/hooks/use-toast"
import { useAppStore } from "@/store/app-store"
import { USER_ID } from "@/lib/constants"
import { compressImageSrc } from "@/lib/utils"
import { uploadRecipeImage } from "@/app/actions/recipe-images"
import { categorizeIngredient, normalizeIngredientName } from "@/lib/categorizeIngredient"
import { generateRecipe, generateRecipeImage, type GeneratedRecipe } from "@/ai/flows/generate-recipe-flow"

const IDEAS = ["Risotto de hongos", "Ñoquis de papa con salsa pomodoro", "Bife de chorizo con chimichurri", "Bowl alto en proteína para el post-gym"]

type Stage = "idle" | "recipe" | "image" | "preview" | "saving"

/**
 * Crear receta con IA: el usuario escribe lo que quiere cocinar, Gemini arma
 * la receta completa y genera la foto del plato. Reemplaza el flujo anterior
 * de copiar un prompt a otra IA y pegar el JSON.
 */
export function RecipeAIDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const db = useFirestore()
  const [pedido, setPedido] = React.useState("")
  const [porciones, setPorciones] = React.useState(4)
  const [stage, setStage] = React.useState<Stage>("idle")
  const [recipe, setRecipe] = React.useState<GeneratedRecipe | null>(null)
  const [image, setImage] = React.useState<string | null>(null)
  const [imageError, setImageError] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setPedido(""); setStage("idle"); setRecipe(null); setImage(null); setImageError(false)
    }
  }, [open])

  const busy = stage === "recipe" || stage === "image" || stage === "saving"

  const makeImage = async (r: GeneratedRecipe) => {
    setStage("image")
    setImageError(false)
    try {
      const raw = await generateRecipeImage({ nombre: r.nombre, descripcion: r.descripcion })
      setImage(await compressImageSrc(raw))
    } catch (e) {
      console.error(e)
      setImageError(true)
    } finally {
      setStage("preview")
    }
  }

  const handleGenerate = async () => {
    if (pedido.trim().length < 2) return
    setStage("recipe")
    setImage(null)
    try {
      const r = await generateRecipe({ pedido: pedido.trim(), porciones })
      setRecipe(r)
      await makeImage(r)
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "No se pudo generar la receta", description: "Revisá la conexión o la clave GEMINI_API_KEY." })
      setStage("idle")
    }
  }

  const handleSave = async () => {
    if (!db || !recipe) return
    setStage("saving")
    let fotoURL: string | null = null
    try {
      // La foto va a Blob y en la receta solo queda su URL
      if (image) {
        try { fotoURL = await uploadRecipeImage(image) } catch (e) { console.error(e) }
      }
      const batch = writeBatch(db)
      const ingredientes = recipe.ingredientes.map(ing => {
        const nombre = normalizeIngredientName(ing.nombre)
        return { ...ing, nombre, categoria: ing.categoria || categorizeIngredient(nombre) }
      })
      const recipeRef = doc(collection(db, "users", USER_ID, "recipes"))
      batch.set(recipeRef, {
        ...recipe,
        categoria: recipe.categorias[0],
        ingredientes,
        pasos: recipe.pasos.map((p, i) => ({ ...p, orden: i + 1, timerSegundos: p.timerSegundos || 0 })),
        tags: recipe.tags.map(t => t.toLowerCase().trim()),
        fotoURL,
        generadaConIA: true,
        userId: USER_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // Ingredientes nuevos a la despensa (con stock 0) para que entren al MRP de compras
      const known = new Set(useAppStore.getState().ingredientes.map(i => (i.nombre || "").toLowerCase().trim()))
      ingredientes.forEach(ing => {
        const key = ing.nombre.toLowerCase().trim()
        if (!key || known.has(key)) return
        known.add(key)
        batch.set(doc(collection(db, "users", USER_ID, "ingredients")), {
          nombre: ing.nombre,
          categoria: ing.categoria,
          unidad: ing.unidad,
          stockActual: 0,
          stockMinimo: 0,
          userId: USER_ID,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      })

      await batch.commit()
      toast({ title: "Receta guardada 🎉", description: recipe.nombre })
      onOpenChange(false)
      router.push(`/recetas/${recipeRef.id}`)
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "No se pudo guardar" })
      setStage("preview")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o) }}>
      <DialogContent className="flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Crear receta con IA</DialogTitle>
          <DialogDescription>Escribí qué querés cocinar. Gemini arma la receta completa y genera la foto.</DialogDescription>
        </DialogHeader>

        {!recipe || stage === "recipe" ? (
          <div className="space-y-3">
            <Textarea
              autoFocus
              value={pedido}
              onChange={(e) => setPedido(e.target.value)}
              disabled={busy}
              placeholder="Ej: lasaña de verduras sin lactosa, o milanesas al horno para el tupper de la semana"
              className="min-h-[96px]"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate() }}
            />
            {!pedido && (
              <div className="flex flex-wrap gap-1.5">
                {IDEAS.map(idea => (
                  <button key={idea} type="button" onClick={() => setPedido(idea)} className="h-7 px-2.5 rounded-full bg-foreground/[0.06] text-[11px] font-medium text-muted-foreground">{idea}</button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-foreground/[0.05] px-3 h-11">
              <span className="text-xs font-semibold text-muted-foreground">Porciones</span>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Menos porciones" disabled={busy} className="h-7 w-7 rounded-full bg-card shadow-soft flex items-center justify-center active:scale-90" onClick={() => setPorciones(p => Math.max(1, p - 1))}><Minus className="h-3.5 w-3.5" /></button>
                <span className="w-5 text-center font-bold tabular-nums">{porciones}</span>
                <button type="button" aria-label="Más porciones" disabled={busy} className="h-7 w-7 rounded-full bg-card shadow-soft flex items-center justify-center active:scale-90" onClick={() => setPorciones(p => Math.min(20, p + 1))}><Plus className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <Button className="w-full h-12 bg-brand" disabled={busy || pedido.trim().length < 2} onClick={handleGenerate}>
              {stage === "recipe" ? <><Loader2 className="h-4 w-4 animate-spin" /> Armando la receta…</> : <><Sparkles className="h-4 w-4" /> Generar receta</>}
            </Button>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={easeOut} className="space-y-3">
            <div className="relative h-48 rounded-[22px] overflow-hidden bg-muted">
              <AnimatePresence mode="wait">
                {stage === "image" ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="skeleton absolute inset-0 flex items-center justify-center">
                    <span className="relative z-10 text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> Generando la foto…</span>
                  </motion.div>
                ) : image ? (
                  <motion.div key={image.slice(-24)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0">
                    <Image src={image} alt={recipe.nombre} fill className="object-cover" unoptimized />
                  </motion.div>
                ) : (
                  <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                    <ImageOff className="h-6 w-6" />
                    <span className="text-xs">{imageError ? "No se pudo generar la foto" : "Sin foto"}</span>
                  </motion.div>
                )}
              </AnimatePresence>
              {stage !== "image" && (
                <button type="button" onClick={() => makeImage(recipe)} disabled={busy} className="absolute bottom-2.5 right-2.5 h-8 px-3 rounded-full bg-black/40 backdrop-blur-md text-white text-[11px] font-semibold flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" /> {image ? "Otra foto" : "Reintentar"}
                </button>
              )}
            </div>

            <div>
              <h3 className="text-lg font-bold tracking-tight leading-tight">{recipe.nombre}</h3>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{recipe.descripcion}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
              <span className="rounded-full bg-foreground/[0.06] px-2.5 py-1 flex items-center gap-1"><Flame className="h-3 w-3 text-accent" />{Math.round(recipe.macros.calorias)} kcal/porc.</span>
              <span className="rounded-full bg-foreground/[0.06] px-2.5 py-1">{Math.round(recipe.macros.proteinas)}g P · {Math.round(recipe.macros.carbohidratos)}g C · {Math.round(recipe.macros.grasas)}g G</span>
              <span className="rounded-full bg-foreground/[0.06] px-2.5 py-1 flex items-center gap-1"><Clock className="h-3 w-3" />{recipe.tiempoPreparacion + recipe.tiempoCoccion}′</span>
              <span className="rounded-full bg-foreground/[0.06] px-2.5 py-1">{recipe.porciones} porc. · {recipe.dificultad}</span>
            </div>
            <div className="glass rounded-[20px] p-3 max-h-40 overflow-y-auto text-sm space-y-1">
              <p className="eyebrow mb-1.5">{recipe.ingredientes.length} ingredientes · {recipe.pasos.length} pasos</p>
              {recipe.ingredientes.map((ing, i) => (
                <div key={i} className="flex justify-between gap-3">
                  <span className="truncate first-letter:uppercase">{ing.nombre}</span>
                  <span className="text-muted-foreground tabular-nums shrink-0">{ing.cantidad} {ing.unidad}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => { setRecipe(null); setImage(null); setStage("idle") }}>
                Cambiar pedido
              </Button>
              <Button className="flex-1" disabled={busy} onClick={handleSave}>
                {stage === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Guardar
              </Button>
            </div>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  )
}
