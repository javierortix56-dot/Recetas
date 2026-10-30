"use client"

import * as React from "react"
import { Search, Minus, Plus, Loader2 } from "lucide-react"
import Image from "next/image"
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Segmented } from "@/components/ui/segmented"
import { GradientPlaceholder } from "@/components/gradient-placeholder"
import { useFirestore } from "@/firebase"
import { toast } from "@/hooks/use-toast"
import { useAppStore } from "@/store/app-store"
import { USER_ID } from "@/lib/constants"
import { addToSummary, recipeMacros, MOMENTOS, type Macros } from "@/lib/meal-plan"
import { cn, getSafeImageSource } from "@/lib/utils"

/**
 * Registra algo que se comió FUERA del plan (las comidas planificadas ya se
 * registran solas al planificarlas).
 */
export function AddMealLogDialog({ date, recipeToLog, children, open: openProp, onOpenChange }: {
  date: string
  recipeToLog?: any
  children?: React.ReactNode
  /** Modo controlado (p. ej. abierto desde un menú) */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [openState, setOpenState] = React.useState(false)
  const open = openProp ?? openState
  const setOpen = (v: boolean) => { if (openProp === undefined) setOpenState(v); onOpenChange?.(v) }
  const db = useFirestore()
  const activeProfile = useAppStore(s => s.activeProfile)
  const recipes = useAppStore(s => s.recetas)
  const [search, setSearch] = React.useState("")
  const [momento, setMomento] = React.useState<(typeof MOMENTOS)[number]>("Almuerzo")
  const [portions, setPortions] = React.useState(1)
  const [savingId, setSavingId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) { setSearch(""); setPortions(1) }
  }, [open])

  const filteredRecipes = React.useMemo(() => {
    if (!open || recipeToLog) return []
    const q = search.toLowerCase().trim()
    return recipes
      .filter(r => !q || (r.nombre || "").toLowerCase().includes(q))
      .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"))
  }, [open, recipeToLog, recipes, search])

  const handleSelectRecipe = async (recipe: any) => {
    if (!db || savingId) return
    setSavingId(recipe.id)
    try {
      const perPortion = recipeMacros(recipe)
      // El log guarda el total consumido: así borrar el registro descuenta exactamente lo mismo
      const total: Macros = {
        calorias: perPortion.calorias * portions,
        proteinas: perPortion.proteinas * portions,
        carbohidratos: perPortion.carbohidratos * portions,
        grasas: perPortion.grasas * portions,
      }

      const batch = writeBatch(db)
      batch.set(doc(collection(db, "users", USER_ID, "daily_logs")), {
        userId: USER_ID,
        perfil: activeProfile,
        date,
        momento,
        recetaId: recipe.id,
        recetaNombre: recipe.nombre,
        recetaCategoria: recipe.categoria || recipe.categorias?.[0] || "Almuerzo",
        porciones: portions,
        macros: total,
        createdAt: serverTimestamp()
      })
      addToSummary(batch, db, date, activeProfile, total)
      await batch.commit()

      toast({ title: "Comida registrada ✓", description: `${recipe.nombre} · ${Math.round(total.calorias)} kcal` })
      setOpen(false)
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "No se pudo registrar" })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{recipeToLog ? `Registrar ${recipeToLog.nombre}` : "Registrar comida"}</DialogTitle>
          <DialogDescription>Para algo que comiste fuera del plan. Lo planificado ya cuenta solo.</DialogDescription>
        </DialogHeader>

        <Segmented id="log-momento" options={MOMENTOS.map(m => ({ value: m, label: m }))} value={momento} onChange={setMomento} />

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-foreground/[0.05] px-3 h-11">
          <span className="text-xs font-semibold text-muted-foreground">Porciones comidas</span>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Menos porciones" className="h-7 w-7 rounded-full bg-card shadow-soft flex items-center justify-center active:scale-90" onClick={() => setPortions(p => Math.max(1, p - 1))}><Minus className="h-3.5 w-3.5" /></button>
            <span className="w-5 text-center font-bold tabular-nums">{portions}</span>
            <button type="button" aria-label="Más porciones" className="h-7 w-7 rounded-full bg-card shadow-soft flex items-center justify-center active:scale-90" onClick={() => setPortions(p => p + 1)}><Plus className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        {recipeToLog ? (
          <button
            type="button"
            disabled={!!savingId}
            onClick={() => handleSelectRecipe(recipeToLog)}
            className="h-12 rounded-2xl bg-brand text-white font-semibold shadow-glow flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {savingId && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar · {Math.round(recipeMacros(recipeToLog).calorias * portions)} kcal
          </button>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar receta" className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="space-y-1.5 min-h-[200px]">
              {filteredRecipes.map(recipe => {
                const imageSource = getSafeImageSource(recipe)
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    disabled={!!savingId}
                    onClick={() => handleSelectRecipe(recipe)}
                    className={cn("w-full flex items-center gap-3 p-2 rounded-2xl text-left hover:bg-foreground/[0.04] active:scale-[0.99] transition-colors")}
                  >
                    <div className="h-12 w-12 rounded-xl overflow-hidden shrink-0 relative bg-muted">
                      {imageSource ? (
                        <Image src={imageSource} alt={recipe.nombre} fill className="object-cover" unoptimized />
                      ) : (
                        <GradientPlaceholder categoria={recipe.categoria || "Almuerzo"} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate">{recipe.nombre}</h4>
                      <p className="text-xs text-muted-foreground tabular-nums">{Math.round(recipe.macros?.calorias || 0)} kcal / porción</p>
                    </div>
                    {savingId === recipe.id && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </button>
                )
              })}
              {filteredRecipes.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">No hay recetas que coincidan</p>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
