
"use client"

import * as React from "react"
import { Search, ChefHat, Activity } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { GradientPlaceholder } from "@/components/gradient-placeholder"
import { Card, CardContent } from "@/components/ui/card"
import { USER_ID } from "@/lib/constants"

const MOMENTOS = ["Desayuno", "Almuerzo", "Merienda", "Cena"]

export function AddMealLogDialog({ date, recipeToLog, children }: { date: string, recipeToLog?: any, children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const db = useFirestore()
  const [search, setSearch] = React.useState("")
  const [momento, setMomento] = React.useState("Almuerzo")
  const [portions, setPortions] = React.useState(1) // Default 1 porción consumida
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
      // Ajuste quirúrgico: registro individual siempre para 1 porción fija
      const calculatedMacros = {
        calorias: Math.round(Number(m.calorias || 0)),
        proteinas: Math.round(Number(m.proteinas || 0)),
        carbohidratos: Math.round(Number(m.carbohidratos || 0)),
        grasas: Math.round(Number(m.grasas || 0)),
        fibra: Math.round(Number(m.fibra || 0)),
      }

      const logData = {
        userId: USER_ID,
        date,
        momento,
        recetaId: recipe.id,
        recetaNombre: recipe.nombre,
        recetaCategoria: recipe.categoria || "Almuerzo",
        porciones: 1, // Consumo personal
        macros: calculatedMacros,
        createdAt: serverTimestamp()
      }

      await addDoc(collection(db, "users", USER_ID, "daily_logs"), logData)
      
      const summaryRef = doc(db, "users", USER_ID, "daily_macro_summaries", date)
      const summarySnap = await getDoc(summaryRef)
      
      if (summarySnap.exists()) {
        const d = summarySnap.data()
        const currentTotales = d.totalesDia || { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };
        
        await updateDoc(summaryRef, {
          "totalesDia.calorias": Number(currentTotales.calorias || 0) + calculatedMacros.calorias,
          "totalesDia.proteinas": Number(currentTotales.proteinas || 0) + calculatedMacros.proteinas,
          "totalesDia.carbohidratos": Number(currentTotales.carbohidratos || 0) + calculatedMacros.carbohidratos,
          "totalesDia.grasas": Number(currentTotales.grasas || 0) + calculatedMacros.grasas,
          updatedAt: serverTimestamp()
        })
      } else {
        await setDoc(summaryRef, {
          date,
          userId: USER_ID,
          totalesDia: calculatedMacros,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      }

      toast({ title: "Comida registrada ✓", description: `${recipe.nombre} agregado a ${momento}.` })
      setOpen(false)
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar la comida." })
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
            Para hoy, {date}
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
                    <div className="h-14 w-14 rounded-2xl overflow-hidden shrink-0">
                      <GradientPlaceholder categoria={recipeToLog.categoria} />
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

                <div className="bg-white p-5 rounded-3xl border-2 border-primary/5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="h-4 w-4 text-primary" />
                    <span className="text-[10px] font-black uppercase text-primary tracking-widest">Tus Macros (Consumidos)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-background p-3 rounded-2xl">
                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Calorías</p>
                      <p className="text-lg font-black text-primary leading-none">{Math.round(Number(recipeToLog.macros?.calorias || 0))} <span className="text-[8px]">kcal</span></p>
                    </div>
                    <div className="bg-background p-3 rounded-2xl">
                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Proteínas</p>
                      <p className="text-lg font-black text-primary leading-none">{Math.round(Number(recipeToLog.macros?.proteinas || 0))}g</p>
                    </div>
                    <div className="bg-background p-3 rounded-2xl">
                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Carbos</p>
                      <p className="text-lg font-black text-primary leading-none">{Math.round(Number(recipeToLog.macros?.carbohidratos || 0))}g</p>
                    </div>
                    <div className="bg-background p-3 rounded-2xl">
                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Grasas</p>
                      <p className="text-lg font-black text-primary leading-none">{Math.round(Number(recipeToLog.macros?.grasas || 0))}g</p>
                    </div>
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

                <div className="flex items-center justify-between bg-primary-suave p-3 rounded-2xl border border-primary/10">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">Tus Porciones</span>
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8 bg-white rounded-lg text-primary shadow-sm" onClick={() => setPortions(Math.max(1, portions - 1))}>-</Button>
                    <span className="font-black text-primary tabular-nums">{portions}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 bg-white rounded-lg text-primary shadow-sm" onClick={() => setPortions(portions + 1)}>+</Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
                  {filteredRecipes.map((recipe) => (
                    <Card 
                      key={recipe.id} 
                      className="border-none shadow-sm bg-background/50 hover:bg-primary/5 cursor-pointer transition-colors rounded-2xl active:scale-[0.98]"
                      onClick={() => handleSelectRecipe(recipe)}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl overflow-hidden shrink-0">
                          <GradientPlaceholder categoria={recipe.categoria} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm truncate leading-tight">{recipe.nombre}</h4>
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-0.5">
                            {recipe.macros?.calorias || 0} kcal / porc
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
