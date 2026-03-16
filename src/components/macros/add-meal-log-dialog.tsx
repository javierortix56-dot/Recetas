"use client"

import * as React from "react"
import { Search, ChefHat, Activity } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, addDoc, serverTimestamp, doc, writeBatch, increment } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { GradientPlaceholder } from "@/components/gradient-placeholder"
import { Card, CardContent } from "@/components/ui/card"
import { USER_ID } from "@/lib/constants"
import { useAppStore } from "@/store/app-store"
import { getSafeImageSource } from "@/lib/utils"
import Image from "next/image"

const MOMENTOS = ["Desayuno", "Almuerzo", "Merienda", "Cena"]

export function AddMealLogDialog({ date, recipeToLog, children }: { date: string, recipeToLog?: any, children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const db = useFirestore()
  const activeProfile = useAppStore(s => s.activeProfile)
  const [search, setSearch] = React.useState("")
  const [momento, setMomento] = React.useState("Almuerzo")
  const [portions, setPortions] = React.useState(1)
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
      const m = recipe.macros || {};
      const macrosCalculados = {
        calorias: Math.round(Number(m.calorias || 0)),
        proteinas: Math.round(Number(m.proteinas || 0)),
        carbohidratos: Math.round(Number(m.carbohidratos || 0)),
        grasas: Math.round(Number(m.grasas || 0)),
      }

      const batch = writeBatch(db);
      
      // 1. Registro individual
      const logRef = doc(collection(db, "users", USER_ID, "daily_logs"));
      batch.set(logRef, {
        userId: USER_ID,
        perfil: activeProfile,
        date,
        momento,
        recetaId: recipe.id,
        recetaNombre: recipe.nombre,
        recetaCategoria: recipe.categoria || "Almuerzo",
        porciones: portions, 
        macros: macrosCalculados,
        createdAt: serverTimestamp()
      });

      // 2. Resumen diario atómico
      const summaryId = `${date}_${activeProfile}`
      const summaryRef = doc(db, "users", USER_ID, "daily_macro_summaries", summaryId)
      
      batch.set(summaryRef, {
        date,
        userId: USER_ID,
        perfil: activeProfile,
        totalesDia: {
          calorias: increment(macrosCalculados.calorias * portions),
          proteinas: increment(macrosCalculados.proteinas * portions),
          carbohidratos: increment(macrosCalculados.carbohidratos * portions),
          grasas: increment(macrosCalculados.grasas * portions)
        },
        updatedAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();
      toast({ title: `Comida registrada para ${activeProfile} ✓` })
      setOpen(false)
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-3xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-primary">Registrar Comida</DialogTitle>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">
            {activeProfile} · {date}
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4 flex-1 flex flex-col overflow-hidden">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-2">Momento del día</label>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide px-2">
              {MOMENTOS.map((m) => (
                <Badge 
                  key={m} 
                  variant={momento === m ? "default" : "secondary"}
                  className={`px-4 py-2 rounded-full cursor-pointer font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all ${momento === m ? 'bg-primary text-white' : 'bg-primary-suave text-primary border-none'}`}
                  onClick={() => setMomento(m)}
                >
                  {m}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-4 flex-1 flex flex-col overflow-hidden px-2">
            {recipeToLog ? (
              <div className="space-y-6">
                <Card className="border-none shadow-sm bg-primary-suave/50 rounded-2xl overflow-hidden">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl overflow-hidden shrink-0 relative bg-muted">
                      {getSafeImageSource(recipeToLog) ? (
                        <Image src={getSafeImageSource(recipeToLog)!} alt={recipeToLog.nombre} fill className="object-cover" unoptimized />
                      ) : (
                        <GradientPlaceholder categoria={recipeToLog.categoria} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-lg truncate text-primary leading-tight">{recipeToLog.nombre}</h4>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{recipeToLog.categoria}</p>
                    </div>
                  </CardContent>
                </Card>
                
                <div className="flex items-center justify-between bg-primary-suave p-4 rounded-2xl border border-primary/10">
                  <span className="text-xs font-black text-primary uppercase tracking-widest">Tus Porciones</span>
                  <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" className="h-10 w-10 bg-white rounded-xl text-primary shadow-sm" onClick={() => setPortions(Math.max(1, portions - 1))}>-</Button>
                    <span className="font-black text-xl text-primary tabular-nums">{portions}</span>
                    <Button variant="ghost" size="icon" className="h-10 w-10 bg-white rounded-xl text-primary shadow-sm" onClick={() => setPortions(portions + 1)}>+</Button>
                  </div>
                </div>

                <Button 
                  className="w-full h-14 rounded-2xl bg-primary text-white font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                  onClick={() => handleSelectRecipe(recipeToLog)}
                  disabled={isSaving}
                >
                  {isSaving ? "Registrando..." : "Confirmar Registro"}
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar receta..." 
                    className="pl-10 h-12 bg-white rounded-2xl border-2 border-border font-bold"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
                  {filteredRecipes.map((recipe) => {
                    const imageSource = getSafeImageSource(recipe);
                    return (
                      <Card 
                        key={recipe.id} 
                        className="border-none shadow-sm bg-background/50 hover:bg-primary/5 cursor-pointer transition-colors rounded-2xl active:scale-[0.98]"
                        onClick={() => handleSelectRecipe(recipe)}
                      >
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl overflow-hidden shrink-0 relative bg-muted">
                            {imageSource ? (
                              <Image src={imageSource} alt={recipe.nombre} fill className="object-cover" unoptimized />
                            ) : (
                              <GradientPlaceholder categoria={recipe.categoria} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm truncate leading-tight">{recipe.nombre}</h4>
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-0.5">
                              {recipe.macros?.calorias || 0} kcal / porc
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
