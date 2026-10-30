'use client';

import * as React from 'react';
import { AlertTriangle, RefreshCcw, ChevronDown, Plus, ShoppingCart, MoreHorizontal, Trash2, CheckSquare, X, PackageCheck, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { doc, updateDoc, writeBatch, serverTimestamp, getDoc, collection, deleteDoc } from "firebase/firestore";
import { useShallow } from 'zustand/react/shallow';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { SwipeToDelete } from "@/components/ui/swipe-to-delete";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader, HeaderButton, EmptyState } from '@/components/ui/page-header';
import { easeOut, spring } from '@/components/ui/motion';
import { StockFormDialog } from '@/components/stock/stock-form-dialog';
import { AddShoppingItemDialog } from '@/components/shopping/add-shopping-item-dialog';
import { toast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { useAppStore } from '@/store/app-store';
import { USER_ID } from '@/lib/constants';
import { format } from 'date-fns';
import { cn, formatPrecio, convertirCantidad } from '@/lib/utils';
import { syncShoppingList } from '@/lib/sync-logic';

const isManualItem = (i: any) => i.source === "manual" || i.reason === "Manual";

export function ComprasTab() {
  const db = useFirestore();
  const { listaCompras, listaComprasCargada, optimisticToggleCompra, activeProfile, ingredientes } = useAppStore(useShallow(s => ({
    listaCompras: s.listaCompras,
    listaComprasCargada: s.listaComprasCargada,
    optimisticToggleCompra: s.optimisticToggleCompra,
    activeProfile: s.activeProfile,
    ingredientes: s.ingredientes,
  })));
  const [isUpdatingStock, setIsUpdatingStock] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  // Categorías contraídas (por defecto todas abiertas: es una lista para usar en el súper)
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [priceItem, setPriceItem] = React.useState<any>(null);
  const hasSyncedRef = React.useRef(false);

  const manualItems = React.useMemo(() => listaCompras.filter(isManualItem), [listaCompras]);

  // Recalcula la lista la primera vez que se abre la pestaña (limpia ítems viejos)
  React.useEffect(() => {
    if (!db || hasSyncedRef.current) return;
    hasSyncedRef.current = true;
    setIsSyncing(true);
    syncShoppingList(db, activeProfile).catch(() => {}).finally(() => setIsSyncing(false));
  }, [db, activeProfile]);

  const { groups, categories, pending, purchasedCount, totalEstimado, sinPrecio } = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    let total = 0, sinPrecio = 0, purchased = 0;
    listaCompras.forEach(item => {
      const cat = item.categoria || "Otros";
      (groups[cat] ||= []).push(item);
      if (item.isPurchased) purchased++;
      else {
        total += item.subtotal || 0;
        if (!item.precioUnitario) sinPrecio++;
      }
    });
    // Pendientes primero, después alfabético
    Object.values(groups).forEach(list => list.sort((a, b) =>
      Number(!!a.isPurchased) - Number(!!b.isPurchased) || (a.nombre || "").localeCompare(b.nombre || "", "es")
    ));
    return {
      groups,
      categories: Object.keys(groups).sort((a, b) => a.localeCompare(b, "es")),
      pending: listaCompras.length - purchased,
      purchasedCount: purchased,
      totalEstimado: total,
      sinPrecio,
    };
  }, [listaCompras]);

  const toggleCollapsed = (cat: string) => setCollapsed(prev => {
    const next = new Set(prev);
    next.has(cat) ? next.delete(cat) : next.add(cat);
    return next;
  });

  const toggleSelection = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const exitSelectionMode = () => { setIsSelectionMode(false); setSelectedIds(new Set()); };

  const handleSync = async () => {
    if (!db) return;
    setIsSyncing(true);
    try {
      await syncShoppingList(db, activeProfile);
      toast({ title: "Lista recalculada con el plan ✓" });
    } catch {
      toast({ variant: "destructive", title: "Error al sincronizar" });
    } finally {
      setIsSyncing(false);
    }
  };

  /** Suma lo tildado al stock, registra el gasto de la semana y saca esos ítems de la lista */
  const handleFinishPurchase = async () => {
    if (!db) return;
    const purchased = listaCompras.filter(i => i.isPurchased);
    if (purchased.length === 0) return;

    setIsUpdatingStock(true);
    try {
      const batch = writeBatch(db);
      const ingredientsById = new Map(ingredientes.map(i => [i.id, i]));
      let realTotalSpent = 0;
      const itemsCompradosDetalle: any[] = [];

      for (const item of purchased) {
        const ing = item.ingredienteId ? ingredientsById.get(item.ingredienteId) : null;
        if (ing) {
          const current = Number(ing.stockActual) || 0;
          const cantASumar = convertirCantidad(Number(item.cantidad), item.unidad, ing.unidad);
          const newStock = current + cantASumar;
          batch.update(doc(db, "users", USER_ID, "ingredients", ing.id), { stockActual: newStock, updatedAt: serverTimestamp() });
          batch.set(doc(collection(db, "users", USER_ID, "stock_historial")), {
            ingredienteId: ing.id,
            ingredienteNombre: item.nombre,
            tipo: 'compra',
            cantidadAntes: current,
            cantidadDespues: newStock,
            diferencia: cantASumar,
            unidad: ing.unidad,
            fecha: serverTimestamp(),
          });
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
        const existing = historySnap.data();
        batch.update(historyRef, {
          totalGastado: (existing.totalGastado || 0) + realTotalSpent,
          itemsComprados: [...(existing.itemsComprados || []), ...itemsCompradosDetalle],
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
      syncShoppingList(db, activeProfile).catch(() => {});
      toast({ title: "Compra registrada ✓", description: `${purchased.length} productos sumados a la despensa` });
    } catch {
      toast({ variant: "destructive", title: "Error al registrar la compra" });
    } finally {
      setIsUpdatingStock(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "users", USER_ID, "shopping_list_items", id));
    } catch {
      toast({ variant: "destructive", title: "Error al borrar" });
    }
  };

  const handleDeleteSelected = async () => {
    if (!db || selectedIds.size === 0) return;
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => batch.delete(doc(db, "users", USER_ID, "shopping_list_items", id)));
      await batch.commit();
      toast({ title: `${selectedIds.size} ítem(s) eliminados ✓` });
      exitSelectionMode();
    } catch {
      toast({ variant: "destructive", title: "Error al borrar" });
    }
  };

  const toggleItem = async (id: string, current: boolean) => {
    if (!db) return;
    optimisticToggleCompra(id);
    try {
      await updateDoc(doc(db, "users", USER_ID, "shopping_list_items", id), {
        isPurchased: !current,
        purchasedAt: !current ? serverTimestamp() : null
      });
    } catch {
      optimisticToggleCompra(id);
      toast({ variant: "destructive", title: "Error al marcar ítem" });
    }
  };

  if (!listaComprasCargada && listaCompras.length === 0) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-28 w-full rounded-[24px]" />
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  const progress = listaCompras.length > 0 ? purchasedCount / listaCompras.length : 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        subtitle={isSelectionMode ? `${manualItems.length} ítems agregados a mano` : isSyncing ? "Recalculando con el plan…" : `${pending} pendientes`}
        title={isSelectionMode ? (selectedIds.size === 0 ? "Seleccionar" : `${selectedIds.size} seleccionados`) : "Compras"}
        actions={isSelectionMode ? (
          <>
            <HeaderButton label={selectedIds.size === manualItems.length ? "Desmarcar todos" : "Marcar todos"} onClick={() => setSelectedIds(selectedIds.size === manualItems.length ? new Set() : new Set(manualItems.map(i => i.id)))}>
              {selectedIds.size === manualItems.length ? "Ninguno" : "Todos"}
            </HeaderButton>
            <HeaderButton label="Salir de selección" onClick={exitSelectionMode}><X /></HeaderButton>
          </>
        ) : (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <HeaderButton label="Más opciones">{isSyncing ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}</HeaderButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleSync} disabled={isSyncing}>
                  <RefreshCcw className={cn(isSyncing && "animate-spin")} /> Recalcular con el plan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCollapsed(collapsed.size > 0 ? new Set() : new Set(categories))}>
                  <ChevronDown className={cn("transition-transform", collapsed.size === 0 && "rotate-180")} /> {collapsed.size > 0 ? "Expandir todo" : "Contraer todo"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setIsSelectionMode(true); setCollapsed(new Set()); }} disabled={manualItems.length === 0}>
                  <CheckSquare /> Borrar agregados a mano…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AddShoppingItemDialog>
              <HeaderButton primary label="Agregar producto"><Plus /></HeaderButton>
            </AddShoppingItemDialog>
          </>
        )}
      />

      {listaCompras.length > 0 && !isSelectionMode && (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={easeOut} className="glass rounded-[24px] p-4 space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Estimado pendiente</p>
              <p className="text-[28px] leading-none font-bold tracking-tight tabular-nums mt-1.5">{formatPrecio(totalEstimado)}</p>
              {sinPrecio > 0 && (
                <p className="mt-1.5 text-[11px] font-medium text-accent flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {sinPrecio} sin precio
                </p>
              )}
            </div>
            <Button size="sm" onClick={handleFinishPurchase} disabled={purchasedCount === 0 || isUpdatingStock} className="shrink-0">
              {isUpdatingStock ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
              Terminar ({purchasedCount})
            </Button>
          </div>
          <div className="h-1.5 rounded-full bg-foreground/[0.07] overflow-hidden">
            <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${progress * 100}%` }} transition={spring} />
          </div>
        </motion.section>
      )}

      {listaCompras.length > 0 ? (
        <div className="space-y-3">
          {categories.map(category => {
            const items = groups[category];
            const isOpen = !collapsed.has(category);
            const left = items.filter(i => !i.isPurchased).length;
            return (
              <section key={category} className="glass rounded-[22px] overflow-hidden">
                <button onClick={() => toggleCollapsed(category)} className="w-full flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-semibold">{category}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                    {left > 0 ? `${left} de ${items.length}` : "✓ listo"}
                    <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={easeOut} className="overflow-hidden">
                      <div className="border-t border-hairline">
                        {items.map(item => {
                          const isManual = isManualItem(item);
                          const selectable = isSelectionMode && isManual;
                          const row = (
                            <div
                              className={cn(
                                "px-4 py-2.5 flex items-center gap-3 bg-card/60 border-b border-hairline last:border-b-0 transition-colors",
                                selectable && selectedIds.has(item.id) && "bg-primary/[0.08]",
                                isSelectionMode && !isManual && "opacity-40"
                              )}
                              onClick={selectable ? () => toggleSelection(item.id) : undefined}
                            >
                              <Checkbox
                                checked={selectable ? selectedIds.has(item.id) : !!item.isPurchased}
                                onCheckedChange={() => selectable ? toggleSelection(item.id) : !isSelectionMode && toggleItem(item.id, !!item.isPurchased)}
                                disabled={isSelectionMode && !isManual}
                                className="h-6 w-6 rounded-lg"
                                aria-label={item.nombre}
                              />
                              <button
                                type="button"
                                className="flex-1 min-w-0 text-left"
                                onClick={() => !isSelectionMode && toggleItem(item.id, !!item.isPurchased)}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span className={cn("font-medium text-sm truncate", item.isPurchased && "line-through text-muted-foreground")}>{item.nombre}</span>
                                  {isManual && <span className="text-[9px] font-semibold text-accent bg-accent/10 rounded-full px-1.5 py-0.5 shrink-0">a mano</span>}
                                </span>
                                <span className="block text-[11px] text-muted-foreground tabular-nums truncate">
                                  {Number(item.cantidad).toLocaleString('es-AR', { maximumFractionDigits: 2 })} {item.unidad}
                                  {item.justificacion && item.source === "plan" && !item.isPurchased && (
                                    <> · {item.justificacion === "Stock mínimo" ? "stock mínimo" : item.justificacion}</>
                                  )}
                                </span>
                              </button>
                              <button
                                type="button"
                                disabled={isSelectionMode}
                                onClick={() => setPriceItem({ id: item.ingredienteId, nombre: item.nombre, categoria: item.categoria, unidad: item.unidad, precioUnitario: item.precioUnitario, ...(ingredientes.find(i => i.id === item.ingredienteId) || {}) })}
                                className="text-right shrink-0 rounded-lg px-1.5 py-1 -mr-1.5 hover:bg-foreground/5"
                                aria-label={`Precio de ${item.nombre}`}
                              >
                                {item.precioUnitario > 0 ? (
                                  <span className="text-xs font-semibold tabular-nums">{formatPrecio(item.subtotal || 0)}</span>
                                ) : (
                                  <span className="text-xs font-medium text-accent">$ —</span>
                                )}
                              </button>
                            </div>
                          );
                          // Deslizar para borrar solo en ítems agregados a mano (los del plan se recalculan solos)
                          return isManual && !isSelectionMode ? (
                            <SwipeToDelete key={item.id} onDelete={() => handleDeleteItem(item.id)}>{row}</SwipeToDelete>
                          ) : (
                            <div key={item.id}>{row}</div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={ShoppingCart}
          title="Lista vacía"
          description="Se completa sola con lo que falta para tu plan y los mínimos de la despensa. También podés agregar productos a mano."
          action={
            <Button onClick={handleSync} disabled={isSyncing} className="mt-2">
              <RefreshCcw className={cn("h-4 w-4", isSyncing && "animate-spin")} /> Recalcular ahora
            </Button>
          }
        />
      )}

      <AnimatePresence>
        {isSelectionMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={spring}
            className="fixed bottom-[calc(max(12px,env(safe-area-inset-bottom))+76px)] inset-x-0 mx-auto w-[calc(100%-24px)] max-w-[480px] z-50"
          >
            <div className="glass-strong rounded-[22px] p-2 pl-4 flex items-center justify-between">
              <span className="text-sm font-semibold">{selectedIds.size} seleccionados</span>
              <Button variant="destructive" size="sm" onClick={handleDeleteSelected}><Trash2 className="h-4 w-4" /> Eliminar</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Un único diálogo de precio para toda la lista */}
      <StockFormDialog ingredientToEdit={priceItem} open={!!priceItem} onOpenChange={(o) => !o && setPriceItem(null)} />
    </div>
  );
}
