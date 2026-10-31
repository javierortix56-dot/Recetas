'use client';

import * as React from 'react';
import { Search, Plus, Minus, Package, AlertCircle, RotateCcw, X, ChevronDown, MoreHorizontal, CalendarDays, Store, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { doc, serverTimestamp, collection, writeBatch } from "firebase/firestore";
import { useShallow } from 'zustand/react/shallow';
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHeader, HeaderButton, EmptyState } from '@/components/ui/page-header';
import { FilterChip } from '@/components/ui/segmented';
import { easeOut } from '@/components/ui/motion';
import { StockFormDialog } from "@/components/stock/stock-form-dialog";
import { StockHistorialDialog } from "@/components/stock/stock-historial-dialog";
import { CategoryManagerDialog, normalizeCategoria } from "@/components/stock/category-manager-dialog";
import { IngredientMergerDialog } from "@/components/macros/ingredient-merger-dialog";
import { useFirestore } from "@/firebase";
import { toast } from "@/hooks/use-toast";
import { useAppStore } from '@/store/app-store';
import { nameKey } from "@/lib/ingredient-groups";
import { USER_ID } from '@/lib/constants';
import { cn, formatPrecio } from '@/lib/utils';
import { syncShoppingList } from '@/lib/sync-logic';
import { linkedIngredients, refreshLinkedPrices } from '@/lib/prices/refresh';

const isLow = (i: any) => Number(i.stockMinimo) > 0 && Number(i.stockActual) <= Number(i.stockMinimo);

export function StockTab() {
  const db = useFirestore();
  const { ingredientes, ingredientesCargadas, planificacion } = useAppStore(useShallow(s => ({
    ingredientes: s.ingredientes,
    ingredientesCargadas: s.ingredientesCargadas,
    planificacion: s.planificacion,
  })));

  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);
  const [filter, setFilter] = React.useState<'todos' | 'bajo' | 'plan'>('todos');
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [editing, setEditing] = React.useState<any | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState<null | { done: number; total: number }>(null);
  const linkedCount = React.useMemo(() => linkedIngredients(ingredientes).length, [ingredientes]);

  const handleRefreshPrices = async () => {
    if (!db || refreshing) return;
    setRefreshing({ done: 0, total: linkedCount });
    toast({ title: `Actualizando ${linkedCount} precios…`, description: "Consultando los supermercados." });
    try {
      const { updated, unchanged, notFound } = await refreshLinkedPrices(db, ingredientes, (done, total) => setRefreshing({ done, total }));
      syncShoppingList(db).catch(() => {});
      toast({
        title: "Precios actualizados ✓",
        description: [`${updated} cambiaron`, unchanged && `${unchanged} iguales`, notFound && `${notFound} sin datos (quedó el precio anterior)`].filter(Boolean).join(" · "),
      });
    } catch {
      toast({ variant: "destructive", title: "No se pudieron actualizar los precios" });
    } finally {
      setRefreshing(null);
    }
  };

  const plannedNames = React.useMemo(() => {
    const names = new Set<string>();
    planificacion.forEach(plan => (plan.ingredientes || []).forEach((ing: any) => {
      if (ing.nombre) names.add(nameKey(ing.nombre));
    }));
    return names;
  }, [planificacion]);

  const lowCount = React.useMemo(() => ingredientes.filter(isLow).length, [ingredientes]);

  const grouped = React.useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    const groups: Record<string, any[]> = {};
    ingredientes.forEach(item => {
      if (q && !(item.nombre || "").toLowerCase().includes(q)) return;
      if (filter === 'bajo' && !isLow(item)) return;
      if (filter === 'plan' && !plannedNames.has(nameKey(item.nombre))) return;
      (groups[normalizeCategoria(item.categoria || "Otros")] ||= []).push(item);
    });
    // Con stock primero, después sin stock; alfabético dentro de cada grupo
    Object.values(groups).forEach(list => list.sort((a, b) =>
      Number((a.stockActual || 0) <= 0) - Number((b.stockActual || 0) <= 0) || (a.nombre || "").localeCompare(b.nombre || "", "es")
    ));
    return groups;
  }, [ingredientes, deferredSearch, filter, plannedNames]);

  const categories = React.useMemo(() => Object.keys(grouped).sort((a, b) => a.localeCompare(b, "es")), [grouped]);
  // Buscando o filtrando, todo abierto; si no, lo que el usuario expandió
  const autoOpen = !!deferredSearch.trim() || filter !== 'todos';

  const toggleCategory = (cat: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(cat) ? next.delete(cat) : next.add(cat);
    return next;
  });

  const updateStock = React.useCallback(async (item: any, value: number) => {
    if (!db) return;
    const newVal = Math.max(0, Math.round(value * 100) / 100);
    if (newVal === Number(item.stockActual)) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "users", USER_ID, "ingredients", item.id), { stockActual: newVal, updatedAt: serverTimestamp() });
      batch.set(doc(collection(db, "users", USER_ID, "stock_historial")), {
        ingredienteId: item.id,
        ingredienteNombre: item.nombre,
        tipo: 'ajuste',
        cantidadAntes: Number(item.stockActual) || 0,
        cantidadDespues: newVal,
        diferencia: newVal - (Number(item.stockActual) || 0),
        unidad: item.unidad,
        fecha: serverTimestamp(),
      });
      await batch.commit();
    } catch {
      toast({ variant: "destructive", title: "No se pudo actualizar el stock" });
    }
  }, [db]);

  const handleResetMinimos = async () => {
    if (!db) return;
    try {
      const withMin = ingredientes.filter(i => Number(i.stockMinimo) > 0);
      for (let i = 0; i < withMin.length; i += 450) {
        const batch = writeBatch(db);
        withMin.slice(i, i + 450).forEach(ing => batch.update(doc(db, "users", USER_ID, "ingredients", ing.id), { stockMinimo: 0, updatedAt: serverTimestamp() }));
        await batch.commit();
      }
      syncShoppingList(db).catch(() => {});
      toast({ title: "Mínimos en 0", description: `${withMin.length} productos actualizados` });
    } catch {
      toast({ variant: "destructive", title: "Error al resetear" });
    }
  };

  if (!ingredientesCargadas && ingredientes.length === 0) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-40" />
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  const allOpen = categories.length > 0 && categories.every(c => expanded.has(c));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        sticky
        subtitle={`${ingredientes.length} productos${lowCount > 0 ? ` · ${lowCount} con stock bajo` : ""}`}
        title="Despensa"
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <HeaderButton label="Más opciones"><MoreHorizontal /></HeaderButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setExpanded(allOpen ? new Set() : new Set(categories))}>
                  <ChevronDown className={cn("transition-transform", allOpen && "rotate-180")} /> {allOpen ? "Contraer todo" : "Expandir todo"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRefreshPrices} disabled={!!refreshing || linkedCount === 0}>
                  {refreshing ? <Loader2 className="animate-spin" /> : <Store />}
                  {refreshing ? `Actualizando ${refreshing.done}/${refreshing.total}…` : linkedCount > 0 ? `Actualizar ${linkedCount} precios` : "Actualizar precios (vinculá productos)"}
                </DropdownMenuItem>
                <StockHistorialDialog asMenuItem />
                <DropdownMenuSeparator />
                <CategoryManagerDialog asMenuItem />
                <IngredientMergerDialog asMenuItem />
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setConfirmReset(true)} className="text-accent focus:text-accent focus:bg-accent/10">
                  <RotateCcw /> Poner mínimos en 0
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <HeaderButton primary label="Nuevo producto" onClick={() => setIsCreating(true)}><Plus /></HeaderButton>
          </>
        }
      >
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar producto" className="pl-10 glass" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Limpiar búsqueda" className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-foreground/10 flex items-center justify-center">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <FilterChip active={filter === 'todos'} onClick={() => setFilter('todos')}>Todos</FilterChip>
          <FilterChip active={filter === 'bajo'} onClick={() => setFilter(filter === 'bajo' ? 'todos' : 'bajo')} tone="destructive">
            <AlertCircle /> Stock bajo{lowCount > 0 ? ` (${lowCount})` : ""}
          </FilterChip>
          <FilterChip active={filter === 'plan'} onClick={() => setFilter(filter === 'plan' ? 'todos' : 'plan')}>
            <CalendarDays /> En el plan
          </FilterChip>
        </div>
      </PageHeader>

      {categories.length > 0 ? (
        <div className="space-y-3">
          {categories.map(category => {
            const items = grouped[category];
            const isOpen = autoOpen || expanded.has(category);
            const low = items.filter(isLow).length;
            return (
              <section key={category} className="glass rounded-[22px] overflow-hidden">
                <button onClick={() => toggleCategory(category)} disabled={autoOpen} className="w-full flex items-center justify-between px-4 py-3">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {category}
                    {low > 0 && <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-label={`${low} con stock bajo`} />}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                    {items.length}
                    {!autoOpen && <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={easeOut} className="overflow-hidden">
                      <div className="border-t border-hairline">
                        {items.map(item => (
                          <StockRow key={item.id} item={item} onEdit={setEditing} onUpdate={updateStock} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            );
          })}
        </div>
      ) : ingredientes.length === 0 ? (
        <EmptyState icon={Package} title="Despensa vacía" description="Los ingredientes se agregan solos al importar recetas, o podés cargarlos a mano." />
      ) : (
        <EmptyState icon={Search} title="Sin resultados" description="Probá con otro nombre o quitá el filtro." />
      )}

      {/* Un único diálogo de alta/edición para toda la lista */}
      <StockFormDialog
        ingredientToEdit={editing || undefined}
        open={!!editing || isCreating}
        onOpenChange={(o) => { if (!o) { setEditing(null); setIsCreating(false); } }}
      />

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Poner todos los mínimos en 0?</AlertDialogTitle>
            <AlertDialogDescription>A partir de ahí, a la lista de compras solo entra lo que necesite el plan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetMinimos} className="bg-accent text-accent-foreground hover:bg-accent/90">Poner en 0</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const StockRow = React.memo(function StockRow({ item, onEdit, onUpdate }: {
  item: any
  onEdit: (item: any) => void
  onUpdate: (item: any, value: number) => void
}) {
  const low = isLow(item);
  const stock = Number(item.stockActual) || 0;
  // Paso del +/−: 1 para unidades, 100 para g/ml, 0.25 para kg/l
  const step = ['g', 'ml'].includes(item.unidad) ? 100 : ['kg', 'l'].includes(item.unidad) ? 0.25 : 1;

  return (
    <div className="px-4 py-2.5 flex items-center gap-3 bg-card/60 border-b border-hairline last:border-b-0">
      <button type="button" onClick={() => onEdit(item)} className="flex-1 min-w-0 text-left">
        <p className={cn("font-medium text-sm truncate", stock <= 0 && "text-muted-foreground")}>{item.nombre}</p>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 tabular-nums">
          {low && <span className="text-destructive font-semibold flex items-center gap-0.5"><AlertCircle className="h-3 w-3" />bajo</span>}
          {Number(item.stockMinimo) > 0 && <span>mín {Number(item.stockMinimo).toLocaleString('es-AR', { maximumFractionDigits: 2 })} {item.unidad}</span>}
          {item.precioUnitario > 0 && <span>· {formatPrecio(item.precioUnitario)}/{item.unidad}</span>}
        </p>
      </button>
      <div className="flex items-center gap-0.5 rounded-full bg-foreground/[0.05] p-0.5 shrink-0">
        <button aria-label={`Restar ${item.nombre}`} onClick={() => onUpdate(item, stock - step)} disabled={stock <= 0} className="h-8 w-8 rounded-full flex items-center justify-center text-foreground/70 active:scale-90 disabled:opacity-30">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className={cn("min-w-[52px] text-center text-xs font-bold tabular-nums", low ? "text-destructive" : stock > 0 ? "text-foreground" : "text-muted-foreground")}>
          {stock.toLocaleString('es-AR', { maximumFractionDigits: 2 })} <span className="font-medium text-muted-foreground">{item.unidad}</span>
        </span>
        <button aria-label={`Sumar ${item.nombre}`} onClick={() => onUpdate(item, stock + step)} className="h-8 w-8 rounded-full flex items-center justify-center text-primary active:scale-90">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
});
