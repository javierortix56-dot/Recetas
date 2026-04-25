"use client"

import * as React from "react"
import {
  ArrowLeft, Clock, Timer, ChefHat, Play,
  Utensils, Calendar, ShoppingCart, Activity,
  Trash2, AlertTriangle, Pencil, Info,
  Box, CookingPot, Lightbulb
} from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFirestore } from "@/firebase"
import { doc, collection, getDocs, writeBatch, serverTimestamp, deleteDoc, query, where } from "firebase/firestore"
import { GradientPlaceholder } from "@/components/gradient-placeholder"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/hooks/use-toast"
import { AddMealPlanDialog } from "@/components/plan/add-meal-plan-dialog"
import { AddMealLogDialog } from "@/components/macros/add-meal-log-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { format } from "date-fns"
import { USER_ID } from "@/lib/constants"
import { isSubPreparation } from "@/lib/categorizeIngredient"
import { getSafeImageSource, formatPrecio } from "@/lib/utils"
import { useAppStore } from "@/store/app-store"
import { cn } from "@/lib/utils"

function UtensilIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  if (n.includes('cuchillo')) return <Utensils className="h-4 w-4" />;
  if (n.includes('sartén') || n.includes('olla') || n.includes('cacerola')) return <CookingPot className="h-4 w-4" />;
  if (n.includes('licuadora') || n.includes('procesadora') || n.includes('horno')) return <Activity className="h-4 w-4" />;
  return <Box className="h-4 w-4" />;
}

export function RecipeDetailClient({ recipeId }: { recipeId: string }) {
  const router = useRouter()
  const db = useFirestore()

  const receta = useAppStore(s => s.recetas.find(r => r.id === recipeId))
  const recetasCargadas = useAppStore(s => s.recetasCargadas)
  const isLoading = !recetasCargadas

  const [currentPortions, setCurrentPortions] = React.useState(3)
  const [stockStatus, setStockStatus] = React.useState<Record<string, 'green' | 'yellow' | 'red' | 'gray'>>({})
  const [isDeleting, setIsDeleting] = React.useState(false)

  React.useEffect(() => {
    const checkStock = async () => {
      if (!db || !receta?.ingredientes?.length) return
      const status: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {}

      // Single batch read instead of N individual queries
      const snap = await getDocs(collection(db, "users", USER_ID, "ingredients"))
      const stockMap: Record<string, any> = {}
      snap.docs.forEach(d => {
        const data = d.data()
        if (data.nombre) stockMap[data.nombre] = data
      })

      receta.ingredientes.forEach((ing: any) => {
        const data = stockMap[ing.nombre]
        if (!data) status[ing.nombre] = 'gray'
        else if (data.stockActual > data.stockMinimo) status[ing.nombre] = 'green'
        else if (data.stockActual > 0) status[ing.nombre] = 'yellow'
        else status[ing.nombre] = 'red'
      })
      setStockStatus(status)
    }
    checkStock()
  }, [receta?.id, db])

  React.useEffect(() => {
    if (receta?.porciones) {
      setCurrentPortions(receta.porciones > 1 ? receta.porciones : 3)
    }
  }, [receta])

  const scale = receta ? currentPortions / (receta.porciones || 1) : 1

  const handleAddMissingToShoppingList = async () => {
    if (!db || !receta) return
    try {
      const batch = writeBatch(db)
      const shoppingCol = collection(db, "users", USER_ID, "shopping_list_items")
      const ingredientsCol = collection(db, "users", USER_ID, "ingredients")
      let addedCount = 0

      for (const ing of receta.ingredientes) {
        if (isSubPreparation(ing.nombre)) continue;
        const needed = ing.cantidad * scale
        const q = query(ingredientsCol, where("nombre", "==", ing.nombre))
        const snap = await getDocs(q)
        let available = 0
        let ingredientId = null
        let categoria = "Almacén"
        let precioUnitario = 0

        if (!snap.empty) {
          const data = snap.docs[0].data()
          available = data.stockActual || 0
          ingredientId = snap.docs[0].id
          precioUnitario = data.precioUnitario || 0
          categoria = data.categoria || categoria
        }

        if (needed > available) {
          const buyQty = needed - available
          const newDocRef = doc(shoppingCol)
          batch.set(newDocRef, {
            userId: USER_ID,
            nombre: ing.nombre,
            cantidad: Number(buyQty.toFixed(1)),
            unidad: ing.unidad || "unid",
            ingredienteId: ingredientId,
            categoria: categoria,
            precioUnitario: precioUnitario,
            subtotal: precioUnitario * Number(buyQty.toFixed(1)),
            isPurchased: false,
            source: "manual",
            reason: "Manual",
            createdAt: serverTimestamp()
          })
          addedCount++
        }
      }
      await batch.commit()
      toast({ title: addedCount > 0 ? "Lista actualizada" : "Tenés todo en stock ✓" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
    }
  }

  const handleDeleteRecipe = async () => {
    if (!db || !recipeId) return
    setIsDeleting(true)
    try {
      await deleteDoc(doc(db, "users", USER_ID, "recipes", recipeId))
      toast({ title: "Receta eliminada" })
      router.replace("/recetas")
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) return <RecipeSkeleton />
  if (!receta) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8 text-center">
      <div className="bg-primary-suave w-20 h-20 rounded-full flex items-center justify-center">
        <ChefHat className="h-10 w-10 text-primary/40" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">Receta no encontrada</h2>
        <p className="text-sm text-muted-foreground">Esta receta no existe o fue eliminada.</p>
      </div>
      <Button
        className="h-11 px-8 rounded-xl bg-primary text-white font-medium text-sm"
        onClick={() => router.replace("/recetas")}
      >
        Ver todas las recetas
      </Button>
    </div>
  )

  const imageSource = getSafeImageSource(receta);

  return (
    <div className="flex flex-col min-h-screen bg-background pb-52">
      {/* Hero */}
      <div className="relative h-[260px] w-full bg-muted">
        {imageSource ? (
          <Image
            src={imageSource}
            alt={receta.nombre}
            fill
            className="object-cover"
            priority
            unoptimized
          />
        ) : (
          <GradientPlaceholder categoria={receta.categoria} className="rounded-none" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

        {/* Botones superiores */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full bg-black/25 backdrop-blur-md h-9 w-9 text-white"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full bg-black/25 backdrop-blur-md h-9 w-9 text-white"
              onClick={() => router.push(`/recetas/edit/${recipeId}`)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" className="rounded-full bg-destructive/70 backdrop-blur-md h-9 w-9 text-white">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-[2rem]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-semibold text-foreground">¿Eliminar receta?</AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                  <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteRecipe} className="bg-destructive text-white rounded-xl" disabled={isDeleting}>
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              variant="ghost"
              className="rounded-full bg-primary/85 backdrop-blur-md h-9 px-4 text-white font-medium text-xs"
              onClick={() => router.push(`/recetas/cooking/${recipeId}`)}
            >
              <Play className="h-3.5 w-3.5 mr-1.5 fill-current" /> Cocinar
            </Button>
          </div>
        </div>

        {/* Título y categorías */}
        <div className="absolute bottom-5 left-5 right-5">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(receta.categorias || [receta.categoria]).map((cat: string) => (
              <span key={cat} className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-medium px-2.5 py-1 rounded-full">
                {cat}
              </span>
            ))}
            <span className="bg-accent/80 backdrop-blur-sm text-white text-[10px] font-medium px-2.5 py-1 rounded-full">
              {receta.dificultad}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white leading-snug">{receta.nombre}</h1>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-5 animate-in slide-in-from-bottom-4 duration-500">
        {/* Macros compactos */}
        {receta.macros && (
          <section className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {[
              { label: 'Kcal', value: receta.macros.calorias, color: 'bg-primary/8 text-primary' },
              { label: 'Proteínas', value: receta.macros.proteinas, unit: 'g', color: 'bg-blue-50 text-blue-600' },
              { label: 'Carbos', value: receta.macros.carbohidratos, unit: 'g', color: 'bg-amber-50 text-amber-600' },
              { label: 'Grasas', value: receta.macros.grasas, unit: 'g', color: 'bg-rose-50 text-rose-500' },
            ].map(m => (
              <div key={m.label} className={`flex items-center gap-2 px-3 py-2 rounded-xl shrink-0 ${m.color}`}>
                <span className="text-sm font-semibold leading-none">{Math.round(m.value || 0)}{m.unit || ''}</span>
                <span className="text-[10px] font-medium opacity-70">{m.label}</span>
              </div>
            ))}
          </section>
        )}

        {/* Descripción */}
        {receta.descripcion && (
          <p className="text-sm text-foreground/65 leading-relaxed italic">{receta.descripcion}</p>
        )}

        {/* Chips de info */}
        <section className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 bg-muted/60 px-3 py-2 rounded-xl shrink-0">
            <Utensils className="h-3.5 w-3.5 text-primary" />
            <div className="flex items-center gap-1.5 text-foreground">
              <button
                onClick={() => setCurrentPortions(Math.max(1, currentPortions - 1))}
                className="w-5 h-5 flex items-center justify-center bg-white rounded-md shadow-sm active:scale-90 transition-transform text-sm font-medium"
              >-</button>
              <span className="text-sm font-medium w-4 text-center">{currentPortions}</span>
              <button
                onClick={() => setCurrentPortions(currentPortions + 1)}
                className="w-5 h-5 flex items-center justify-center bg-white rounded-md shadow-sm active:scale-90 transition-transform text-sm font-medium"
              >+</button>
            </div>
          </div>
          {receta.tiempoPreparacion > 0 && (
            <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-2 rounded-xl shrink-0">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Prep {receta.tiempoPreparacion} min</span>
            </div>
          )}
          {receta.tiempoCoccion > 0 && (
            <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-2 rounded-xl shrink-0">
              <ChefHat className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Cocción {receta.tiempoCoccion} min</span>
            </div>
          )}
        </section>

        {/* Tabs */}
        <Tabs defaultValue="ingredients" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-muted/60 p-1 rounded-xl h-11">
            <TabsTrigger value="ingredients" className="rounded-lg font-medium text-xs data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all">
              Ingredientes
            </TabsTrigger>
            <TabsTrigger value="steps" className="rounded-lg font-medium text-xs data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all">
              Pasos
            </TabsTrigger>
            <TabsTrigger value="details" className="rounded-lg font-medium text-xs data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all">
              Utensilios
            </TabsTrigger>
            <TabsTrigger value="cost" className="rounded-lg font-medium text-xs data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all">
              Costo
            </TabsTrigger>
          </TabsList>

          {/* Ingredientes — lista compacta */}
          <TabsContent value="ingredients" className="pt-4 space-y-3">
            <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
              {receta.ingredientes?.map((ing: any, i: number) => {
                const status = stockStatus[ing.nombre] || 'gray'
                const dotColor: Record<string, string> = {
                  green: 'bg-emerald-400',
                  yellow: 'bg-amber-400',
                  red: 'bg-red-400',
                  gray: 'bg-gray-300',
                }
                const isLast = i === (receta.ingredientes?.length || 1) - 1
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 py-2.5 px-4",
                      !isLast && "border-b border-border/30"
                    )}
                  >
                    <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor[status]}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-foreground block truncate">{ing.nombre}</span>
                      {ing.preparacion && (
                        <span className="text-[10px] text-muted-foreground/60">{ing.preparacion}</span>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-primary shrink-0">
                      {(ing.cantidad * scale).toLocaleString('es-ES', { maximumFractionDigits: 1 })}
                      <span className="text-[10px] font-normal text-muted-foreground ml-1">{ing.unidad}</span>
                    </span>
                  </div>
                )
              })}
            </div>
            <Button
              variant="outline"
              className="w-full rounded-xl h-11 font-medium text-sm border text-primary border-primary/20 hover:bg-primary hover:text-white transition-colors"
              onClick={handleAddMissingToShoppingList}
            >
              <ShoppingCart className="h-4 w-4 mr-2" /> Agregar faltantes a la lista
            </Button>
          </TabsContent>

          {/* Pasos — timeline limpio */}
          <TabsContent value="steps" className="pt-4">
            <div className="relative">
              <div className="absolute left-[15px] top-5 bottom-5 w-px bg-border/60 rounded-full" />
              <div className="space-y-0">
                {receta.pasos?.map((step: any, i: number) => {
                  const isLast = i === (receta.pasos?.length || 1) - 1;
                  return (
                    <div key={i} className="relative flex gap-3 pb-5">
                      <div className="relative z-10 shrink-0">
                        <div className="h-8 w-8 rounded-xl bg-primary text-white flex items-center justify-center font-semibold text-xs shadow-sm">
                          {i + 1}
                        </div>
                      </div>
                      <div className="flex-1 bg-white rounded-2xl border border-border/40 shadow-sm p-4 -mt-0.5">
                        <div className="flex justify-between items-start mb-1.5">
                          <h4 className="font-semibold text-sm text-foreground leading-tight">{step.titulo || `Paso ${i + 1}`}</h4>
                          {step.timerSegundos > 0 && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/8 px-2 py-0.5 rounded-full shrink-0 ml-2">
                              <Timer className="h-3 w-3" /> {Math.floor(step.timerSegundos / 60)} min
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-foreground/70 leading-relaxed whitespace-pre-wrap">{step.descripcion}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </TabsContent>

          {/* Utensilios + Tips */}
          <TabsContent value="details" className="pt-4 space-y-5">
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Utensilios necesarios</h3>
              <div className="grid grid-cols-2 gap-2">
                {(receta.utensilios || []).length > 0 ? (
                  receta.utensilios.map((u: string, i: number) => (
                    <div key={i} className="flex items-center gap-2.5 p-3 bg-white rounded-xl border border-border/40 shadow-sm">
                      <div className="h-8 w-8 rounded-lg bg-primary-suave flex items-center justify-center text-primary shrink-0">
                        <UtensilIcon name={u} />
                      </div>
                      <span className="text-xs font-medium text-foreground/80 leading-tight">{u}</span>
                    </div>
                  ))
                ) : (
                  <p className="col-span-2 text-center text-xs text-muted-foreground py-4">No se especificaron utensilios</p>
                )}
              </div>
            </section>

            {(receta.tips || []).length > 0 && (
              <section className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Consejos del chef</h3>
                <div className="space-y-2">
                  {receta.tips.map((t: string, i: number) => (
                    <div key={i} className="bg-amber-50 px-4 py-3 rounded-xl border border-amber-100 flex gap-3 items-start">
                      <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground/75 leading-relaxed">{t}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </TabsContent>

          <TabsContent value="cost" className="pt-4">
            <p className="text-center text-xs text-muted-foreground py-8">Próximamente</p>
          </TabsContent>
        </Tabs>
      </div>

      {/* Bar flotante de acciones — positioned above BottomNav (~70px) */}
      <div className="fixed bottom-[78px] left-0 right-0 z-[49] px-4 pointer-events-none">
        <div className="bg-white/85 backdrop-blur-2xl border border-white/50 shadow-nav rounded-[1.75rem] p-2 flex gap-2 pointer-events-auto max-w-lg mx-auto">
          <AddMealPlanDialog date={new Date()} momento="Almuerzo" recipeToLog={receta}>
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0 border border-border/50">
              <Calendar className="h-4 w-4" />
            </Button>
          </AddMealPlanDialog>
          <AddMealLogDialog date={format(new Date(), "yyyy-MM-dd")} recipeToLog={receta}>
            <Button className="flex-1 h-11 rounded-xl bg-primary text-white font-medium text-sm shadow-glow">
              <Activity className="h-4 w-4 mr-2" /> Registrar Macros
            </Button>
          </AddMealLogDialog>
        </div>
      </div>
    </div>
  )
}

function RecipeSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-[260px] w-full rounded-2xl" />
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  )
}
