'use client';

import * as React from 'react';
import { Package, ArrowUpCircle, DollarSign, AlertTriangle, RefreshCcw, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { SwipeToDelete } from "@/components/ui/swipe-to-delete";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { doc, updateDoc, writeBatch, serverTimestamp, getDoc, collection, deleteDoc } from "firebase/firestore";
import { useAppStore } from '@/store/app-store';
import { USER_ID } from '@/lib/constants';
import { format } from 'date-fns';
import { cn, formatPrecio, convertirCantidad } from '@/lib/utils';
import { StockFormDialog } from '@/components/stock/stock-form-dialog';
import { syncShoppingList } from '@/lib/sync-logic';

export function ComprasTab() {
  const db = useFirestore();
  const { listaCompras, listaComprasCargada, optimisticToggleCompra } = useAppStore();
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

  const handleSync = async () => {
    if (!db) return;
    setIsSyncing(true);
    try {
      await syncShoppingList(db);
      toast({ title: "Sincronizado con el plan ✓" });
    } catch (e) {
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
      await syncShoppingList(db);
      toast({ title: "Stock actualizado ✓" });
    } catch (e) { 
      toast({ variant: "destructive", title: "Error al actualizar stock" }); 
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
                <Button variant="ghost" size="icon" onClick={handleSync} disabled={isSyncing} className="h-10 w-10 bg-primary-suave text-primary rounded-full">
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
            <Package className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-2xl font-black text-primary">¡Lista vacía!</h2>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Planificá una receta para ver qué ingredientes te faltan.</p>
        </div>
      )}
    </div>
  );
}
