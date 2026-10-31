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
import { syncShoppingList } from "@/lib/sync-logic"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

/** Unifica ingredientes duplicados de la despensa (vive en el menú de Despensa) */
export function IngredientMergerDialog({ asMenuItem }: { asMenuItem?: boolean } = {}) {
  const [open, setOpen] = React.useState(false)
  const [isAnalyzing, setIsAutoAnalyzing] = React.useState(false)
  const [isMerging, setIsMerging] = React.useState(false)
  const [suggestions, setSuggestions] = React.useState<any[]>([])
  const [selectedGroups, setSelectedGroups] = React.useState<Set<number>>(new Set())
  
  const db = useFirestore()
  const ingredientes = useAppStore(s => s.ingredientes)
  const recetas = useAppStore(s => s.recetas)

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
      // Ingredientes de cada receta con todos los renombres acumulados: antes cada
      // duplicado escribía la receta original y solo quedaba el último cambio
      const recipeIngs = new Map<string, any[]>()

      for (const group of groupsToProcess) {
        const mainName: string = group.mainName
        const duplicateNames: string[] = group.duplicates
        const mainIng = ingredientes.find(i => i.nombre.toLowerCase() === mainName.toLowerCase())
        const dups = ingredientes.filter(i => duplicateNames.includes(i.nombre) && i.id !== mainIng?.id)
        if (dups.length === 0) continue

        // Stock total: el del principal (si existe) más el de todos los duplicados
        const totalStock = (Number(mainIng?.stockActual) || 0) + dups.reduce((sum, d) => sum + (Number(d.stockActual) || 0), 0)

        if (mainIng) {
          batch.update(doc(db, "users", USER_ID, "ingredients", mainIng.id), { stockActual: totalStock, updatedAt: serverTimestamp() })
        } else {
          // No existe el principal: se crea a partir del primer duplicado, con el stock de todos
          const { id: _id, ...base } = dups[0]
          batch.set(doc(collection(db, "users", USER_ID, "ingredients")), { ...base, nombre: mainName, stockActual: totalStock, updatedAt: serverTimestamp() })
        }

        for (const dup of dups) {
          batch.delete(doc(db, "users", USER_ID, "ingredients", dup.id))
          recetas.forEach(recipe => {
            const current = recipeIngs.get(recipe.id) ?? recipe.ingredientes
            if (!current?.some((ing: any) => ing.nombre === dup.nombre)) return
            recipeIngs.set(recipe.id, current.map((ing: any) => (ing.nombre === dup.nombre ? { ...ing, nombre: mainName } : ing)))
          })
        }
      }

      recipeIngs.forEach((ingredientes, recipeId) => {
        batch.update(doc(db, "users", USER_ID, "recipes", recipeId), { ingredientes, updatedAt: serverTimestamp() })
      })

      await batch.commit()
      syncShoppingList(db).catch(() => {})
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
        {asMenuItem ? (
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
            <Sparkles /> Unificar duplicados con IA
          </DropdownMenuItem>
        ) : (
          <Button variant="outline" className="w-full">
            <Sparkles className="h-4 w-4" /> Unificar duplicados con IA
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
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
                className="rounded-2xl h-14 px-8 font-bold uppercase text-xs shadow-lg bg-primary"
              >
                Comenzar Análisis
              </Button>
            </div>
          )}

          {isAnalyzing && (
            <div className="py-20 text-center space-y-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
              <p className="text-[10px] font-bold uppercase text-primary tracking-[0.2em] animate-pulse">Pensando inteligentemente...</p>
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
                  className={` transition-all rounded-3xl overflow-hidden cursor-pointer ${selectedGroups.has(i) ? 'border-primary bg-primary/5' : 'border-border opacity-60'}`}
                  onClick={() => toggleGroup(i)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Nombre Principal</p>
                        <h4 className="text-lg font-bold text-primary leading-tight">{s.mainName}</h4>
                      </div>
                      <Checkbox checked={selectedGroups.has(i)} className="h-6 w-6 rounded-lg" />
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5">
                      {s.duplicates.map((d: string, j: number) => (
                        <Badge key={j} variant="secondary" className="bg-card border text-[9px] font-bold uppercase py-1 px-2">
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
              className="w-full h-14 rounded-2xl bg-primary text-white font-bold uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50"
              onClick={handleMerge}
              disabled={isMerging || selectedGroups.size === 0}
            >
              {isMerging ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Procesando...</>
              ) : (
                `Unificar ${selectedGroups.size} grupos`
              )}
            </Button>
            <Button variant="ghost" className="w-full text-[10px] font-bold uppercase text-muted-foreground" onClick={() => setSuggestions([])}>
              Cancelar y Volver
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
