"use client"

import * as React from "react"
import { Settings, Wrench, Database, Info, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import { useFirestore } from "@/firebase"
import { doc, updateDoc, serverTimestamp, getDocs, collection, writeBatch, setDoc, deleteDoc } from "firebase/firestore"
import { USER_ID } from "@/lib/constants"
import { categorizeIngredient, normalizeIngredientName } from "@/lib/categorizeIngredient"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/app-store"

export function GoalSettingsSheet({ currentGoals }: { currentGoals: any }) {
  const db = useFirestore()
  const activeProfile = useAppStore(s => s.activeProfile)
  const [goals, setGoals] = React.useState(currentGoals)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isRepairing, setIsRepairing] = React.useState(false)
  const [isResettingMin, setIsResettingMin] = React.useState(false)
  const [isSeeding, setIsSeeding] = React.useState(false)
  const [isOpen, setIsOpen] = React.useState(false)

  // Sincronizar estado local si cambian los props (al cambiar de perfil)
  React.useEffect(() => {
    setGoals(currentGoals)
  }, [currentGoals])

  const handleSave = async () => {
    if (!db) return
    setIsSaving(true)
    try {
      // Guardamos en el documento específico del perfil
      const profileRef = doc(db, "users", USER_ID, "profiles", activeProfile)
      await setDoc(profileRef, {
        displayName: activeProfile.charAt(0).toUpperCase() + activeProfile.slice(1),
        objetivosMacros: goals,
        updatedAt: serverTimestamp()
      }, { merge: true })
      
      toast({ title: "Objetivos guardados", description: `Metas de ${activeProfile} actualizadas.` })
      setIsOpen(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar los objetivos." })
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetMinStock = async () => {
    if (!db) return;
    setIsResettingMin(true);
    try {
      const batch = writeBatch(db);
      const ingredientsSnap = await getDocs(collection(db, "users", USER_ID, "ingredients"));
      
      ingredientsSnap.docs.forEach(d => {
        batch.update(d.ref, { stockMinimo: 0, updatedAt: serverTimestamp() });
      });

      await batch.commit();
      toast({ title: "Stock mínimo reseteado ✓", description: "Todos los ingredientes ahora requieren 0 por defecto." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error al resetear" });
    } finally {
      setIsResettingMin(false);
    }
  };

  const handleRepairCategories = async () => {
    if (!db) return;
    setIsRepairing(true);
    try {
      const batch = writeBatch(db);
      let updatedCount = 0;

      // 1. Reparar Ingredientes (Despensa)
      const ingredientsSnap = await getDocs(collection(db, "users", USER_ID, "ingredients"));
      const nameMap = new Map<string, any>(); 

      ingredientsSnap.docs.forEach(d => {
        const data = d.data();
        const originalName = data.nombre;
        const normalizedName = normalizeIngredientName(originalName);
        const cat = categorizeIngredient(normalizedName);
        
        if (nameMap.has(normalizedName)) {
          batch.delete(d.ref);
        } else {
          nameMap.set(normalizedName, d.id);
          batch.update(d.ref, { 
            nombre: normalizedName,
            categoria: cat, 
            stockMinimo: data.stockMinimo === 1 ? 0 : (data.stockMinimo ?? 0),
            updatedAt: serverTimestamp() 
          });
        }
        updatedCount++;
      });

      // 2. Reparar Recetas
      const recipesSnap = await getDocs(collection(db, "users", USER_ID, "recipes"));
      recipesSnap.docs.forEach(d => {
        const data = d.data();
        const m = data.macros || {};
        const cleanMacros = {
          calorias: Number(m.calorias || 0),
          proteinas: Number(m.proteinas || 0),
          carbohidratos: Number(m.carbohidratos || 0),
          grasas: Number(m.grasas || 0),
          fibra: Number(m.fibra || 0),
          azucar: Number(m.azucar || 0),
          sodio: Number(m.sodio || 0)
        };
        const cleanIngs = (data.ingredientes || []).map((ing: any) => ({
          ...ing,
          nombre: normalizeIngredientName(ing.nombre),
          categoria: categorizeIngredient(normalizeIngredientName(ing.nombre))
        }));
        batch.update(d.ref, { ingredientes: cleanIngs, macros: cleanMacros, updatedAt: serverTimestamp() });
      });

      // 3. Reparar Logs Diarios (para resúmenes)
      const logsSnap = await getDocs(collection(db, "users", USER_ID, "daily_logs"));
      const summariesMap = new Map<string, any>();
      logsSnap.docs.forEach(d => {
        const log = d.data();
        const date = log.date;
        const perfil = log.perfil || 'javi';
        const summaryId = `${date}_${perfil}`;

        if (!summariesMap.has(summaryId)) {
          summariesMap.set(summaryId, { 
            date,
            perfil,
            totalesDia: { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 } 
          });
        }
        const s = summariesMap.get(summaryId).totalesDia;
        
        s.calorias += Number(log.macros?.calorias || 0);
        s.proteinas += Number(log.macros?.proteinas || 0);
        s.carbohidratos += Number(log.macros?.carbohidratos || 0);
        s.grasas += Number(log.macros?.grasas || 0);
      });

      summariesMap.forEach((data, id) => {
        batch.set(doc(db, "users", USER_ID, "daily_macro_summaries", id), { ...data, userId: USER_ID, updatedAt: serverTimestamp() }, { merge: true });
      });

      await batch.commit();
      toast({ title: "Sincronización completa ✓", description: `Se procesaron ${updatedCount} ingredientes y se normalizaron nombres.` });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error al sincronizar" });
    } finally {
      setIsRepairing(false);
    }
  };

  const handleSeedData = async () => {
    if (!db) return;
    setIsSeeding(true);
    try {
      await setDoc(doc(db, "users", USER_ID, "profiles", activeProfile), {
        displayName: activeProfile.charAt(0).toUpperCase() + activeProfile.slice(1),
        objetivosMacros: { calorias: 2000, proteinas: 150, carbohidratos: 250, grasas: 65 },
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast({ title: "Perfil inicializado ✓" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full bg-primary-suave text-primary h-10 w-10">
          <Settings className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-[2rem] p-6 max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left font-black text-primary text-2xl">Ajustes de {activeProfile}</SheetTitle>
          <SheetDescription className="text-left text-xs font-bold text-muted-foreground uppercase tracking-widest pt-2">
            Gestioná tus metas individuales
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-8">
          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase text-primary tracking-widest">Metas Diarias</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Calorías (kcal)</label>
                <Input 
                  type="number" 
                  className="h-14 rounded-2xl border-2 font-black text-lg"
                  value={goals.calorias}
                  onChange={(e) => setGoals({...goals, calorias: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Proteínas (g)</label>
                <Input 
                  type="number" 
                  className="h-14 rounded-2xl border-2 font-black text-lg"
                  value={goals.proteinas}
                  onChange={(e) => setGoals({...goals, proteinas: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Carbos (g)</label>
                <Input 
                  type="number" 
                  className="h-14 rounded-2xl border-2 font-black text-lg"
                  value={goals.carbohidratos}
                  onChange={(e) => setGoals({...goals, carbohidratos: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Grasas (g)</label>
                <Input 
                  type="number" 
                  className="h-14 rounded-2xl border-2 font-black text-lg"
                  value={goals.grasas}
                  onChange={(e) => setGoals({...goals, grasas: Number(e.target.value)})}
                />
              </div>
            </div>

            <Button 
              onClick={handleSave}
              disabled={isSaving}
              className="w-full h-14 rounded-2xl bg-primary text-white font-black uppercase tracking-widest"
            >
              {isSaving ? "Guardando..." : "Guardar Objetivos"}
            </Button>
          </div>

          <Separator className="bg-primary/5" />

          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
              <Wrench className="h-4 w-4" /> Mantenimiento
            </h3>
            
            <div className="grid gap-3">
              <Button 
                variant="outline" 
                className="h-14 rounded-2xl justify-start gap-4 border-2 border-dashed"
                onClick={handleRepairCategories}
                disabled={isRepairing}
              >
                <Wrench className={cn("h-6 w-6 text-primary", isRepairing && "animate-spin")} />
                <div className="flex flex-col items-start">
                  <span className="font-bold text-sm">{isRepairing ? "Reparando..." : "Reparar y Sincronizar"}</span>
                  <span className="text-[8px] font-black uppercase opacity-60">Limpia datos y regenera resúmenes por perfil</span>
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="h-14 rounded-2xl justify-start gap-4 border-2 border-dashed border-accent/20"
                onClick={handleResetMinStock}
                disabled={isResettingMin}
              >
                <RotateCcw className={cn("h-6 w-6 text-accent", isResettingMin && "animate-spin")} />
                <div className="flex flex-col items-start">
                  <span className="font-bold text-sm">Resetear Stock Mínimo a 0</span>
                  <span className="text-[8px] font-black uppercase opacity-60">Establece 0 para todos los alimentos</span>
                </div>
              </Button>

              <Button 
                variant="ghost" 
                className="h-14 rounded-2xl justify-start gap-4 text-muted-foreground/50 hover:text-destructive"
                onClick={handleSeedData}
                disabled={isSeeding}
              >
                <Database className="h-6 w-6" />
                <div className="flex flex-col items-start">
                  <span className="font-bold text-sm">Resetear Metas Actuales</span>
                  <span className="text-[8px] font-black uppercase opacity-60">Reinicia metas de {activeProfile} a estándar</span>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}