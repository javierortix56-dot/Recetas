"use client"

import * as React from "react"
import { Plus, DollarSign, Calculator, Info, Tag } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useFirestore } from "@/firebase"
import { collection, addDoc, serverTimestamp, getDocs, writeBatch, doc, updateDoc, query, where } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { USER_ID } from "@/lib/constants"
import { categorizeIngredient, isSubPreparation, normalizeIngredientName, IngredientCategory } from "@/lib/categorizeIngredient"
import { convertirCantidad, normalizarUnidad, sugerirUnidadLogica, formatPrecio, calcularPrecioUnitarioBase } from "@/lib/utils"

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

export function StockFormDialog({ ingredientToEdit, trigger }: { ingredientToEdit?: any, trigger?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const db = useFirestore()
  const [isSaving, setIsSaving] = React.useState(false)

  // Estados para la calculadora de precios
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
    if (ingredientToEdit) {
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
    } else {
      setFormData({
        nombre: "",
        categoria: "Almacén",
        unidad: "unidad",
        stockActual: 0,
        stockMinimo: 0, 
        precioUnitario: 0,
        macrosPer100g: { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }
      })
      setCalcPrecio(0)
      setCalcCantidad(1)
      setCalcUnidad("kg")
    }
  }, [ingredientToEdit, open])

  React.useEffect(() => {
    const unitario = calcularPrecioUnitarioBase(calcPrecio, calcCantidad, calcUnidad, formData.unidad)
    setFormData(prev => ({ ...prev, precioUnitario: unitario }))
  }, [calcPrecio, calcCantidad, calcUnidad, formData.unidad])

  const syncGlobalState = async () => {
    if (!db) return;
    const [plansSnap, ingsSnap, shoppingSnap] = await Promise.all([
      getDocs(collection(db, "users", USER_ID, "meal_plans")),
      getDocs(collection(db, "users", USER_ID, "ingredients")),
      getDocs(collection(db, "users", USER_ID, "shopping_list_items"))
    ]);

    const allPlans = plansSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allIngredients = ingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const stockMap = new Map(allIngredients.map(ing => [(ing.nombre || "").toLowerCase().trim(), ing]));
    const neededMap = new Map<string, { nombre: string, cantidad: number, unidad: string, categoria: string }>();
    
    allPlans.forEach(plan => {
      const planPortions = Number(plan.plannedPortions) || 1;
      const originalPortions = Number(plan.recipeOriginalPortions) || 1;
      const scale = planPortions / originalPortions;

      (plan.ingredientes || []).forEach((ing: any) => {
        const nombreIng = (ing.nombre || "").toLowerCase().trim();
        if (!nombreIng || isSubPreparation(nombreIng)) return;
        
        const rawQty = (Number(ing.cantidad) || 0) * scale;
        const stockItem = stockMap.get(nombreIng);
        
        const convertedQty = stockItem 
          ? convertirCantidad(rawQty, ing.unidad, stockItem.unidad)
          : rawQty;

        const existing = neededMap.get(nombreIng);
        if (existing) {
          existing.cantidad += convertedQty;
        } else {
          neededMap.set(nombreIng, { 
            nombre: ing.nombre, 
            cantidad: convertedQty, 
            unidad: stockItem?.unidad || ing.unidad || "unid", 
            categoria: ing.categoria || categorizeIngredient(ing.nombre) 
          });
        }
      });
    });

    const batch = writeBatch(db);
    shoppingSnap.docs.forEach(d => { if (!d.data().isPurchased) batch.delete(d.ref); });
    
    const finalShoppingMap = new Map();

    allIngredients.forEach((ing: any) => {
      const nombreNorm = (ing.nombre || "").toLowerCase().trim();
      const planNeed = neededMap.get(nombreNorm)?.cantidad || 0;
      const minNeed = Number(ing.stockMinimo ?? 0);
      const enStock = Number(ing.stockActual || 0);
      const totalRequerido = Math.max(planNeed, minNeed);
      const faltante = totalRequerido - enStock;

      if (faltante > 0) {
        const precio = ing.precioUnitario || 0;
        const { cantidad: finalQty, unidad: finalUnit } = sugerirUnidadLogica(ing.nombre, faltante, ing.unidad);
        
        finalShoppingMap.set(nombreNorm, {
          nombre: ing.nombre,
          cantidad: Number(finalQty.toFixed(2)),
          unidad: finalUnit,
          categoria: ing.categoria || categorizeIngredient(ing.nombre),
          ingredienteId: ing.id,
          precioUnitario: precio,
          subtotal: precio * faltante
        });
      }
    });

    neededMap.forEach((data, nombreNorm) => {
      if (!finalShoppingMap.has(nombreNorm) && !stockMap.has(nombreNorm)) {
        const { cantidad: finalQty, unidad: finalUnit } = sugerirUnidadLogica(data.nombre, data.cantidad, data.unidad);
        finalShoppingMap.set(nombreNorm, {
          ...data,
          cantidad: Number(finalQty.toFixed(2)),
          unidad: finalUnit,
          ingredienteId: "",
          precioUnitario: 0,
          subtotal: 0
        });
      }
    });

    finalShoppingMap.forEach((data) => {
      const ref = doc(collection(db, "users", USER_ID, "shopping_list_items"));
      batch.set(ref, { userId: USER_ID, ...data, isPurchased: false, createdAt: serverTimestamp() });
    });

    await batch.commit();
  };

  const handleSave = async () => {
    if (!formData.nombre || !db) return
    setIsSaving(true)
    
    const normalizedName = normalizeIngredientName(formData.nombre);
    const finalData = {
      ...formData,
      nombre: normalizedName,
      // La categoría ahora viene del estado local (seleccionada por el usuario)
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
        // Buscar si ya existe por nombre para no duplicar si vino de la lista de compras
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
      
      await syncGlobalState();
      
      toast({ title: "Cambios guardados ✓", description: "Se recordará para futuros usos." })
      setOpen(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (ingredientToEdit ? (
          <Button variant="ghost" size="sm" className="text-primary font-black uppercase text-[10px] h-7 px-2">Editar</Button>
        ) : (
          <Button className="h-12 w-12 rounded-full p-0 bg-primary shadow-lg">
            <Plus className="h-6 w-6 text-white" />
          </Button>
        ))}
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-3xl p-6 overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-primary flex items-center gap-2">
            <Tag className="h-6 w-6" /> {ingredientToEdit ? "Editar" : "Nuevo"} Alimento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Nombre del producto</label>
            <Input 
              placeholder="Ej: Arroz Largo Fino" 
              className="h-12 rounded-xl border-2 font-bold"
              value={formData.nombre}
              onChange={(e) => setFormData({...formData, nombre: e.target.value})}
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Categoría (Ubicación en Súper)</label>
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
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Unidad base en Despensa</label>
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

          <div className="space-y-4 bg-primary-suave/30 p-5 rounded-[2rem] border-2 border-primary/5">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="h-4 w-4 text-primary" />
              <label className="text-xs font-black uppercase text-primary tracking-widest">Calculadora de Precio</label>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <span className="text-[9px] font-black text-muted-foreground uppercase px-1">Pagué ($)</span>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">$</span>
                  <Input 
                    type="number" 
                    className="h-12 rounded-xl border-2 pl-8 font-bold"
                    value={calcPrecio}
                    onChange={(e) => setCalcPrecio(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-[9px] font-black text-muted-foreground uppercase px-1">Cantidad comprada</span>
                  <Input 
                    type="number" 
                    className="h-12 rounded-xl border-2 font-bold"
                    value={calcCantidad}
                    onChange={(e) => setCalcCantidad(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[9px] font-black text-muted-foreground uppercase px-1">Unidad</span>
                  <select 
                    className="w-full h-12 rounded-xl border-2 bg-white px-2 font-bold text-sm outline-none focus:border-primary transition-colors"
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
                <span className="text-[10px] font-black text-primary uppercase">Precio resultante:</span>
                <span className="text-sm font-black text-primary">{formatPrecio(formData.precioUnitario)} / {formData.unidad}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Stock Actual</label>
              <Input 
                type="number" 
                className="h-12 rounded-xl border-2 font-bold"
                value={formData.stockActual}
                onChange={(e) => setFormData({...formData, stockActual: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Stock Mínimo</label>
              <Input 
                type="number" 
                className="h-12 rounded-xl border-2 font-bold"
                value={formData.stockMinimo}
                onChange={(e) => setFormData({...formData, stockMinimo: Number(e.target.value)})}
              />
            </div>
          </div>

          <Button 
            className="w-full h-14 rounded-2xl bg-primary text-white font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
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
