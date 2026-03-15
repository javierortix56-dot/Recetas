"use client"

import * as React from "react"
import { Sparkles, Loader2, Check, AlertTriangle, ArrowRight, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { useFirestore } from "@/firebase"
import { collection, getDocs, writeBatch, doc, serverTimestamp } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { USER_ID } from "@/lib/constants"
import { analyzeDuplicates } from "@/ai/flows/analyze-duplicates-flow"
import { useAppStore } from "@/store/app-store"

export function IngredientMergerDialog() {
  const [open, setOpen] = React.useState(false)
  const [isAnalyzing, setIsAutoAnalyzing] = React.useState(false)
  const [isMerging, setIsMerging] = React.useState(false)
  const [suggestions, setSuggestions] = React.useState<any[]>([])
  const [selectedGroups, setSelectedGroups] = React.useState<Set<number>>(new Set())
  
  const db = useFirestore()
  const { ingredientes, recetas } = useAppStore()

  const handleAnalyze = async () => {
    if (ingredientes.length === 0) return
    setIsAutoAnalyzing(true)
    try {
      const names = ingredientes.map(i => i.nombre)
      const result = await analyzeDuplicates({ ingredientNames: names })
      setSuggestions(result.suggestions || [])
      // Seleccionar todos por defecto
      setSelectedGroups(new Set((result.suggestions || []).map((_: any, i: number) => i)))
    } catch (e) {
      toast({ variant: "destructive", title: "Error al analizar" })
    } finally {
      setIsAutoAnalyzing(false)
    }
  }

  const handleMerge = async () => {
    if (!db) return
    setIsMerging(true)
    try {
      const batch = writeBatch(db)
      const groupsToProcess = suggestions.filter((_, i) => selectedGroups.has(i))

      for (const group of groupsToProcess) {
        const mainName = group.mainName
        const duplicateNames = group.duplicates

        // 1. Encontrar o crear el ingrediente principal
        let mainIng = ingredientes.find(i => i.nombre.toLowerCase() === mainName.toLowerCase())
        let mainRef: any

        if (!mainIng) {
          // Si no existe el principal, usamos el primero de los duplicados como base
          const firstDup = ingredientes.find(i => duplicateNames.includes(i.nombre))
          if (!firstDup) continue
          mainRef = doc(collection(db, "users", USER_ID, "ingredients"))
          batch.set(mainRef, {
            ...firstDup,
            nombre: mainName,
            updatedAt: serverTimestamp()
          })
        } else {
          mainRef = doc(db, "users", USER_ID, "ingredients", mainIng.id)
        }

        // 2. Procesar duplicados
        let totalExtraStock = 0
        for (const dupName of duplicateNames) {
          const dupIng = ingredientes.find(i => i.nombre === dupName)
          if (!dupIng || dupIng.id === mainIng?.id) continue

          totalExtraStock += (Number(dupIng.stockActual) || 0)
          
          // Eliminar ingrediente duplicado
          batch.delete(doc(db, "users", USER_ID, "ingredients", dupIng.id))

          // 3. Actualizar recetas que usen este ingrediente
          recetas.forEach(recipe => {
            const hasIng = recipe.ingredientes?.some((ing: any) => ing.nombre === dupName)
            if (hasIng) {
              const updatedIngs = recipe.ingredientes.map((ing: any) => 
                ing.nombre === dupName ? { ...ing, nombre: mainName } : ing
              )
              batch.update(doc(db, "users", USER_ID, "recipes", recipe.id), {
                ingredientes: updatedIngs,
                updatedAt: serverTimestamp()
              })
            }
          })
        }

        // 4. Sumar stock al principal
        if (mainIng) {
          batch.update(mainRef, {
            stockActual: (Number(mainIng.stockActual) || 0) + totalExtraStock,
            updatedAt: serverTimestamp()
          })
        }
      }

      await batch.commit()
      toast({ title: "Despensa unificada ✓", description: "Se actualizaron stock y recetas." })
      setOpen(false)
      setSuggestions([])
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "Error al unificar" })
    } finally {
      setIsMerging(false)
    }
  }

  const toggleGroup = (idx: number) => {
    const next = new Set(selectedGroups)
    if (next.has(idx)) next.delete(idx)
    else next.add(idx)
    setSelectedGroups(next)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full h-14 rounded-2xl gap-3 border-dashed border-2 border-primary/20 text-primary hover:bg-primary/5">
          <Sparkles className="h-5 w-5" />
          <span className="font-black uppercase text-[10px] tracking-widest">Limpieza de Despensa</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-[2.5rem] p-6 max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-primary flex items-center gap-2">
            <Sparkles className="h-6 w-6" /> Unificar Ingredientes
          </DialogTitle>
          <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest pt-2 leading-relaxed">
            La IA detectará productos repetidos y los unificará sumando su stock y actualizando tus recetas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-6 space-y-4 pr-1 scrollbar-hide">
          {suggestions.length === 0 && !isAnalyzing && (
            <div className="py-12 text-center space-y-6">
              <div className="h-20 w-20 bg-primary-suave rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-bold text-foreground">¿Tu despensa está desordenada?</p>
                <p className="text-[10px] font-medium text-muted-foreground uppercase leading-relaxed px-8">
                  Analizaremos tus {ingredientes.length} ingredientes para encontrar duplicados.
                </p>
              </div>
              <Button 
                onClick={handleAnalyze} 
                className="rounded-2xl h-14 px-8 font-black uppercase text-xs shadow-lg bg-primary"
              >
                Comenzar Análisis
              </Button>
            </div>
          )}

          {isAnalyzing && (
            <div className="py-20 text-center space-y-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
              <p className="text-[10px] font-black uppercase text-primary tracking-[0.2em] animate-pulse">Pensando inteligentemente...</p>
            </div>
          )}

          {suggestions.length > 0 && !isAnalyzing && (
            <div className="space-y-4">
              <div className="bg-accent/10 p-4 rounded-2xl border border-accent/20 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-accent shrink-0" />
                <p className="text-[9px] font-bold text-accent uppercase leading-tight">
                  Revisá las sugerencias. Al confirmar, se sumará el stock y se actualizarán los nombres en todas tus recetas.
                </p>
              </div>

              {suggestions.map((s, i) => (
                <Card 
                  key={i} 
                  className={`border-2 transition-all rounded-3xl overflow-hidden cursor-pointer ${selectedGroups.has(i) ? 'border-primary bg-primary/5' : 'border-border opacity-60'}`}
                  onClick={() => toggleGroup(i)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest leading-none">Nombre Principal</p>
                        <h4 className="text-lg font-black text-primary leading-tight">{s.mainName}</h4>
                      </div>
                      <Checkbox checked={selectedGroups.has(i)} className="h-6 w-6 rounded-lg border-2" />
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5">
                      {s.duplicates.map((d: string, j: number) => (
                        <Badge key={j} variant="secondary" className="bg-white border text-[9px] font-bold uppercase py-1 px-2">
                          {d}
                        </Badge>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-primary/5">
                      <p className="text-[9px] font-medium italic text-muted-foreground leading-tight">
                        "{s.reason}"
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="pt-4 space-y-3">
            <Button 
              className="w-full h-14 rounded-2xl bg-primary text-white font-black uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50"
              onClick={handleMerge}
              disabled={isMerging || selectedGroups.size === 0}
            >
              {isMerging ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Procesando...</>
              ) : (
                `Unificar ${selectedGroups.size} grupos`
              )}
            </Button>
            <Button variant="ghost" className="w-full text-[10px] font-black uppercase text-muted-foreground" onClick={() => setSuggestions([])}>
              Cancelar y Volver
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
