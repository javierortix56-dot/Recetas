"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, addDoc, serverTimestamp, query, orderBy, doc, getDoc, setDoc, updateDoc, writeBatch, getDocs } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { GradientPlaceholder } from "@/components/gradient-placeholder"
import { Card, CardContent } from "@/components/ui/card"
import { USER_ID } from "@/lib/constants"
import { categorizeIngredient, isSubPreparation } from "@/lib/categorizeIngredient"
import { convertirCantidad, sugerirUnidadLogica } from "@/lib/utils"
import { useAppStore } from "@/store/app-store"

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

  const syncGlobalState = async () => {
    if (!db) return;
    const [plansSnap, ingsSnap, shoppingSnap] = await Promise.all([
      getDocs(collection(db, "users", USER_ID, "meal_plans")),
      getDocs(collection(db, "users", USER_ID, "ingredients")),
      getDocs(collection(db, "users", USER_ID, "shopping_list_items"))
    ]);

    const allPlans = plansSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allIngredients = ingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const stockMap = new Map(allIngredients.map(ing => [(ing.nombre || "").toLowerCase().trim(), ing]));
    const neededMap = new Map<string, { nombre: string, cantidad: number, unidad: string, categoria: string }>();
    
    allPlans.forEach(plan => {
      const planPortions = Number(plan.plannedPortions) || 1;
      const originalPortions = Number(plan.recipeOriginalPortions) || 1;
      const scale = planPortions / originalPortions;

      (plan.ingredientes || []).forEach((ing: any) => {
        const nombreIng = (ing.nombre || "").toLowerCase().trim();
        if (!nombreIng || isSubPreparation(nombreIng)) return;
        
        const rawQty = (Number(ing.cantidad) || 0) * scale;
        const stockItem = stockMap.get(nombreIng);
        
        const convertedQty = stockItem 
          ? convertirCantidad(rawQty, ing.unidad, stockItem.unidad)
          : rawQty;

        const existing = neededMap.get(nombreIng);
        if (existing) {
          existing.cantidad += convertedQty;
        } else {
          neededMap.set(nombreIng, { 
            nombre: ing.nombre, 
            cantidad: convertedQty, 
            unidad: stockItem?.unidad || ing.unidad || "unid", 
            categoria: ing.categoria || categorizeIngredient(ing.nombre) 
          });
        }
      });
    });

    const batch = writeBatch(db);
    shoppingSnap.docs.forEach(d => { if (!d.data().isPurchased) batch.delete(d.ref); });
    
    const finalShoppingMap = new Map();

    allIngredients.forEach((ing: any) => {
      const nombreNorm = (ing.nombre || "").toLowerCase().trim();
      const planNeed = neededMap.get(nombreNorm)?.cantidad || 0;
      const minNeed = Number(ing.stockMinimo ?? 0);
      const enStock = Number(ing.stockActual || 0);
      const totalRequerido = Math.max(planNeed, minNeed);
      const faltante = totalRequerido - enStock;

      if (faltante > 0) {
        const precio = ing.precioUnitario || 0;
        const { cantidad: finalQty, unidad: finalUnit } = sugerirUnidadLogica(ing.nombre, faltante, ing.unidad);
        
        finalShoppingMap.set(nombreNorm, {
          nombre: ing.nombre,
          cantidad: Number(finalQty.toFixed(2)),
          unidad: finalUnit,
          categoria: ing.categoria || categorizeIngredient(ing.nombre),
          ingredienteId: ing.id,
          precioUnitario: precio,
          subtotal: precio * faltante
        });
      }
    });

    neededMap.forEach((data, nombreNorm) => {
      if (!finalShoppingMap.has(nombreNorm) && !stockMap.has(nombreNorm)) {
        const { cantidad: finalQty, unidad: finalUnit } = sugerirUnidadLogica(data.nombre, data.cantidad, data.unidad);
        finalShoppingMap.set(nombreNorm, {
          ...data,
          cantidad: Number(finalQty.toFixed(2)),
          unidad: finalUnit,
          ingredienteId: "",
          precioUnitario: 0,
          subtotal: 0
        });
      }
    });

    finalShoppingMap.forEach((data) => {
      const ref = doc(collection(db, "users", USER_ID, "shopping_list_items"));
      batch.set(ref, { userId: USER_ID, ...data, isPurchased: false, createdAt: serverTimestamp() });
    });

    await batch.commit();
  };

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

      const planData = {
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
      }

      const batch = writeBatch(db);
      const planRef = doc(collection(db, "users", USER_ID, "meal_plans"));
      batch.set(planRef, planData);

      // El log de macros también es individual
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

      await batch.commit();

      const summaryId = `${dateStr}_${activeProfile}`
      const summaryRef = doc(db, "users", USER_ID, "daily_macro_summaries", summaryId);
      const summarySnap = await getDoc(summaryRef);
      
      if (summarySnap.exists()) {
        const d = summarySnap.data();
        const currentTotales = d.totalesDia || { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };
        
        await updateDoc(summaryRef, {
          "totalesDia.calorias": Number(currentTotales.calorias || 0) + macrosIndividuales.calorias,
          "totalesDia.proteinas": Number(currentTotales.proteinas || 0) + macrosIndividuales.proteinas,
          "totalesDia.carbohidratos": Number(currentTotales.carbohidratos || 0) + macrosIndividuales.carbohidratos,
          "totalesDia.grasas": Number(currentTotales.grasas || 0) + macrosIndividuales.grasas,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(summaryRef, {
          date: dateStr,
          userId: USER_ID,
          perfil: activeProfile,
          totalesDia: macrosIndividuales,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      await syncGlobalState();
      
      toast({ title: "Planificado ✓", description: `Agregado a ${momento} de ${activeProfile}` })
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
            {filteredRecipes.map((recipe) => (
              <Card key={recipe.id} className="border-none shadow-sm bg-background/50 hover:bg-primary/5 cursor-pointer transition-colors rounded-2xl" onClick={() => handleSelectRecipe(recipe)}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl overflow-hidden shrink-0"><GradientPlaceholder categoria={recipe.categoria} /></div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm truncate">{recipe.nombre}</h4>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{recipe.macros?.calorias || 0} kcal / porc</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}