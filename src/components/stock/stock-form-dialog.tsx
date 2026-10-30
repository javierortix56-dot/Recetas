"use client"

import * as React from "react"
import { Plus, Calculator, Tag } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useFirestore } from "@/firebase"
import { collection, addDoc, serverTimestamp, getDocs, doc, updateDoc, query, where } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { USER_ID } from "@/lib/constants"
import { categorizeIngredient, normalizeIngredientName, IngredientCategory } from "@/lib/categorizeIngredient"
import { formatPrecio, calcularPrecioUnitarioBase } from "@/lib/utils"
import { syncShoppingList } from "@/lib/sync-logic"
import { useAppStore } from "@/store/app-store"

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

const UNITS = ["kg", "g", "l", "ml", "unidad", "docena"]

/**
 * Alta/edición de un ingrediente. Puede usarse con trigger propio o
 * controlado (open/onOpenChange) para tener UNA sola instancia por lista,
 * en vez de un diálogo montado por cada fila.
 */
export function StockFormDialog({ ingredientToEdit, trigger, open: openProp, onOpenChange }: {
  ingredientToEdit?: any
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [openState, setOpenState] = React.useState(false)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : openState
  const setOpen = (v: boolean) => { if (!controlled) setOpenState(v); onOpenChange?.(v) }
  const db = useFirestore()
  const activeProfile = useAppStore(s => s.activeProfile)
  const [isSaving, setIsSaving] = React.useState(false)

  const [calcPrecio, setCalcPrecio] = React.useState<number>(0)
  const [calcCantidad, setCalcCantidad] = React.useState<number>(1)
  const [calcUnidad, setCalcUnidad] = React.useState<string>("kg")

  const [formData, setFormData] = React.useState({
    nombre: "",
    categoria: "Almacén" as IngredientCategory,
    unidad: "unidad",
    stockActual: 0,
    stockMinimo: 0, 
    precioUnitario: 0,
    macrosPer100g: { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }
  })

  React.useEffect(() => {
    if (!open) return
    if (!ingredientToEdit) {
      setFormData({ nombre: "", categoria: "Almacén" as IngredientCategory, unidad: "unidad", stockActual: 0, stockMinimo: 0, precioUnitario: 0, macrosPer100g: { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 } })
      setCalcPrecio(0); setCalcCantidad(1); setCalcUnidad("kg")
      return
    }
    {
      setFormData({
        nombre: ingredientToEdit.nombre || "",
        categoria: (ingredientToEdit.categoria || categorizeIngredient(ingredientToEdit.nombre)) as IngredientCategory,
        unidad: ingredientToEdit.unidad || "unidad",
        stockActual: Number(ingredientToEdit.stockActual || 0),
        stockMinimo: Number(ingredientToEdit.stockMinimo ?? 0),
        precioUnitario: Number(ingredientToEdit.precioUnitario || 0),
        macrosPer100g: ingredientToEdit.macrosPer100g || { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }
      })
      if (ingredientToEdit.precioUnitario > 0) {
        setCalcPrecio(ingredientToEdit.precioUnitario)
        setCalcCantidad(1)
        setCalcUnidad(ingredientToEdit.unidad || "unidad")
      }
    }
  }, [ingredientToEdit, open])

  React.useEffect(() => {
    if (!open) return
    const unitario = calcularPrecioUnitarioBase(calcPrecio, calcCantidad, calcUnidad, formData.unidad)
    setFormData(prev => ({ ...prev, precioUnitario: unitario }))
  }, [open, calcPrecio, calcCantidad, calcUnidad, formData.unidad])

  const handleSave = async () => {
    if (!formData.nombre || !db) return
    setIsSaving(true)
    
    const normalizedName = normalizeIngredientName(formData.nombre);
    const finalData = {
      ...formData,
      nombre: normalizedName,
      categoria: formData.categoria
    };

    try {
      if (ingredientToEdit && ingredientToEdit.id) {
        await updateDoc(doc(db, "users", USER_ID, "ingredients", ingredientToEdit.id), {
          ...finalData,
          ultimaActualizacionPrecio: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      } else {
        const q = query(collection(db, "users", USER_ID, "ingredients"), where("nombre", "==", normalizedName));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          await updateDoc(doc(db, "users", USER_ID, "ingredients", snap.docs[0].id), {
            ...finalData,
            updatedAt: serverTimestamp()
          });
        } else {
          await addDoc(collection(db, "users", USER_ID, "ingredients"), {
            ...finalData,
            ultimaActualizacionPrecio: serverTimestamp(),
            userId: USER_ID,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })
        }
      }
      
      // La lista se recalcula en segundo plano (precio/stock/mínimo pueden cambiarla)
      syncShoppingList(db, activeProfile).catch(() => {});
      
      toast({ title: "Cambios guardados ✓" })
      setOpen(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger asChild>
          {trigger || (
            <Button size="icon" className="h-9 w-9 rounded-full" aria-label="Nuevo ingrediente">
              <Plus className="h-5 w-5" />
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" /> {ingredientToEdit?.id ? "Editar producto" : ingredientToEdit ? "Precio y stock" : "Nuevo producto"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <label className="eyebrow px-1">Nombre del producto</label>
            <Input 
              placeholder="Ej: Arroz Largo Fino" 
              className="h-12 rounded-xl font-bold"
              value={formData.nombre}
              onChange={(e) => setFormData({...formData, nombre: e.target.value})}
            />
          </div>

          <div className="space-y-3">
            <label className="eyebrow px-1">Categoría (Ubicación en Súper)</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <Badge 
                  key={cat} 
                  variant={formData.categoria === cat ? "default" : "outline"}
                  className={`px-3 py-2 rounded-xl cursor-pointer font-bold justify-center transition-all ${formData.categoria === cat ? "bg-primary text-white" : "border-primary/10 text-primary/60 hover:bg-primary/5"}`}
                  onClick={() => setFormData({...formData, categoria: cat})}
                >
                  <span className="text-[9px] uppercase tracking-tight">{cat}</span>
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="eyebrow px-1">Unidad base en Despensa</label>
            <div className="flex flex-wrap gap-2">
              {UNITS.map(unit => (
                <Badge 
                  key={unit} 
                  variant={formData.unidad === unit ? "default" : "outline"}
                  className={`px-3 py-1.5 rounded-xl cursor-pointer font-bold ${formData.unidad === unit ? "bg-primary text-white" : "border-primary/20 text-primary"}`}
                  onClick={() => setFormData({...formData, unidad: unit})}
                >
                  {unit}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-4 bg-primary-suave/30 p-5 rounded-[24px] border-primary/5">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="h-4 w-4 text-primary" />
              <label className="text-xs font-bold uppercase text-primary tracking-widest">Calculadora de Precio</label>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-muted-foreground uppercase px-1">Pagué ($)</span>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">$</span>
                  <Input 
                    type="number" 
                    className="h-12 rounded-xl pl-8 font-bold"
                    value={calcPrecio}
                    onChange={(e) => setCalcPrecio(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase px-1">Cantidad comprada</span>
                  <Input 
                    type="number" 
                    className="h-12 rounded-xl font-bold"
                    value={calcCantidad}
                    onChange={(e) => setCalcCantidad(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase px-1">Unidad</span>
                  <select 
                    className="w-full h-12 rounded-xl bg-card px-2 font-bold text-sm outline-none focus:border-primary transition-colors"
                    value={calcUnidad}
                    onChange={(e) => setCalcUnidad(e.target.value)}
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-primary/10 mt-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-bold text-primary uppercase">Precio resultante:</span>
                <span className="text-sm font-bold text-primary">{formatPrecio(formData.precioUnitario)} / {formData.unidad}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="eyebrow px-1">Stock Actual</label>
              <Input 
                type="number" 
                className="h-12 rounded-xl font-bold"
                value={formData.stockActual}
                onChange={(e) => setFormData({...formData, stockActual: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-2">
              <label className="eyebrow px-1">Stock Mínimo</label>
              <Input 
                type="number" 
                className="h-12 rounded-xl font-bold"
                value={formData.stockMinimo}
                onChange={(e) => setFormData({...formData, stockMinimo: Number(e.target.value)})}
              />
            </div>
          </div>

          <Button 
            className="w-full h-14 rounded-2xl bg-primary text-white font-bold uppercase tracking-widest shadow-lg active:scale-95 transition-all"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
