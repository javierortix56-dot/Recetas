"use client"

import * as React from "react"
import { 
  ArrowLeft, Clock, Timer, ChefHat, Play, 
  Utensils, Calendar, ShoppingCart, Activity,
  Trash2, AlertTriangle, Pencil, Info,
  Box, CookingPot
} from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFirestore } from "@/firebase"
import { doc, collection, query, where, getDocs, writeBatch, serverTimestamp, deleteDoc } from "firebase/firestore"
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
    const checkStockAndPrices = async () => {
      if (!db || !receta?.ingredientes) return
      const status: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {}
      const ingredientsCol = collection(db, "users", USER_ID, "ingredients")
      
      await Promise.all(receta.ingredientes.map(async (ing: any) => {
        const q = query(ingredientsCol, where("nombre", "==", ing.nombre))
        const snap = await getDocs(q)
        if (snap.empty) status[ing.nombre] = 'gray'
        else {
          const data = snap.docs[0].data()
          if (data.stockActual > data.stockMinimo) status[ing.nombre] = 'green'
          else if (data.stockActual > 0) status[ing.nombre] = 'yellow'
          else status[ing.nombre] = 'red'
        }
      }))
      setStockStatus(status)
    }
    checkStockAndPrices()
  }, [receta, db])

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
      <div className="bg-primary-suave w-24 h-24 rounded-full flex items-center justify-center">
        <ChefHat className="h-12 w-12 text-primary/40" />
      </div>
      <div>
        <h2 className="text-2xl font-black text-primary mb-2">Receta no encontrada</h2>
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
          Esta receta no existe o fue eliminada.
        </p>
      </div>
      <Button
        className="h-12 px-8 rounded-2xl bg-primary text-white font-black uppercase text-xs"
        onClick={() => router.replace("/recetas")}
      >
        Ver todas las recetas
      </Button>
    </div>
  )

  const imageSource = getSafeImageSource(receta);

  return (
    <div className="flex flex-col min-h-screen bg-white pb-32">
      <div className="relative h-[280px] w-full bg-muted">
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
          <Button size="icon" variant="ghost" className="rounded-full bg-black/20 backdrop-blur-md h-10 w-10 text-white" onClick={() => router.back()}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="flex gap-2">
            <Button size="icon" variant="ghost" className="rounded-full bg-white/20 backdrop-blur-md h-10 w-10 text-white" onClick={() => router.push(`/recetas/edit/${recipeId}`)}>
              <Pencil className="h-5 w-5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" className="rounded-full bg-destructive/80 backdrop-blur-md h-10 w-10 text-white"><Trash2 className="h-5 w-5" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-[2rem]">
                <AlertDialogHeader><AlertDialogTitle className="font-black text-primary">¿Eliminar receta?</AlertDialogTitle></AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                  <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteRecipe} className="bg-destructive text-white rounded-xl font-black" disabled={isDeleting}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="ghost" className="rounded-full bg-primary/90 backdrop-blur-md h-10 px-4 text-white font-black uppercase text-xs" onClick={() => router.push(`/recetas/cooking/${recipeId}`)}>
              <Play className="h-4 w-4 mr-2 fill-current" /> Cocinar
            </Button>
          </div>
        </div>
        <div className="absolute bottom-6 left-6 right-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-2 snap-x">
            {(receta.categorias || [receta.categoria]).map((cat: string) => (
              <Badge key={cat} className="bg-primary text-white border-none font-black uppercase text-[10px] h-6 snap-start">{cat}</Badge>
            ))}
            <Badge className="bg-accent text-white border-none font-black uppercase text-[10px] h-6 snap-start">{receta.dificultad}</Badge>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight leading-tight">{receta.nombre}</h1>
        </div>
      </div>

      <div className="p-6 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        <section className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-6 px-6 snap-x">
          <div className="flex items-center gap-2 bg-primary-suave px-4 py-2.5 rounded-2xl border border-primary/10 snap-start shrink-0">
            <Utensils className="h-4 w-4 text-primary" />
            <div className="flex items-center gap-2 text-primary font-black">
              <button onClick={() => setCurrentPortions(Math.max(1, currentPortions - 1))} className="w-6 h-6 flex items-center justify-center bg-white rounded-lg shadow-sm">-</button>
              <span className="w-4 text-center text-sm">{currentPortions}</span>
              <button onClick={() => setCurrentPortions(currentPortions + 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded-lg shadow-sm">+</button>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-background px-4 py-2.5 rounded-2xl border border-border snap-start shrink-0">
            <Clock className="h-4 w-4 text-primary" /><span className="text-xs font-bold text-muted-foreground uppercase">Prep: {receta.tiempoPreparacion} min</span>
          </div>
          <div className="flex items-center gap-2 bg-background px-4 py-2.5 rounded-2xl border border-border snap-start shrink-0">
            <ChefHat className="h-4 w-4 text-primary" /><span className="text-xs font-bold text-muted-foreground uppercase">Cocción: {receta.tiempoCoccion} min</span>
          </div>
        </section>

        <Tabs defaultValue="ingredients" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-primary-suave p-1 rounded-2xl h-14">
            <TabsTrigger value="ingredients" className="rounded-xl font-black uppercase text-[9px] data-[state=active]:bg-white data-[state=active]:text-primary">Ingredientes</TabsTrigger>
            <TabsTrigger value="steps" className="rounded-xl font-black uppercase text-[9px] data-[state=active]:bg-white data-[state=active]:text-primary">Pasos</TabsTrigger>
            <TabsTrigger value="details" className="rounded-xl font-black uppercase text-[9px] data-[state=active]:bg-white data-[state=active]:text-primary">Utensilios</TabsTrigger>
            <TabsTrigger value="cost" className="rounded-xl font-black uppercase text-[9px] data-[state=active]:bg-white data-[state=active]:text-primary">Costo</TabsTrigger>
          </TabsList>
          
          <TabsContent value="ingredients" className="pt-6 space-y-4">
            <div className="space-y-3">
              {receta.ingredientes?.map((ing: any, i: number) => {
                const status = stockStatus[ing.nombre] || 'gray'
                const colors = { green: 'bg-[#2D9A6B]', yellow: 'bg-[#F59E0B]', red: 'bg-[#F43F5E]', gray: 'bg-[#6B7280]' }
                return (
                  <div key={i} className="flex items-center justify-between p-4 bg-background rounded-2xl border border-border shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`h-2.5 w-2.5 rounded-full ${colors[status]} shrink-0`} />
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground">{ing.nombre}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{ing.preparacion}</span>
                      </div>
                    </div>
                    <span className="text-sm font-black text-primary">{(ing.cantidad * scale).toLocaleString('es-ES', { maximumFractionDigits: 1 })} {ing.unidad}</span>
                  </div>
                )
              })}
            </div>
            <Button variant="outline" className="w-full rounded-2xl h-14 font-black uppercase text-xs border-2 text-primary border-primary/20" onClick={handleAddMissingToShoppingList}>
              <ShoppingCart className="h-4 w-4 mr-2" /> Agregar faltantes a Compras
            </Button>
          </TabsContent>

          <TabsContent value="steps" className="pt-6 space-y-6">
            {receta.pasos?.map((step: any, i: number) => (
              <Card key={i} className="border-none shadow-recipe bg-white rounded-3xl overflow-hidden">
                <div className="bg-primary px-4 py-2 flex justify-between items-center text-white">
                  <span className="text-[10px] font-black uppercase">Paso {i + 1} de {receta.pasos.length}</span>
                  {step.timerSegundos && <Badge className="bg-white/20 text-white border-none font-bold text-[10px]"><Timer className="h-3 w-3 mr-1" /> {Math.floor(step.timerSegundos / 60)} MIN</Badge>}
                </div>
                <CardContent className="p-5 space-y-3">
                  <h4 className="font-black text-lg text-primary">{step.titulo}</h4>
                  <p className="text-sm text-foreground font-medium leading-relaxed whitespace-pre-wrap">{step.descripcion}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="details" className="pt-6 space-y-6">
            <section className="space-y-4">
              <h3 className="text-xs font-black uppercase text-primary tracking-widest px-2">Utensilios necesarios</h3>
              <div className="grid grid-cols-2 gap-3">
                {(receta.utensilios || []).length > 0 ? (
                  receta.utensilios.map((u: string, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-primary-suave/30 rounded-2xl border border-primary/5">
                      <div className="h-8 w-8 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm">
                        <UtensilIcon name={u} />
                      </div>
                      <span className="text-xs font-bold text-foreground/80">{u}</span>
                    </div>
                  ))
                ) : (
                  <p className="col-span-2 text-center text-[10px] font-bold text-muted-foreground uppercase py-4">No se especificaron utensilios</p>
                )}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xs font-black uppercase text-primary tracking-widest px-2">Tips del Chef</h3>
              <div className="space-y-3">
                {(receta.tips || []).map((t: string, i: number) => (
                  <div key={i} className="bg-accent/5 p-4 rounded-3xl border-2 border-accent/10 flex gap-4">
                    <Info className="h-5 w-5 text-accent shrink-0" />
                    <p className="text-xs font-medium text-foreground/80 leading-relaxed italic">{t}</p>
                  </div>
                ))}
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-border p-4 flex gap-2 z-50 safe-area-pb max-w-lg mx-auto">
        <AddMealPlanDialog date={new Date()} momento="Almuerzo" recipeToLog={receta}>
          <Button variant="outline" size="icon" className="h-14 w-14 rounded-2xl shrink-0 border-2"><Calendar className="h-6 w-6" /></Button>
        </AddMealPlanDialog>
        <AddMealLogDialog date={format(new Date(), "yyyy-MM-dd")} recipeToLog={receta}>
          <Button className="flex-1 h-14 rounded-2xl bg-primary text-white font-black uppercase text-xs">
            <Activity className="h-4 w-4 mr-2" /> Registrar Macros
          </Button>
        </AddMealLogDialog>
      </div>
    </div>
  )
}

function RecipeSkeleton() {
  return <div className="flex flex-col gap-6 p-4"><Skeleton className="h-[280px] w-full rounded-3xl" /><Skeleton className="h-8 w-3/4" /><Skeleton className="h-32 w-full rounded-3xl" /></div>
}
