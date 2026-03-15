"use client"

import * as React from "react"
import { Tag, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useFirestore } from "@/firebase"
import { doc, writeBatch, serverTimestamp } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { USER_ID } from "@/lib/constants"
import { IngredientCategory } from "@/lib/categorizeIngredient"

const CATEGORIES: IngredientCategory[] = [
  "Lácteos y Huevos",
  "Carnes y Aves",
  "Pescados y Mariscos",
  "Frutas y Verduras",
  "Almacén",
  "Especias y Condimentos",
  "Bebidas",
  "Otros"
]

export function BulkCategoryDialog({ selectedIds, onSuccess }: { selectedIds: string[], onSuccess: () => void }) {
  const [open, setOpen] = React.useState(false)
  const db = useFirestore()
  const [isSaving, setIsSaving] = React.useState(false)
  const [selectedCategory, setSelectedCategory] = React.useState<IngredientCategory | null>(null)

  const handleBulkUpdate = async () => {
    if (!db || !selectedCategory || selectedIds.length === 0) return
    setIsSaving(true)
    
    try {
      const batch = writeBatch(db)
      selectedIds.forEach(id => {
        const ref = doc(db, "users", USER_ID, "ingredients", id)
        batch.update(ref, {
          categoria: selectedCategory,
          updatedAt: serverTimestamp()
        })
      })
      
      await batch.commit()
      toast({ title: "Categoría actualizada ✓", description: `Se actualizaron ${selectedIds.length} productos.` })
      setOpen(false)
      onSuccess()
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar en lote" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-white text-primary rounded-2xl h-12 px-6 font-black uppercase text-[10px] gap-2">
          <Tag className="h-4 w-4" /> Categoría
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-primary">Mover productos</DialogTitle>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">
            Cambiando {selectedIds.length} ingredientes a:
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(cat => (
              <Badge 
                key={cat} 
                variant={selectedCategory === cat ? "default" : "outline"}
                className={`px-3 py-3 rounded-xl cursor-pointer font-bold justify-center transition-all h-auto text-center ${selectedCategory === cat ? "bg-primary text-white" : "border-primary/10 text-primary/60 hover:bg-primary/5"}`}
                onClick={() => setSelectedCategory(cat)}
              >
                <span className="text-[9px] uppercase tracking-tight leading-tight">{cat}</span>
              </Badge>
            ))}
          </div>

          <Button 
            className="w-full h-14 rounded-2xl bg-primary text-white font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
            onClick={handleBulkUpdate}
            disabled={isSaving || !selectedCategory}
          >
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmar Cambio Masivo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
