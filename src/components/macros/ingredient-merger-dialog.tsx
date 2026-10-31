"use client"

import * as React from "react"
import { Sparkles, Loader2, AlertTriangle, BookOpen } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { useFirestore } from "@/firebase"
import { collection, getDocs, writeBatch, doc, serverTimestamp, type WriteBatch } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { USER_ID } from "@/lib/constants"
import { analyzeDuplicates } from "@/ai/flows/analyze-duplicates-flow"
import { useAppStore } from "@/store/app-store"
import { syncShoppingList } from "@/lib/sync-logic"
import { nameKey, renameIngredients, unidadesCompatibles } from "@/lib/ingredient-groups"
import { convertirCantidad } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

type Group = {
  mainName: string
  names: string[]
  excluded: Set<string>
  confidence: "alta" | "media"
  reason: string
  selected: boolean
}

/** Unifica ingredientes duplicados de la despensa y las recetas (vive en el menú de Despensa) */
export function IngredientMergerDialog({ asMenuItem }: { asMenuItem?: boolean } = {}) {
  const [open, setOpen] = React.useState(false)
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [isMerging, setIsMerging] = React.useState(false)
  const [groups, setGroups] = React.useState<Group[] | null>(null)

  const db = useFirestore()
  const ingredientes = useAppStore(s => s.ingredientes)
  const recetas = useAppStore(s => s.recetas)

  const pantryKeys = React.useMemo(() => new Set(ingredientes.map(i => nameKey(i.nombre))), [ingredientes])

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    try {
      // Despensa + ingredientes que solo aparecen en recetas, con dónde y cómo se usan
      type Item = { nombre: string; categoria?: string; unidad?: string; enDespensa: boolean; usos: string[] }
      const items = new Map<string, Item>()
      ingredientes.forEach(i => items.set(i.nombre, { nombre: i.nombre, categoria: i.categoria, unidad: i.unidad, enDespensa: true, usos: [] }))
      recetas.forEach(r => (r.ingredientes || []).forEach((ing: any) => {
        if (!ing?.nombre) return
        const item: Item = items.get(ing.nombre) ?? { nombre: ing.nombre, categoria: ing.categoria, unidad: ing.unidad, enDespensa: false, usos: [] }
        item.usos.push(ing.preparacion ? `${r.nombre} (${ing.preparacion})` : r.nombre)
        items.set(ing.nombre, item)
      }))
      const { suggestions } = await analyzeDuplicates({ items: Array.from(items.values()) })
      setGroups(suggestions.map(s => ({
        mainName: s.mainName,
        names: s.duplicates,
        excluded: new Set(),
        confidence: s.confidence,
        reason: s.reason,
        // Solo los seguros vienen marcados; las variantes se revisan una por una
        selected: s.confidence === "alta",
      })))
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "Error al analizar", description: "Revisá la conexión o la clave GEMINI_API_KEY." })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const update = (idx: number, patch: Partial<Group>) =>
    setGroups(gs => gs && gs.map((g, i) => (i === idx ? { ...g, ...patch } : g)))

  const toggleName = (idx: number, name: string) => {
    const g = groups![idx]
    const excluded = new Set(g.excluded)
    if (excluded.has(name)) excluded.delete(name)
    else excluded.add(name)
    update(idx, { excluded })
  }

  /** Nombres que se unifican; el grupo vale si quedan al menos dos productos distintos */
  const membersOf = (g: Group) => g.names.filter(n => !g.excluded.has(n))
  const isValid = (g: Group) => !!g.mainName.trim() && new Set([...membersOf(g), g.mainName].map(nameKey)).size > 1
  const toMerge = (groups || []).filter(g => g.selected && isValid(g))

  const handleMerge = async () => {
    if (!db || toMerge.length === 0) return
    setIsMerging(true)
    try {
      const ops: ((b: WriteBatch) => void)[] = []
      // Listas con todos los renombres acumulados (una receta puede tocar varios grupos)
      const recipeIngs = new Map<string, any[]>()
      const planIngs = new Map<string, any[]>()
      const plansSnap = await getDocs(collection(db, "users", USER_ID, "meal_plans"))
      const plans = plansSnap.docs.map(d => ({ ...(d.data() as any), id: d.id }))
      let skippedStock = 0

      for (const g of toMerge) {
        const mainName = g.mainName.trim()
        const keys = new Set([...membersOf(g), mainName].map(nameKey))
        const matches = ingredientes.filter(i => keys.has(nameKey(i.nombre)))

        // El que queda: el que ya se llama así, o el que tiene stock o precio
        const keeper =
          matches.find(i => i.nombre === mainName) ||
          matches.find(i => nameKey(i.nombre) === nameKey(mainName)) ||
          matches.find(i => Number(i.stockActual) > 0 || i.precioUnitario) ||
          matches[0]

        if (keeper) {
          let stock = Number(keeper.stockActual) || 0
          const extra: Record<string, any> = {}
          for (const dup of matches) {
            if (dup.id === keeper.id) continue
            const s = Number(dup.stockActual) || 0
            if (s > 0) {
              if (unidadesCompatibles(dup.unidad, keeper.unidad)) stock += convertirCantidad(s, dup.unidad, keeper.unidad, keeper.nombre)
              else skippedStock++
            }
            // Precio del duplicado si el que queda no tiene, en la misma unidad
            if (!keeper.precioUnitario && !extra.precioUnitario && dup.precioUnitario && unidadesCompatibles(dup.unidad, keeper.unidad)) {
              extra.precioUnitario = dup.precioUnitario / convertirCantidad(1, dup.unidad, keeper.unidad, keeper.nombre)
              if (dup.fuentesPrecio?.length) extra.fuentesPrecio = dup.fuentesPrecio
            }
            ops.push(b => b.delete(doc(db, "users", USER_ID, "ingredients", dup.id)))
          }
          const fields = { nombre: mainName, stockActual: +stock.toFixed(3), ...extra, updatedAt: serverTimestamp() }
          ops.push(b => b.update(doc(db, "users", USER_ID, "ingredients", keeper.id), fields))
        } else {
          // Solo existía en recetas: se crea en la despensa para que entre a la lista de compras
          const sample = recetas.flatMap(r => r.ingredientes || []).find((ing: any) => keys.has(nameKey(ing?.nombre)))
          const ref = doc(collection(db, "users", USER_ID, "ingredients"))
          ops.push(b => b.set(ref, {
            nombre: mainName, categoria: sample?.categoria || "Otros", unidad: sample?.unidad || "unidad",
            stockActual: 0, stockMinimo: 0, userId: USER_ID, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          }))
        }

        recetas.forEach(r => {
          const next = renameIngredients(recipeIngs.get(r.id) ?? r.ingredientes, keys, mainName)
          if (next) recipeIngs.set(r.id, next)
        })
        // Los planes guardan una copia de los ingredientes: sin esto la lista de compras seguía con el nombre viejo
        plans.forEach(p => {
          const next = renameIngredients(planIngs.get(p.id) ?? p.ingredientes, keys, mainName)
          if (next) planIngs.set(p.id, next)
        })
      }

      recipeIngs.forEach((list, id) => ops.push(b => b.update(doc(db, "users", USER_ID, "recipes", id), { ingredientes: list, updatedAt: serverTimestamp() })))
      planIngs.forEach((list, id) => ops.push(b => b.update(doc(db, "users", USER_ID, "meal_plans", id), { ingredientes: list })))

      // Firestore admite hasta 500 operaciones por batch
      for (let i = 0; i < ops.length; i += 450) {
        const batch = writeBatch(db)
        ops.slice(i, i + 450).forEach(op => op(batch))
        await batch.commit()
      }
      syncShoppingList(db).catch(() => {})
      toast({
        title: `${toMerge.length} ${toMerge.length === 1 ? "producto unificado" : "productos unificados"} ✓`,
        description: `${recipeIngs.size} recetas actualizadas.` + (skippedStock ? ` ${skippedStock} stock en otra unidad no se sumó.` : ""),
      })
      setOpen(false)
      setGroups(null)
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "Error al unificar" })
    } finally {
      setIsMerging(false)
    }
  }

  const recipesUsing = (g: Group) => {
    const keys = new Set(membersOf(g).map(nameKey))
    return recetas.filter(r => (r.ingredientes || []).some((i: any) => keys.has(nameKey(i?.nombre)))).length
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isMerging) setOpen(o) }}>
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
      <DialogContent className="flex flex-col overflow-hidden max-h-[88dvh] pb-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Unificar ingredientes</DialogTitle>
          <DialogDescription>
            Busca productos repetidos en la despensa y en las recetas. Al unificar se suma el stock y se renombra el ingrediente en recetas y planes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-5 px-5 py-2 space-y-3">
          {!groups && !isAnalyzing && (
            <div className="py-10 text-center space-y-5">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground px-6">
                Se revisarán {ingredientes.length} productos de la despensa y los ingredientes de {recetas.length} recetas.
              </p>
              <Button onClick={handleAnalyze} disabled={ingredientes.length + recetas.length === 0}>Buscar duplicados</Button>
            </div>
          )}

          {isAnalyzing && (
            <div className="py-16 flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" /> Analizando ingredientes…
            </div>
          )}

          {groups && !isAnalyzing && groups.length === 0 && (
            <p className="py-16 text-center text-sm text-muted-foreground">No se encontraron duplicados.</p>
          )}

          {groups && !isAnalyzing && groups.length > 0 && (
            <>
              <div className="flex gap-2.5 rounded-2xl bg-accent/10 p-3 text-[12px] leading-snug text-foreground/80">
                <AlertTriangle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <p>Los marcados como <b>Revisar</b> son variantes: confirmalos solo si los usás indistintamente. Tocá un nombre para dejarlo fuera del grupo.</p>
              </div>

              {groups.map((g, i) => {
                const valid = isValid(g)
                const n = recipesUsing(g)
                return (
                  <div key={i} className={cn("rounded-3xl border p-3.5 space-y-2.5 transition-colors", g.selected && valid ? "border-primary/60 bg-primary/5" : "border-hairline")}>
                    <div className="flex items-center gap-2.5">
                      <Checkbox checked={g.selected && valid} disabled={!valid} onCheckedChange={(c) => update(i, { selected: !!c })} className="h-5 w-5 rounded-md" />
                      <Input
                        value={g.mainName}
                        onChange={(e) => update(i, { mainName: e.target.value })}
                        className="h-9 flex-1 font-semibold"
                        aria-label="Nombre que queda"
                      />
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        g.confidence === "alta" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent")}>
                        {g.confidence === "alta" ? "Seguro" : "Revisar"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {g.names.map(name => {
                        const off = g.excluded.has(name)
                        const onlyRecipe = !pantryKeys.has(nameKey(name))
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => toggleName(i, name)}
                            className={cn("rounded-full border px-2.5 py-1 text-[12px] font-medium transition-opacity",
                              off ? "opacity-40 line-through" : "bg-card")}
                          >
                            {name}{onlyRecipe && <span className="text-muted-foreground"> · receta</span>}
                          </button>
                        )
                      })}
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {g.reason}
                      {n > 0 && <span className="inline-flex items-center gap-1 ml-1.5 font-medium"><BookOpen className="h-3 w-3" />{n} {n === 1 ? "receta" : "recetas"}</span>}
                    </p>
                  </div>
                )
              })}
            </>
          )}
        </div>

        {groups && groups.length > 0 && !isAnalyzing && (
          <div className="shrink-0 -mx-5 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-hairline flex gap-2">
            <Button variant="ghost" onClick={() => setGroups(null)} disabled={isMerging}>Volver</Button>
            <Button className="flex-1" onClick={handleMerge} disabled={isMerging || toMerge.length === 0}>
              {isMerging ? <><Loader2 className="h-4 w-4 animate-spin" /> Unificando…</> : `Unificar ${toMerge.length} ${toMerge.length === 1 ? "grupo" : "grupos"}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
