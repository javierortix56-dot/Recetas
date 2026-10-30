"use client"

import * as React from "react"
import { X, Timer, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, ListChecks } from "lucide-react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { useAppStore } from "@/store/app-store"
import { spring } from "@/components/ui/motion"
import { cn } from "@/lib/utils"

/** Mantiene la pantalla encendida mientras se cocina (si el navegador lo permite) */
function useWakeLock() {
  React.useEffect(() => {
    let lock: any = null
    const request = async () => {
      try { lock = await (navigator as any).wakeLock?.request("screen") } catch { /* no soportado */ }
    }
    request()
    const onVisible = () => { if (document.visibilityState === "visible") request() }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      lock?.release?.().catch(() => {})
    }
  }, [])
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`

export function RecipeCookingClient({ recipeId }: { recipeId: string }) {
  const router = useRouter()
  const receta = useAppStore(s => s.recetas.find(r => r.id === recipeId))
  const [currentStep, setCurrentStep] = React.useState(0)
  const [dir, setDir] = React.useState(1)
  const [timeLeft, setTimeLeft] = React.useState<number | null>(null)
  const [isRunning, setIsRunning] = React.useState(false)
  const [showIngredients, setShowIngredients] = React.useState(false)

  useWakeLock()

  React.useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => setTimeLeft(t => (t !== null && t > 0 ? t - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [isRunning])

  React.useEffect(() => {
    if (timeLeft === 0 && isRunning) {
      setIsRunning(false)
      navigator.vibrate?.([300, 150, 300])
      toast({ title: "⏰ ¡Tiempo!", description: "Terminó el temporizador del paso." })
    }
  }, [timeLeft, isRunning])

  if (!receta) return <div className="h-[100dvh] flex items-center justify-center text-sm text-muted-foreground">Cargando modo cocina…</div>

  const pasos = receta.pasos || []
  const step = pasos[currentStep]
  const total = pasos.length || 1
  const isLast = currentStep >= pasos.length - 1
  const stepSeconds = Number(step?.timerSegundos) || 0

  const goTo = (i: number) => {
    setDir(i > currentStep ? 1 : -1)
    setCurrentStep(i)
    setTimeLeft(null)
    setIsRunning(false)
  }

  // Un solo toque arranca el timer (antes el primer toque solo lo cargaba)
  const toggleTimer = () => {
    if (timeLeft === null || timeLeft === 0) {
      setTimeLeft(stepSeconds)
      setIsRunning(true)
    } else {
      setIsRunning(r => !r)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background overflow-hidden">
      <header className="px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 space-y-3 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Paso {currentStep + 1} de {total}</p>
            <p className="text-sm font-semibold truncate mt-1">{receta.nombre}</p>
          </div>
          <div className="flex gap-1.5">
            <button aria-label="Ver ingredientes" onClick={() => setShowIngredients(v => !v)} className={cn("h-9 w-9 rounded-full glass flex items-center justify-center", showIngredients && "text-primary")}>
              <ListChecks className="h-4 w-4" />
            </button>
            <button aria-label="Salir del modo cocina" onClick={() => router.back()} className="h-9 w-9 rounded-full glass flex items-center justify-center">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex gap-1">
          {pasos.map((_: any, i: number) => (
            <button key={i} aria-label={`Ir al paso ${i + 1}`} onClick={() => goTo(i)} className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
              <motion.span className="block h-full bg-primary" initial={false} animate={{ width: i <= currentStep ? "100%" : "0%" }} transition={spring} />
            </button>
          ))}
        </div>
      </header>

      <AnimatePresence>
        {showIngredients && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden max-w-lg mx-auto w-full px-5">
            <div className="glass rounded-[20px] p-3 max-h-48 overflow-y-auto text-sm space-y-1">
              {(receta.ingredientes || []).map((ing: any, i: number) => (
                <div key={i} className="flex justify-between gap-3">
                  <span className="truncate first-letter:uppercase">{ing.nombre}</span>
                  <span className="text-muted-foreground tabular-nums shrink-0">{ing.cantidad} {ing.unidad}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col justify-center max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={currentStep}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            <h2 className="text-[30px] font-bold tracking-tight leading-tight">{step?.titulo || `Paso ${currentStep + 1}`}</h2>
            <p className="text-xl leading-relaxed text-foreground/85 whitespace-pre-wrap">{step?.descripcion}</p>

            {stepSeconds > 0 && (
              <div className="glass rounded-[24px] p-5 flex items-center gap-4 mt-6">
                <Timer className={cn("h-7 w-7 shrink-0", isRunning ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-4xl font-bold tabular-nums flex-1", timeLeft === 0 && "text-destructive")}>
                  {fmt(timeLeft ?? stepSeconds)}
                </span>
                {timeLeft !== null && timeLeft !== stepSeconds && (
                  <button aria-label="Reiniciar temporizador" onClick={() => { setTimeLeft(null); setIsRunning(false) }} className="h-11 w-11 rounded-full bg-foreground/[0.06] flex items-center justify-center">
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
                <button aria-label={isRunning ? "Pausar" : "Iniciar"} onClick={toggleTimer} className="h-12 w-12 rounded-full bg-brand text-white flex items-center justify-center shadow-glow active:scale-90">
                  {isRunning ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 max-w-lg mx-auto w-full">
        <div className="glass-strong rounded-[26px] p-2 grid grid-cols-2 gap-2">
          <Button variant="secondary" className="h-14" disabled={currentStep === 0} onClick={() => goTo(currentStep - 1)}>
            <ChevronLeft className="h-5 w-5" /> Anterior
          </Button>
          <Button className="h-14 bg-brand" onClick={() => (isLast ? router.back() : goTo(currentStep + 1))}>
            {isLast ? "Terminar 🎉" : <>Siguiente <ChevronRight className="h-5 w-5" /></>}
          </Button>
        </div>
      </div>
    </div>
  )
}
