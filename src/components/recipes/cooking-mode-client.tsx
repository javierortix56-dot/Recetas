"use client"

import * as React from "react"
import { X, Timer, ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useDoc, useMemoFirebase, useFirestore } from "@/firebase"
import { doc } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { USER_ID } from "@/lib/constants"

export function CookingModeClient({ recipeId }: { recipeId: string }) {
  const router = useRouter()
  const db = useFirestore()
  const [currentStep, setCurrentStep] = React.useState(0)
  const [timeLeft, setTimeLeft] = React.useState<number | null>(null)
  const [isTimerRunning, setIsTimerRunning] = React.useState(false)

  const recipeRef = useMemoFirebase(() => {
    if (!db || !recipeId) return null
    return doc(db, "users", USER_ID, "recipes", recipeId)
  }, [db, recipeId])

  const { data: recipe, isLoading } = useDoc(recipeRef)

  React.useEffect(() => {
    let interval: any
    if (isTimerRunning && timeLeft !== null && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((prev) => (prev !== null ? prev - 1 : 0)), 1000)
    } else if (timeLeft === 0) {
      setIsTimerRunning(false)
      toast({ title: "¡Tiempo terminado!" })
    }
    return () => clearInterval(interval)
  }, [isTimerRunning, timeLeft])

  if (isLoading || !recipe) return <div className="h-screen flex items-center justify-center font-bold">Cargando modo cocina...</div>

  const step = recipe.pasos?.[currentStep]
  const progress = ((currentStep + 1) / (recipe.pasos?.length || 1)) * 100

  return (
    <div className="fixed inset-0 bg-white z-[100] flex flex-col animate-in slide-in-from-bottom duration-500 overflow-hidden">
      <div className="bg-primary text-white pt-10 pb-4 px-6 relative">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-black uppercase tracking-widest">{recipe.nombre} — {currentStep + 1}/{recipe.pasos?.length || 0}</span>
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/20 h-8 w-8"><X className="h-6 w-6" /></Button>
        </div>
        <Progress value={progress} className="h-2 bg-white/20" indicatorClassName="bg-white" />
      </div>

      <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center text-center gap-8 bg-background/30">
        <div className="space-y-4 max-w-md w-full">
          <Badge className="bg-primary-suave text-primary border-none h-8 px-4 font-black uppercase text-sm mb-2">Paso {currentStep + 1}</Badge>
          <h2 className="text-3xl font-black text-primary leading-tight">{step?.titulo}</h2>
          <p className="text-xl font-medium text-foreground leading-relaxed">{step?.descripcion}</p>
        </div>

        {step?.timerSegundos && (
          <div className="w-full max-w-xs bg-white rounded-3xl p-6 shadow-recipe border border-primary/10 flex flex-col items-center gap-4">
             <div className="flex items-center gap-3 text-primary font-black">
               <Timer className="h-8 w-8" />
               <span className="text-4xl tabular-nums">
                 {timeLeft !== null ? `${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2, '0')}` : `${Math.floor(step.timerSegundos/60)}:00`}
               </span>
             </div>
             <Button className="w-full h-14 rounded-2xl bg-primary text-white font-black uppercase" onClick={() => timeLeft === null ? setTimeLeft(step.timerSegundos) : setIsTimerRunning(!isTimerRunning)}>
               {isTimerRunning ? "Pausar" : timeLeft !== null && timeLeft > 0 ? "Reanudar" : "Iniciar Timer"}
             </Button>
          </div>
        )}
      </div>

      <div className="p-6 grid grid-cols-2 gap-4 bg-white border-t border-border safe-area-pb max-w-lg mx-auto w-full">
        <Button variant="outline" className="h-14 rounded-2xl border-2 font-black uppercase text-xs" disabled={currentStep === 0} onClick={() => {setCurrentStep(currentStep - 1); setTimeLeft(null); setIsTimerRunning(false)}}>
          <ChevronLeft className="h-5 w-5 mr-1" /> Anterior
        </Button>
        <Button className="h-14 rounded-2xl bg-primary text-white font-black uppercase text-xs" onClick={() => currentStep < (recipe.pasos?.length || 0) - 1 ? (setCurrentStep(currentStep + 1), setTimeLeft(null), setIsTimerRunning(false)) : router.back()}>
          {currentStep < (recipe.pasos?.length || 0) - 1 ? "Siguiente" : "Finalizar 🎉"}
        </Button>
      </div>
    </div>
  )
}
