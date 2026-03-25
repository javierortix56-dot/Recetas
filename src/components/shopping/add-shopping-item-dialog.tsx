"use client"

import * as React from "react"
import { Search, Package } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, addDoc, serverTimestamp } from "firebase/firestore"
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

  const ingredientsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "users", USER_ID, "ingredients"), orderBy("nombre", "asc"))
  }, [db])

  const { data: ingredients } = useCollection(ingredientsQuery)

  const filteredIngredients = React.useMemo(() => {
    if (!ingredients) return []
    return ingredients.filter(i => i.nombre.toLowerCase().includes(search.toLowerCase()))
  }, [ingredients, search])

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
        isPurchased: false,
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
      <DialogContent className="max-w-md rounded-3xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-primary">Agregar Manualmente</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 flex-1 flex flex-col overflow-hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Buscar ingrediente..." 
              className="pl-10 h-12 bg-white rounded-2xl border-2 border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between bg-primary-suave p-3 rounded-2xl border border-primary/10">
            <span className="text-xs font-black text-primary uppercase">Cantidad</span>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 bg-white rounded-lg text-primary" onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</Button>
              <span className="font-black text-primary">{quantity}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 bg-white rounded-lg text-primary" onClick={() => setQuantity(quantity + 1)}>+</Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredIngredients.map((item) => (
              <Card 
                key={item.id} 
                className="border-none shadow-sm bg-background/50 hover:bg-primary/5 cursor-pointer transition-colors rounded-2xl"
                onClick={() => handleSelectItem(item)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white border flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm truncate">{item.nombre}</h4>
                    <p className="text-[10px] font-black text-muted-foreground uppercase">{item.categoria}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredIngredients.length === 0 && search && (
               <Button 
                variant="outline" 
                className="w-full h-14 rounded-2xl border-2 border-dashed border-border"
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
