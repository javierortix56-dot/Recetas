"use client"

import * as React from "react"
import {
  ArrowLeft, Clock, Timer, ChefHat, Play, Utensils, CalendarPlus, Activity,
  Trash2, Pencil, Lightbulb, Box, CookingPot, MoreHorizontal, Minus, Plus, Flame,
} from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { doc, deleteDoc } from "firebase/firestore"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Segmented } from "@/components/ui/segmented"
import { EmptyState } from "@/components/ui/page-header"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { easeOut, stagger } from "@/components/ui/motion"
import { GradientPlaceholder } from "@/components/gradient-placeholder"
import { AddMealPlanDialog } from "@/components/plan/add-meal-plan-dialog"
import { AddMealLogDialog } from "@/components/macros/add-meal-log-dialog"
import { useFirestore } from "@/firebase"
import { toast } from "@/hooks/use-toast"
import { USER_ID } from "@/lib/constants"
import { isSubPreparation } from "@/lib/categorizeIngredient"
import { calcularCostoIngrediente, cn, convertirCantidad, formatPrecio, getSafeImageSource } from "@/lib/utils"
import { useAppStore } from "@/store/app-store"

type StockState = 'ok' | 'poco' | 'falta' | 'sin-datos'

const STOCK_STYLE: Record<StockState, { dot: string; label: string }> = {
  ok: { dot: 'bg-primary', label: 'En stock' },
  poco: { dot: 'bg-accent', label: 'Alcanza justo o falta un poco' },
  falta: { dot: 'bg-destructive', label: 'No hay' },
  'sin-datos': { dot: 'bg-muted-foreground/40', label: 'No está en la despensa' },
}

function UtensilIcon({ name }: { name: string }) {
  const n = name.toLowerCase()
  if (n.includes('cuchillo')) return <Utensils className="h-4 w-4" />
  if (n.includes('sartén') || n.includes('olla') || n.includes('cacerola') || n.includes('horno')) return <CookingPot className="h-4 w-4" />
  return <Box className="h-4 w-4" />
}

export function RecipeDetailClient({ recipeId }: { recipeId: string }) {
  const router = useRouter()
  const db = useFirestore()

  const receta = useAppStore(s => s.recetas.find(r => r.id === recipeId))
  const recetasCargadas = useAppStore(s => s.recetasCargadas)
  const ingredientes = useAppStore(s => s.ingredientes)

  const [portions, setPortions] = React.useState(3)
  const [tab, setTab] = React.useState<'ingredientes' | 'pasos' | 'extras' | 'costo'>('ingredientes')
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [logOpen, setLogOpen] = React.useState(false)

  React.useEffect(() => {
    if (receta?.porciones) setPortions(receta.porciones)
  }, [receta?.porciones])

  // Despensa indexada por nombre: antes se hacía una consulta a Firestore por ingrediente
  const stockByName = React.useMemo(
    () => new Map(ingredientes.map(i => [(i.nombre || "").toLowerCase().trim(), i])),
    [ingredientes]
  )

  const scale = receta ? portions / (receta.porciones || 1) : 1

  const rows = React.useMemo(() => (receta?.ingredientes || []).map((ing: any) => {
    const stock = stockByName.get((ing.nombre || "").toLowerCase().trim())
    const needed = (Number(ing.cantidad) || 0) * scale
    let state: StockState = 'sin-datos'
    let cost = 0
    if (stock) {
      const neededInStockUnit = convertirCantidad(needed, ing.unidad, stock.unidad)
      const available = Number(stock.stockActual) || 0
      state = available <= 0 ? 'falta' : available >= neededInStockUnit ? 'ok' : 'poco'
      cost = calcularCostoIngrediente(needed, ing.unidad, Number(stock.precioUnitario) || 0, stock.unidad)
    }
    return { ing, needed, state, cost, hasPrice: !!stock?.precioUnitario }
  }), [receta?.ingredientes, stockByName, scale])

  const totalCost = rows.reduce((a: number, r: any) => a + r.cost, 0)
  const pricedCount = rows.filter((r: any) => r.hasPrice || isSubPreparation(r.ing.nombre)).length
  const missingCount = rows.filter((r: any) => r.state === 'falta' || r.state === 'poco').length

  const handleDeleteRecipe = async () => {
    if (!db) return
    try {
      await deleteDoc(doc(db, "users", USER_ID, "recipes", recipeId))
      toast({ title: "Receta eliminada" })
      router.replace("/recetas")
    } catch {
      toast({ variant: "destructive", title: "No se pudo eliminar" })
    }
  }

  if (!recetasCargadas && !receta) return <RecipeSkeleton />
  if (!receta) return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4">
      <EmptyState
        icon={ChefHat}
        title="Receta no encontrada"
        description="Puede que la hayan eliminado."
        action={<Button className="mt-2" onClick={() => router.replace("/recetas")}>Ver recetas</Button>}
      />
    </div>
  )

  const imageSource = getSafeImageSource(receta)
  const categorias: string[] = Array.isArray(receta.categorias) && receta.categorias.length ? receta.categorias : [receta.categoria || "Almuerzo"]
  const totalTime = (Number(receta.tiempoPreparacion) || 0) + (Number(receta.tiempoCoccion) || 0)
  const today = new Date()
  const hasSteps = (receta.pasos || []).length > 0

  return (
    <div className="flex flex-col min-h-[100dvh] pb-36">
      {/* Héroe */}
      <div className="relative h-[320px] w-full bg-muted">
        {imageSource ? (
          <Image src={imageSource} alt={receta.nombre} fill className="object-cover" priority unoptimized />
        ) : (
          <GradientPlaceholder categoria={categorias[0]} className="rounded-none" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/30" />
        <div className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 right-4 flex justify-between items-center">
          <button aria-label="Volver" onClick={() => router.back()} className="h-10 w-10 rounded-full bg-black/25 backdrop-blur-md text-white flex items-center justify-center active:scale-90">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Más opciones" className="h-10 w-10 rounded-full bg-black/25 backdrop-blur-md text-white flex items-center justify-center active:scale-90">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/recetas/edit/${recipeId}`)}><Pencil /> Editar receta</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLogOpen(true)}><Activity /> Registrar que la comí</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setConfirmDelete(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 /> Eliminar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="absolute bottom-5 left-5 right-5 text-white">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {categorias.map(cat => (
              <span key={cat} className="rounded-full bg-white/20 backdrop-blur-md px-2.5 py-0.5 text-[11px] font-semibold">{cat}</span>
            ))}
            {receta.dificultad && <span className="rounded-full bg-accent/90 px-2.5 py-0.5 text-[11px] font-semibold text-accent-foreground">{receta.dificultad}</span>}
          </div>
          <h1 className="text-[28px] font-bold tracking-tight leading-[1.1]">{receta.nombre}</h1>
          <div className="mt-2 flex items-center gap-3 text-xs text-white/85 tabular-nums">
            {totalTime > 0 && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{receta.tiempoPreparacion || 0}′ prep · {receta.tiempoCoccion || 0}′ cocción</span>}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4 relative space-y-4">
        {/* Macros por porción */}
        {receta.macros && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={easeOut} className="glass-strong rounded-[24px] p-3 grid grid-cols-4 gap-1 text-center">
            {[
              { label: 'kcal', value: receta.macros.calorias, icon: true },
              { label: 'prot', value: receta.macros.proteinas, unit: 'g' },
              { label: 'carbs', value: receta.macros.carbohidratos, unit: 'g' },
              { label: 'grasas', value: receta.macros.grasas, unit: 'g' },
            ].map(m => (
              <div key={m.label} className="py-1">
                <p className="text-lg font-bold tabular-nums leading-none flex items-center justify-center gap-0.5">
                  {m.icon && <Flame className="h-3.5 w-3.5 text-accent" />}{Math.round(m.value || 0)}{m.unit || ''}
                </p>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mt-1">{m.label}</p>
              </div>
            ))}
            <p className="col-span-4 text-[10px] text-muted-foreground">por porción</p>
          </motion.section>
        )}

        {receta.descripcion && <p className="text-sm text-foreground/75 leading-relaxed px-1">{receta.descripcion}</p>}

        <Segmented
          id="receta-tab"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'ingredientes', label: 'Ingredientes' },
            { value: 'pasos', label: 'Pasos' },
            { value: 'extras', label: 'Extras' },
            { value: 'costo', label: 'Costo' },
          ]}
        />

        {(tab === 'ingredientes' || tab === 'costo') && (
          <div className="flex items-center justify-between glass rounded-[20px] px-4 h-12">
            <span className="text-sm font-semibold">Porciones</span>
            <div className="flex items-center gap-2">
              <button aria-label="Menos porciones" onClick={() => setPortions(p => Math.max(1, p - 1))} className="h-8 w-8 rounded-full bg-foreground/[0.06] flex items-center justify-center active:scale-90"><Minus className="h-3.5 w-3.5" /></button>
              <span className="w-6 text-center font-bold tabular-nums">{portions}</span>
              <button aria-label="Más porciones" onClick={() => setPortions(p => p + 1)} className="h-8 w-8 rounded-full bg-foreground/[0.06] flex items-center justify-center active:scale-90"><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        )}

        {tab === 'ingredientes' && (
          <section className="space-y-2">
            {missingCount > 0 && (
              <p className="px-1 text-xs text-muted-foreground">
                Faltan {missingCount} ingredientes. Al planificar la receta se suman solos a Compras.
              </p>
            )}
            <div className="glass rounded-[22px] overflow-hidden">
              {rows.map(({ ing, needed, state }: any, i: number) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-hairline last:border-b-0">
                  <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", STOCK_STYLE[state as StockState].dot)} title={STOCK_STYLE[state as StockState].label} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate first-letter:uppercase">{ing.nombre}</p>
                    {ing.preparacion && <p className="text-[11px] text-muted-foreground truncate">{ing.preparacion}</p>}
                  </div>
                  <p className="text-sm font-semibold tabular-nums shrink-0">
                    {needed.toLocaleString('es-AR', { maximumFractionDigits: 1 })} <span className="text-muted-foreground font-medium">{ing.unidad}</span>
                  </p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
              {(['ok', 'poco', 'falta', 'sin-datos'] as StockState[]).map(s => (
                <span key={s} className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className={cn("h-1.5 w-1.5 rounded-full", STOCK_STYLE[s].dot)} />{STOCK_STYLE[s].label}</span>
              ))}
            </div>
          </section>
        )}

        {tab === 'pasos' && (
          <section className="space-y-2.5">
            {hasSteps ? receta.pasos.map((step: any, i: number) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...easeOut, delay: stagger(i, 0.04) }} className="glass rounded-[22px] p-4 flex gap-3">
                <span className="h-8 w-8 rounded-xl bg-brand text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-glow">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-semibold text-[15px] leading-tight">{step.titulo || `Paso ${i + 1}`}</h4>
                    {step.timerSegundos > 0 && (
                      <span className="shrink-0 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-semibold flex items-center gap-1 tabular-nums">
                        <Timer className="h-3 w-3" />{Math.round(step.timerSegundos / 60)}′
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-foreground/75 leading-relaxed whitespace-pre-wrap">{step.descripcion}</p>
                </div>
              </motion.div>
            )) : (
              <p className="text-center text-sm text-muted-foreground py-8">Esta receta no tiene pasos cargados.</p>
            )}
          </section>
        )}

        {tab === 'extras' && (
          <section className="space-y-4">
            <div className="space-y-2">
              <p className="eyebrow px-1">Utensilios</p>
              {(receta.utensilios || []).length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {receta.utensilios.map((u: string, i: number) => (
                    <div key={i} className="glass rounded-2xl p-3 flex items-center gap-2.5">
                      <span className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><UtensilIcon name={u} /></span>
                      <span className="text-xs font-medium">{u}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground px-1">Sin utensilios cargados.</p>}
            </div>
            {(receta.tips || []).length > 0 && (
              <div className="space-y-2">
                <p className="eyebrow px-1">Tips del chef</p>
                {receta.tips.map((t: string, i: number) => (
                  <div key={i} className="glass rounded-2xl p-3.5 flex gap-3">
                    <Lightbulb className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground/80 leading-relaxed">{t}</p>
                  </div>
                ))}
              </div>
            )}
            {receta.historia && (
              <div className="space-y-2">
                <p className="eyebrow px-1">Historia</p>
                <p className="glass rounded-2xl p-3.5 text-sm text-foreground/80 leading-relaxed">{receta.historia}</p>
              </div>
            )}
          </section>
        )}

        {tab === 'costo' && (
          <section className="space-y-2">
            <div className="glass rounded-[22px] p-4 flex items-end justify-between">
              <div>
                <p className="eyebrow">Costo estimado</p>
                <p className="text-[28px] font-bold tracking-tight tabular-nums leading-none mt-1.5">{formatPrecio(totalCost)}</p>
                <p className="text-xs text-muted-foreground mt-1 tabular-nums">{formatPrecio(totalCost / Math.max(portions, 1))} por porción</p>
              </div>
              <p className="text-[11px] text-muted-foreground text-right">{pricedCount} de {rows.length}<br />con precio</p>
            </div>
            <div className="glass rounded-[22px] overflow-hidden">
              {rows.map(({ ing, cost, hasPrice }: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-hairline last:border-b-0">
                  <span className="text-sm truncate first-letter:uppercase">{ing.nombre}</span>
                  <span className={cn("text-sm font-semibold tabular-nums", !hasPrice && "text-muted-foreground font-normal")}>{hasPrice ? formatPrecio(cost) : "sin precio"}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground px-1">Los precios salen de la Despensa. Cargalos ahí o desde Compras.</p>
          </section>
        )}
      </div>

      {/* Barra de acciones */}
      <div className="fixed bottom-[max(12px,env(safe-area-inset-bottom))] inset-x-0 mx-auto w-[calc(100%-24px)] max-w-[480px] z-50">
        <div className="glass-strong rounded-[26px] p-2 flex gap-2">
          <AddMealPlanDialog date={today} momento="Almuerzo" recipeToLog={receta}>
            <Button variant="secondary" className="flex-1 h-12"><CalendarPlus className="h-4 w-4" /> Planificar</Button>
          </AddMealPlanDialog>
          <Button className="flex-1 h-12 bg-brand" disabled={!hasSteps} onClick={() => router.push(`/recetas/cooking/${recipeId}`)}>
            <Play className="h-4 w-4 fill-current" /> Cocinar
          </Button>
        </div>
      </div>

      <AddMealLogDialog date={format(today, "yyyy-MM-dd")} recipeToLog={receta} open={logOpen} onOpenChange={setLogOpen} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{receta.nombre}”?</AlertDialogTitle>
            <AlertDialogDescription>No se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRecipe} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function RecipeSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-[320px] w-full rounded-none" />
      <div className="px-4 space-y-3"><Skeleton className="h-20 w-full rounded-[24px]" /><Skeleton className="h-9 w-full" /><Skeleton className="h-48 w-full rounded-[22px]" /></div>
    </div>
  )
}
