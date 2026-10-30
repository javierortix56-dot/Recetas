"use client"

import * as React from "react"
import { Search, Loader2, Check, Store } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { searchPrices } from "@/app/actions/prices"
import { SOURCE_LABEL, pricePerBaseUnit, type PriceOffer, type PriceRef } from "@/lib/prices/types"
import { cn, formatPrecio } from "@/lib/utils"

const offerKey = (o: PriceOffer) => `${o.source}:${o.ean || o.name}`

/** Cuántas palabras de la búsqueda aparecen en el nombre: ordena "Cebolla x kg" antes que "Papas sabor cebolla" */
function relevance(name: string, query: string): number {
  const n = name.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
  const words = query.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").split(/\s+/).filter(w => w.length > 1)
  const hits = words.filter(w => n.includes(w)).length
  return hits + (words[0] && n.startsWith(words[0]) ? 0.5 : 0)
}

/**
 * Busca un producto en todos los supermercados a la vez, muestra el precio
 * convertido a la unidad de la despensa y guarda el promedio de los que se
 * elijan. Los elegidos quedan vinculados para "Actualizar precios".
 */
export function PriceSearchDialog({ open, onOpenChange, initialQuery, baseUnit, onApply }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialQuery: string
  baseUnit: string
  onApply: (pricePerBase: number, refs: PriceRef[]) => void
}) {
  const [query, setQuery] = React.useState(initialQuery)
  const [offers, setOffers] = React.useState<PriceOffer[] | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  const run = React.useCallback(async (q: string) => {
    if (q.trim().length < 2) return
    setLoading(true)
    setSelected(new Set())
    try {
      setOffers(await searchPrices(q))
    } catch (e) {
      console.error(e)
      setOffers([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (open) {
      setQuery(initialQuery)
      setOffers(null)
      run(initialQuery)
    }
  }, [open, initialQuery, run])

  const rows = React.useMemo(() => (offers || [])
    .map(o => ({ o, key: offerKey(o), ppb: pricePerBaseUnit(o, baseUnit), rel: relevance(o.name, query) }))
    .sort((a, b) => b.rel - a.rel || Number(a.ppb === null) - Number(b.ppb === null) || (a.ppb ?? 0) - (b.ppb ?? 0)),
  [offers, baseUnit, query])

  const chosen = rows.filter(r => selected.has(r.key) && r.ppb !== null)
  const average = chosen.length ? chosen.reduce((s, r) => s + (r.ppb as number), 0) / chosen.length : 0

  const toggle = (row: (typeof rows)[number]) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(row.key)) {
      next.delete(row.key)
    } else {
      next.add(row.key)
      // Mismo código de barras en otros supermercados: se marca junto (es el mismo producto)
      if (row.o.ean) rows.forEach(r => { if (r.o.ean === row.o.ean && r.ppb !== null) next.add(r.key) })
    }
    return next
  })

  const apply = () => {
    onApply(average, chosen.map(r => ({ source: r.o.source, ean: r.o.ean, name: r.o.name })))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /> Precios en supermercados</DialogTitle>
          <DialogDescription>Coto, Carrefour, Día, Jumbo, Vea y ChangoMás. Elegí uno o varios: se guarda el promedio por {baseUnit}.</DialogDescription>
        </DialogHeader>

        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(query) }}>
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ej: arroz largo fino" className="pl-10" />
          </div>
          <Button type="submit" variant="secondary" className="h-11" disabled={loading}>Buscar</Button>
        </form>

        <div className="space-y-1.5 min-h-[240px]">
          {loading && (
            <div className="py-16 flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" /> Consultando 6 supermercados…
            </div>
          )}
          {!loading && offers?.length === 0 && (
            <p className="py-16 text-center text-sm text-muted-foreground">No se encontraron productos. Probá con otras palabras.</p>
          )}
          {!loading && rows.map(row => {
            const isOn = selected.has(row.key)
            const disabled = row.ppb === null
            return (
              <button
                key={row.key}
                type="button"
                disabled={disabled}
                onClick={() => toggle(row)}
                className={cn(
                  "w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition-colors",
                  isOn ? "bg-primary/10" : "hover:bg-foreground/[0.04]",
                  disabled && "opacity-45"
                )}
              >
                <span className={cn("h-5 w-5 shrink-0 rounded-md border-2 flex items-center justify-center", isOn ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40")}>
                  {isOn && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium leading-tight line-clamp-2">{row.o.name}</span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    <span className="font-semibold text-foreground/70">{SOURCE_LABEL[row.o.source]}</span> · {formatPrecio(row.o.price)} · {row.o.qty} {row.o.unit}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {disabled ? (
                    <span className="text-[10px] text-muted-foreground">no comparable<br />con {baseUnit}</span>
                  ) : (
                    <span className="text-sm font-bold tabular-nums">{formatPrecio(row.ppb as number)}<span className="text-[10px] font-medium text-muted-foreground">/{baseUnit}</span></span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-1 sheet-surface border-t border-hairline flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {chosen.length > 0 ? (
              <>
                <p className="text-[11px] text-muted-foreground">Promedio de {chosen.length}</p>
                <p className="text-lg font-bold tabular-nums leading-tight">{formatPrecio(average)}<span className="text-xs font-medium text-muted-foreground">/{baseUnit}</span></p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Elegí los productos que comprarías</p>
            )}
          </div>
          <Button onClick={apply} disabled={chosen.length === 0}>Usar precio</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
