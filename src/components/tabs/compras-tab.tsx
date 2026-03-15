'use client';

import * as React from 'react';
import { Check, Package, ArrowUpCircle, DollarSign, Info, AlertTriangle, RefreshCcw, Tag, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { SwipeToDelete } from "@/components/ui/swipe-to-delete";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { doc, updateDoc, writeBatch, serverTimestamp, getDoc, collection, deleteDoc, getDocs, setDoc, query, where } from "firebase/firestore";
import { useAppStore } from '@/store/app-store';
import { USER_ID } from '@/lib/constants';
import { format } from 'date-fns';
import { categorizeIngredient, isSubPreparation } from '@/lib/categorizeIngredient';
import { cn, formatPrecio, convertirCantidad, sugerirUnidadLogica, normalizarUnidad } from '@/lib/utils';
import { StockFormDialog } from '@/components/stock/stock-form-dialog';

export function ComprasTab() {
  const db = useFirestore();
  const { listaCompras, listaComprasCargada, optimisticToggleCompra, planificacion, ingredientes } = useAppStore();
  const [isUpdatingStock, setIsUpdatingStock] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);

  const totalEstimado = React.useMemo(() => {
    return listaCompras
      .filter(i => !i.isPurchased)
      .reduce((sum, item) => sum + (item.subtotal || 0), 0);
  }, [listaCompras]);

  const itemsSinPrecio = React.useMemo(() => {
    return listaCompras.filter(i => !i.isPurchased && (!i.precioUnitario || i.precioUnitario === 0)).length;
  }, [listaCompras]);

  const syncGlobalState = async () => {
    if (!db) return;
    setIsSyncing(true);
    try {
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
          const nombreNorm = (ing.nombre || "").toLowerCase().trim();
          if (!nombreNorm || isSubPreparation(nombreNorm)) return;
          
          const rawQty = (Number(ing.cantidad) || 0) * scale;
          const stockItem = stockMap.get(nombreNorm);
          
          const convertedQty = stockItem 
            ? convertirCantidad(rawQty, ing.unidad, stockItem.unidad)
            : rawQty;

          const existing = neededMap.get(nombreNorm);
          if (existing) {
            existing.cantidad += convertedQty;
          } else {
            neededMap.set(nombreNorm, { 
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
      toast({ title: "Sincronizado con el plan ✓" });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error al sincronizar" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateStock = async () => {
    if (!db) return;
    const purchased = listaCompras.filter(i => i.isPurchased);
    if (purchased.length === 0) return;
    
    setIsUpdatingStock(true);
    try {
      const batch = writeBatch(db);
      let realTotalSpent = 0;
      const itemsCompradosDetalle: any[] = [];

      for (const item of purchased) {
        if (item.ingredienteId) {
          const ingRef = doc(db, "users", USER_ID, "ingredients", item.ingredienteId);
          const snap = await getDoc(ingRef);
          if (snap.exists()) {
            const data = snap.data();
            const current = Number(data.stockActual) || 0;
            const cantASumar = convertirCantidad(Number(item.cantidad), item.unidad, data.unidad);
            batch.update(ingRef, { stockActual: current + cantASumar, updatedAt: serverTimestamp() });
          }
        }
        
        realTotalSpent += (item.subtotal || 0);
        itemsCompradosDetalle.push({
          nombre: item.nombre,
          cantidad: item.cantidad,
          unidad: item.unidad,
          precioUnitario: item.precioUnitario || 0,
          subtotal: item.subtotal || 0
        });

        batch.delete(doc(db, "users", USER_ID, "shopping_list_items", item.id));
      }

      const weekId = format(new Date(), "yyyy-'W'ww");
      const historyRef = doc(db, "users", USER_ID, "historial_compras", weekId);
      const historySnap = await getDoc(historyRef);
      
      if (historySnap.exists()) {
        const existingData = historySnap.data();
        batch.update(historyRef, {
          totalGastado: (existingData.totalGastado || 0) + realTotalSpent,
          itemsComprados: [...(existingData.itemsComprados || []), ...itemsCompradosDetalle],
          updatedAt: serverTimestamp()
        });
      } else {
        batch.set(historyRef, {
          semana: weekId,
          totalGastado: realTotalSpent,
          itemsComprados: itemsCompradosDetalle,
          creadoEn: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
      await syncGlobalState();
      toast({ title: "Stock actualizado ✓", description: `Se sumaron los productos a tu despensa.` });
    } catch (e) { 
      toast({ variant: "destructive", title: "Error" }); 
    } finally { 
      setIsUpdatingStock(false); 
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "users", USER_ID, "shopping_list_items", id));
      toast({ title: "Ítem eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al borrar" });
    }
  };

  const toggleItem = (id: string, current: boolean) => {
    if (!db) return;
    optimisticToggleCompra(id);
    updateDoc(doc(db, "users", USER_ID, "shopping_list_items", id), { 
      isPurchased: !current, 
      purchasedAt: !current ? serverTimestamp() : null 
    });
  };

  if (!listaComprasCargada && listaCompras.length === 0) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-3xl" />
        ))}
      </div>
    );
  }

  const groupedItems: Record<string, any[]> = {};
  listaCompras.forEach(item => {
    const cat = (item.categoria || "Otros").toUpperCase();
    if (!groupedItems[cat]) groupedItems[cat] = [];
    groupedItems[cat].push(item);
  });
  
  const categories = Object.keys(groupedItems).sort();

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500 pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-primary leading-tight">Compras</h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">
            {listaCompras.filter(i => i.isPurchased).length} de {listaCompras.length} en el carrito
          </p>
        </div>
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={syncGlobalState} disabled={isSyncing} className="h-10 w-10 bg-primary-suave text-primary rounded-full">
                  <RefreshCcw className={cn("h-5 w-5", isSyncing && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Recalcular desde el Plan</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button 
            onClick={handleUpdateStock} 
            disabled={!listaCompras.some(i => i.isPurchased) || isUpdatingStock} 
            className="bg-primary text-white rounded-2xl h-10 font-black uppercase text-[10px] px-6 gap-2"
          >
            <ArrowUpCircle className="h-4 w-4" />
            {isUpdatingStock ? "..." : "Terminar"}
          </Button>
        </div>
      </header>

      {listaCompras.length > 0 && (
        <Card className="border-none shadow-sm bg-primary-suave/50 rounded-3xl overflow-hidden border-2 border-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-2xl font-black text-primary leading-none">{formatPrecio(totalEstimado)} <span className="text-[10px] font-bold opacity-60 uppercase">Estimado</span></p>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-muted-foreground uppercase">{listaCompras.filter(i => !i.isPurchased).length} ítems pendientes</span>
                {itemsSinPrecio > 0 && (
                  <div className="flex items-center gap-1 text-accent font-black text-[9px] uppercase">
                    <AlertTriangle className="h-3 w-3" /> {itemsSinPrecio} sin precio
                  </div>
                )}
              </div>
            </div>
            <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
      )}

      {listaCompras.length > 0 ? (
        <Accordion type="multiple" defaultValue={categories} className="space-y-2">
          {categories.map((category) => (
            <AccordionItem key={category} value={category} className="border-none">
              <AccordionTrigger className="flex hover:no-underline bg-white px-4 py-2.5 rounded-2xl border border-border shadow-sm mb-1 transition-all">
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-primary" />
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-black uppercase text-primary tracking-tight">{category}</span>
                    <span className="text-[8px] font-black text-muted-foreground uppercase">{groupedItems[category].length} productos</span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-0 space-y-0.5 px-0 bg-background/50 rounded-b-2xl overflow-hidden border-x border-b">
                {groupedItems[category].map((item) => (
                  <SwipeToDelete key={item.id} onDelete={() => handleDeleteItem(item.id)}>
                    <div className="p-3 px-4 flex items-center gap-4 bg-white border-b border-border/50 group">
                      <Checkbox checked={item.isPurchased} onCheckedChange={() => toggleItem(item.id, item.isPurchased)} className="h-6 w-6 rounded-lg border-2" />
                      <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm truncate ${item.isPurchased ? 'line-through text-muted-foreground' : ''}`}>
                              {item.nombre}
                            </span>
                            {!item.isPurchased && (
                              <StockFormDialog 
                                ingredientToEdit={{
                                  id: item.ingredienteId,
                                  nombre: item.nombre,
                                  categoria: item.categoria,
                                  unidad: item.unidad,
                                  precioUnitario: item.precioUnitario
                                }}
                                trigger={
                                  <button className="p-1.5 rounded-lg bg-primary-suave text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Tag className="h-3 w-3" />
                                  </button>
                                }
                              />
                            )}
                          </div>
                          <span className="text-[9px] font-black text-muted-foreground uppercase">{item.cantidad.toLocaleString('es-ES', { maximumFractionDigits: 2 })} {item.unidad}</span>
                        </div>
                        <div className="text-right shrink-0">
                          {item.precioUnitario > 0 ? (
                            <p className="text-xs font-black text-primary">{formatPrecio(item.subtotal)}</p>
                          ) : (
                            <p className="text-[9px] font-bold text-muted-foreground opacity-40">$ —</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </SwipeToDelete>
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className="py-24 text-center space-y-4">
          <div className="bg-primary-suave w-24 h-24 rounded-full flex items-center justify-center mx-auto">
            <Check className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-2xl font-black text-primary">¡Lista vacía!</h2>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Planificá una receta para ver qué ingredientes te faltan.</p>
        </div>
      )}
    </div>
  );
}
