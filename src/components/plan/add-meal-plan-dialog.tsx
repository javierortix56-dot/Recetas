"use client"

import * as React from "react"
import { Search, Minus, Plus, Loader2 } from "lucide-react"
import Image from "next/image"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { writeBatch } from "firebase/firestore"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Segmented } from "@/components/ui/segmented"
import { GradientPlaceholder } from "@/components/gradient-placeholder"
import { useFirestore } from "@/firebase"
import { toast } from "@/hooks/use-toast"
import { useAppStore } from "@/store/app-store"
import { syncShoppingList } from "@/lib/sync-logic"
import { addMealPlan, addToSummary, MOMENTOS } from "@/lib/meal-plan"
import { cn, getSafeImageSource } from "@/lib/utils"

interface AddMealPlanDialogProps {
  date: Date
  momento: string
  /** Si viene una receta, el diálogo solo pide momento, fecha y porciones */
  recipeToLog?: any
  children: React.ReactNode
  onSave?: () => void
}

const recipeCats = (r: any): string[] => Array.isArray(r.categorias) ? r.categorias : (r.categoria ? [r.categoria] : [])

export function AddMealPlanDialog({ date, momento: defaultMomento, recipeToLog, children, onSave }: AddMealPlanDialogProps) {
  const [open, setOpen] = React.useState(false)
  const db = useFirestore()
  const activeProfile = useAppStore(s => s.activeProfile)
  // Usa las recetas del store (antes cada instancia abría su propio listener
  // sobre toda la colección, con fotos incluidas)
  const recipes = useAppStore(s => s.recetas)
  const [search, setSearch] = React.useState("")
  const [momento, setMomento] = React.useState(defaultMomento)
  const [dateStr, setDateStr] = React.useState(() => format(date, "yyyy-MM-dd"))
  const [portions, setPortions] = React.useState(recipeToLog?.porciones || 3)
  const [savingId, setSavingId] = React.useState<string | null>(null)

  // Depende de la fecha como texto: quien llama crea un Date nuevo en cada render
  // y, con el objeto, cualquier actualización de datos reiniciaba lo elegido
  const dateKey = format(date, "yyyy-MM-dd")
  React.useEffect(() => {
    if (open) {
      setMomento(defaultMomento)
      setDateStr(dateKey)
      setSearch("")
    }
  }, [open, defaultMomento, dateKey])

  const filteredRecipes = React.useMemo(() => {
    if (!open || recipeToLog) return []
    const q = search.toLowerCase().trim()
    return recipes
      .filter(r => !q || (r.nombre || "").toLowerCase().includes(q))
      .map(r => ({ r, ideal: recipeCats(r).includes(momento) }))
      .sort((a, b) => Number(b.ideal) - Number(a.ideal) || (a.r.nombre || "").localeCompare(b.r.nombre || "", "es"))
  }, [open, recipeToLog, recipes, search, momento])

  const handleSelectRecipe = async (recipe: any) => {
    if (!db || savingId) return
    setSavingId(recipe.id)
    try {
      const batch = writeBatch(db)
      const macros = addMealPlan(batch, db, { recipe, date: dateStr, mealType: momento, portions, profile: activeProfile })
      addToSummary(batch, db, dateStr, activeProfile, macros)
      await batch.commit()
      syncShoppingList(db, activeProfile).catch(() => {})

      toast({ title: "Planificado ✓", description: `${recipe.nombre} · ${momento}` })
      setOpen(false)
      onSave?.()
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "Error al planificar" })
    } finally {
      setSavingId(null)
    }
  }

  const displayDate = new Date(dateStr + "T00:00:00")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{recipeToLog ? `Planificar ${recipeToLog.nombre}` : `Planificar ${momento.toLowerCase()}`}</DialogTitle>
          <DialogDescription className="first-letter:uppercase">
            {format(displayDate, "EEEE d 'de' MMMM", { locale: es })} · {activeProfile === "mary" ? "Mary" : "Javi"}
          </DialogDescription>
        </DialogHeader>

        <Segmented
          id="plan-momento"
          options={MOMENTOS.map(m => ({ value: m, label: m }))}
          value={momento as (typeof MOMENTOS)[number]}
          onChange={setMomento}
        />

        <div className={cn("flex gap-2", recipeToLog && "flex-col")}>
          {recipeToLog && (
            <Input type="date" aria-label="Fecha" value={dateStr} onChange={(e) => e.target.value && setDateStr(e.target.value)} />
          )}
          <div className="flex-1 flex items-center justify-between gap-3 rounded-2xl bg-foreground/[0.05] px-3 h-11">
            <span className="text-xs font-semibold text-muted-foreground">Porciones</span>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Menos porciones" className="h-7 w-7 rounded-full bg-card shadow-soft flex items-center justify-center active:scale-90" onClick={() => setPortions((p: number) => Math.max(1, p - 1))}><Minus className="h-3.5 w-3.5" /></button>
              <span className="w-5 text-center font-bold tabular-nums">{portions}</span>
              <button type="button" aria-label="Más porciones" className="h-7 w-7 rounded-full bg-card shadow-soft flex items-center justify-center active:scale-90" onClick={() => setPortions((p: number) => p + 1)}><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>

        {recipeToLog ? (
          <button
            type="button"
            disabled={!!savingId}
            onClick={() => handleSelectRecipe(recipeToLog)}
            className="h-12 rounded-2xl bg-brand text-white font-semibold shadow-glow flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {savingId ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Agregar al plan
          </button>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar receta" className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="space-y-1.5 -mx-1 px-1 min-h-[200px]">
              {filteredRecipes.map(({ r: recipe, ideal }) => {
                const imageSource = getSafeImageSource(recipe)
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    disabled={!!savingId}
                    onClick={() => handleSelectRecipe(recipe)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-2xl text-left transition-colors active:scale-[0.99]",
                      ideal ? "bg-primary/[0.07]" : "hover:bg-foreground/[0.04]"
                    )}
                  >
                    <div className="h-12 w-12 rounded-xl overflow-hidden shrink-0 relative bg-muted">
                      {imageSource ? (
                        <Image src={imageSource} alt={recipe.nombre} fill className="object-cover" unoptimized />
                      ) : (
                        <GradientPlaceholder categoria={recipeCats(recipe)[0] || "Almuerzo"} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate">{recipe.nombre}</h4>
                      <p className="text-xs text-muted-foreground tabular-nums">{Math.round(recipe.macros?.calorias || 0)} kcal / porción</p>
                    </div>
                    {savingId === recipe.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : ideal ? (
                      <span className="text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">Ideal</span>
                    ) : null}
                  </button>
                )
              })}
              {filteredRecipes.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-10">No hay recetas que coincidan</p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
