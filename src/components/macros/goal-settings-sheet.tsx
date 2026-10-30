"use client"

import * as React from "react"
import { Settings, Activity, Target, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HeaderButton } from "@/components/ui/page-header"
import { ThemeSelector } from "@/components/theme-toggle"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { useFirestore } from "@/firebase"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { USER_ID } from "@/lib/constants"
import { useAppStore } from "@/store/app-store"

export function GoalSettingsSheet({ currentGoals }: { currentGoals: any }) {
  const db = useFirestore()
  const activeProfile = useAppStore(s => s.activeProfile)
  const [goals, setGoals] = React.useState(currentGoals)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isOpen, setIsOpen] = React.useState(false)

  // Sincronizar estado local si cambian los objetivos en el store (al cambiar de perfil)
  React.useEffect(() => {
    setGoals(currentGoals)
  }, [currentGoals])

  const handleSave = async () => {
    if (!db) return
    setIsSaving(true)
    try {
      // Guardamos los objetivos en el documento específico del perfil activo
      const profileRef = doc(db, "users", USER_ID, "profiles", activeProfile)
      await setDoc(profileRef, {
        displayName: activeProfile.charAt(0).toUpperCase() + activeProfile.slice(1),
        objetivosMacros: goals,
        updatedAt: serverTimestamp()
      }, { merge: true })
      
      toast({ 
        title: "Metas actualizadas ✓", 
        description: `Los objetivos de ${activeProfile} se guardaron correctamente.` 
      })
      setIsOpen(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar", description: "No se pudieron actualizar los objetivos." })
    } finally {
      setIsSaving(false)
    }
  }

  const handleQuickSet = (type: 'bulking' | 'cutting' | 'maintenance') => {
    const templates = {
      bulking: { calorias: 2800, proteinas: 180, carbohidratos: 350, grasas: 75 },
      cutting: { calorias: 1800, proteinas: 160, carbohidratos: 150, grasas: 50 },
      maintenance: { calorias: 2200, proteinas: 150, carbohidratos: 250, grasas: 65 }
    }
    setGoals(templates[type])
    toast({ title: "Template aplicado", description: "No olvides darle a Guardar." })
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <HeaderButton label="Metas y ajustes"><Settings /></HeaderButton>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-2xl ${activeProfile === 'javi' ? 'bg-primary text-white' : 'bg-accent text-white'}`}>
              {activeProfile === 'javi' ? '🧔‍♂️' : '👩🏻‍🦰'}
            </div>
            <div className="text-left">
              <SheetTitle className="font-bold text-xl leading-none tracking-tight">Metas de {activeProfile === 'mary' ? 'Mary' : 'Javi'}</SheetTitle>
              <SheetDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                Configurá tus parámetros individuales
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-8">
          <section className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase text-primary tracking-widest flex items-center gap-2">
                <Target className="h-4 w-4" /> Tus Objetivos Diarios
              </h3>
              <div className="flex gap-1">
                <Button variant="ghost" className="h-6 px-2 text-[8px] font-bold uppercase bg-primary/5 text-primary rounded-lg" onClick={() => handleQuickSet('bulking')}>Volumen</Button>
                <Button variant="ghost" className="h-6 px-2 text-[8px] font-bold uppercase bg-primary/5 text-primary rounded-lg" onClick={() => handleQuickSet('cutting')}>Definición</Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="eyebrow px-2">Calorías (kcal)</label>
                <div className="relative">
                  <Activity className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40" />
                  <Input 
                    type="number" 
                    className="h-14 rounded-2xl font-bold text-lg pl-10 focus-visible:ring-primary"
                    value={goals.calorias}
                    onChange={(e) => setGoals({...goals, calorias: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="eyebrow px-2">Proteínas (g)</label>
                <Input 
                  type="number" 
                  className="h-14 rounded-2xl font-bold text-lg focus-visible:ring-primary"
                  value={goals.proteinas}
                  onChange={(e) => setGoals({...goals, proteinas: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <label className="eyebrow px-2">Carbos (g)</label>
                <Input 
                  type="number" 
                  className="h-14 rounded-2xl font-bold text-lg focus-visible:ring-primary"
                  value={goals.carbohidratos}
                  onChange={(e) => setGoals({...goals, carbohidratos: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <label className="eyebrow px-2">Grasas (g)</label>
                <Input 
                  type="number" 
                  className="h-14 rounded-2xl font-bold text-lg focus-visible:ring-primary"
                  value={goals.grasas}
                  onChange={(e) => setGoals({...goals, grasas: Number(e.target.value)})}
                />
              </div>
            </div>

            <Button 
              onClick={handleSave}
              disabled={isSaving}
              className="w-full h-14 rounded-2xl bg-primary text-white font-bold uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all"
            >
              {isSaving ? "Guardando..." : "Confirmar Objetivos"}
            </Button>
          </section>

          <section className="space-y-3 pb-4">
            <p className="eyebrow px-1">Apariencia</p>
            <ThemeSelector />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
