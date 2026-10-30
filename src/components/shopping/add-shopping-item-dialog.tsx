"use client"

import * as React from "react"
import { Search, Package } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useFirestore } from "@/firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { useAppStore } from "@/store/app-store"
import { toast } from "@/hooks/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { USER_ID } from "@/lib/constants"
import { categorizeIngredient } from "@/lib/categorizeIngredient"

export function AddShoppingItemDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const db = useFirestore()
  const [search, setSearch] = React.useState("")
  const [quantity, setQuantity] = React.useState(1)
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setSearch("")
      setQuantity(1)
    }
  }, [open])

  // Despensa desde el store (antes abría un listener propio por instancia)
  const ingredients = useAppStore(s => s.ingredientes)

  const filteredIngredients = React.useMemo(() => {
    if (!open) return []
    const q = search.toLowerCase().trim()
    return ingredients
      .filter(i => (i.nombre || "").toLowerCase().includes(q))
      .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"))
  }, [open, ingredients, search])

  const handleSelectItem = async (ingredient: any) => {
    if (!db) return
    setIsSaving(true)
    try {
      await addDoc(collection(db, "users", USER_ID, "shopping_list_items"), {
        userId: USER_ID,
        nombre: ingredient.nombre,
        cantidad: quantity,
        unidad: ingredient.unidad || "unidad",
        ingredienteId: ingredient.id,
        precioUnitario: Number(ingredient.precioUnitario) || 0,
        subtotal: (Number(ingredient.precioUnitario) || 0) * quantity,
        isPurchased: false,
        source: "manual",
        categoria: ingredient.categoria || categorizeIngredient(ingredient.nombre),
        reason: "Manual",
        createdAt: serverTimestamp()
      })
      toast({ title: "Agregado", description: `${ingredient.nombre} sumado a la lista.` })
      setOpen(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo agregar el item." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="flex flex-col">
        <DialogHeader>
          <DialogTitle>Agregar a la lista</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 flex flex-col">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Buscar ingrediente..." 
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between bg-primary-suave p-3 rounded-2xl border border-primary/10">
            <span className="text-xs font-bold text-primary uppercase">Cantidad</span>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 bg-card rounded-lg text-primary" onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</Button>
              <span className="font-bold text-primary">{quantity}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 bg-card rounded-lg text-primary" onClick={() => setQuantity(quantity + 1)}>+</Button>
            </div>
          </div>

          <div className="flex-1 space-y-1.5 min-h-[200px]">
            {filteredIngredients.map((item) => (
              <Card 
                key={item.id} 
                className="border-none shadow-sm bg-background/50 hover:bg-primary/5 cursor-pointer transition-colors rounded-2xl"
                onClick={() => handleSelectItem(item)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-card border flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm truncate">{item.nombre}</h4>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{item.categoria}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredIngredients.length === 0 && search && (
               <Button 
                variant="outline" 
                className="w-full h-14 rounded-2xl border-dashed border-border"
                onClick={() => handleSelectItem({ nombre: search, unidad: "unid", categoria: categorizeIngredient(search), id: null })}
               >
                 Agregar "{search}" como nuevo
               </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
