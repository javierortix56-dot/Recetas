"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, serverTimestamp, query, orderBy, doc, writeBatch, increment } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { GradientPlaceholder } from "@/components/gradient-placeholder"
import { Card, CardContent } from "@/components/ui/card"
import { USER_ID } from "@/lib/constants"
import { useAppStore } from "@/store/app-store"
import { syncShoppingList } from "@/lib/sync-logic"
import { getSafeImageSource } from "@/lib/utils"
import Image from "next/image"

interface AddMealPlanDialogProps {
  date: Date
  momento: string
  recipeToLog?: any
  children: React.ReactNode
  onSave?: () => void
}

const MOMENTOS = ["Desayuno", "Almuerzo", "Merienda", "Cena"]

export function AddMealPlanDialog({ date, momento: defaultMomento, recipeToLog, children, onSave }: AddMealPlanDialogProps) {
  const [open, setOpen] = React.useState(false)
  const db = useFirestore()
  const activeProfile = useAppStore(s => s.activeProfile)
  const [search, setSearch] = React.useState("")
  const [momento, setMomento] = React.useState(defaultMomento)
  const [portions, setPortions] = React.useState(3)
  const [isSaving, setIsSaving] = React.useState(false)

  const recipesQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "users", USER_ID, "recipes"), orderBy("nombre", "asc"))
  }, [db])

  const { data: recipes } = useCollection(recipesQuery)

  const filteredRecipes = React.useMemo(() => {
    if (!recipes) return []
    return recipes.filter(r => (r.nombre || "").toLowerCase().includes(search.toLowerCase()))
  }, [recipes, search])

  const handleSelectRecipe = async (recipe: any) => {
    if (!db) return
    setIsSaving(true)
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const m = recipe.macros || {};
      
      const macrosIndividuales = {
        calorias: Math.round(Number(m.calorias || 0)),
        proteinas: Math.round(Number(m.proteinas || 0)),
        carbohidratos: Math.round(Number(m.carbohidratos || 0)),
        grasas: Math.round(Number(m.grasas || 0)),
        fibra: Math.round(Number(m.fibra || 0)),
      };

      const batch = writeBatch(db);
      const planRef = doc(collection(db, "users", USER_ID, "meal_plans"));
      
      // 1. Guardar Plan
      batch.set(planRef, {
        userId: USER_ID,
        perfil: activeProfile,
        date: dateStr,
        mealType: momento,
        recipeId: recipe.id,
        recipeName: recipe.nombre,
        recipeCategory: recipe.categoria || "Almuerzo",
        recipeImageUrl: recipe.fotoURL || recipe.imageUrl || null,
        plannedPortions: portions,
        recipeOriginalPortions: recipe.porciones || 1,
        macros: macrosIndividuales, 
        ingredientes: recipe.ingredientes || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. Crear Log Diario
      batch.set(doc(collection(db, "users", USER_ID, "daily_logs")), {
        userId: USER_ID,
        perfil: activeProfile,
        date: dateStr,
        momento: momento,
        recetaId: recipe.id,
        recetaNombre: recipe.nombre,
        recetaCategoria: recipe.categoria || "Almuerzo",
        porciones: 1, 
        macros: macrosIndividuales,
        planId: planRef.id,
        createdAt: serverTimestamp()
      });

      // 3. Actualizar Resumen usando increment()
      const summaryId = `${dateStr}_${activeProfile}`
      const summaryRef = doc(db, "users", USER_ID, "daily_macro_summaries", summaryId)
      
      batch.set(summaryRef, {
        date: dateStr,
        userId: USER_ID,
        perfil: activeProfile,
        totalesDia: {
          calorias: increment(macrosIndividuales.calorias),
          proteinas: increment(macrosIndividuales.proteinas),
          carbohidratos: increment(macrosIndividuales.carbohidratos),
          grasas: increment(macrosIndividuales.grasas)
        },
        updatedAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();
      await syncShoppingList(db);
      
      toast({ title: "Planificado ✓" })
      setOpen(false)
      if (onSave) onSave()
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "Error al planificar" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md rounded-3xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-primary">Planificar {momento}</DialogTitle>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Para el {format(date, "d 'de' MMMM", { locale: es })} · {activeProfile}</p>
        </DialogHeader>
        <div className="space-y-6 py-4 flex-1 flex flex-col overflow-hidden">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-foreground">Momento</label>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {MOMENTOS.map((m) => (
                <Badge key={m} variant={momento === m ? "default" : "secondary"} className={`px-4 py-2 rounded-full cursor-pointer font-bold ${momento === m ? 'bg-primary text-white' : 'bg-primary-suave text-primary border-none'}`} onClick={() => setMomento(m)}>{m}</Badge>
              ))}
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input placeholder="Buscar receta..." className="pl-10 h-12 bg-white rounded-2xl border-2 border-border font-bold" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center justify-between bg-primary-suave p-3 rounded-2xl border border-primary/10">
            <span className="text-xs font-black text-primary uppercase">Porciones a cocinar</span>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 bg-white rounded-lg text-primary shadow-sm" onClick={() => setPortions(Math.max(1, portions - 1))}>-</Button>
              <span className="font-black text-primary tabular-nums">{portions}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 bg-white rounded-lg text-primary shadow-sm" onClick={() => setPortions(portions + 1)}>+</Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
            {filteredRecipes.map((recipe) => {
              const imageSource = getSafeImageSource(recipe);
              return (
                <Card key={recipe.id} className="border-none shadow-sm bg-background/50 hover:bg-primary/5 cursor-pointer transition-colors rounded-2xl" onClick={() => handleSelectRecipe(recipe)}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl overflow-hidden shrink-0 relative bg-muted">
                      {imageSource ? (
                        <Image src={imageSource} alt={recipe.nombre} fill className="object-cover" unoptimized />
                      ) : (
                        <GradientPlaceholder categoria={recipe.categoria} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm truncate">{recipe.nombre}</h4>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{recipe.macros?.calorias || 0} kcal / porc</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
