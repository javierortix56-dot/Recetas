'use client';

import * as React from 'react';
import { History, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestore } from '@/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { USER_ID } from '@/lib/constants';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function StockHistorialDialog({ asMenuItem }: { asMenuItem?: boolean } = {}) {
  const db = useFirestore();
  const [open, setOpen] = React.useState(false);
  const [entries, setEntries] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  const loadHistorial = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users', USER_ID, 'stock_historial'),
        orderBy('fecha', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (open) loadHistorial();
  }, [open]);

  const grouped = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    entries.forEach(e => {
      const fecha = e.fecha?.toDate ? e.fecha.toDate() : new Date();
      const key = format(fecha, 'EEEE d MMM', { locale: es });
      if (!groups[key]) groups[key] = [];
      groups[key].push({ ...e, _date: fecha });
    });
    return groups;
  }, [entries]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {asMenuItem ? (
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }} className="gap-3 font-bold">
            <History className="h-4 w-4" /> Historial de stock
          </DropdownMenuItem>
        ) : (
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-primary-suave text-primary">
            <History className="h-5 w-5" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-[2rem] max-h-[80vh] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="font-black text-primary text-xl">Historial de Stock</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center opacity-40">
            <History className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-xs font-black uppercase tracking-widest">Sin movimientos registrados</p>
          </div>
        ) : (
          <div className="space-y-5 pb-8">
            {Object.entries(grouped).map(([fecha, items]) => (
              <div key={fecha}>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1 capitalize">{fecha}</p>
                <div className="space-y-1.5">
                  {items.map(entry => {
                    const esCompra = entry.tipo === 'compra';
                    const esPositivo = entry.diferencia > 0;
                    return (
                      <div key={entry.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 border border-border/50">
                        <div className={cn(
                          "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                          esPositivo ? "bg-green-100 text-green-600" : entry.diferencia < 0 ? "bg-red-100 text-red-500" : "bg-muted text-muted-foreground"
                        )}>
                          {esPositivo ? <TrendingUp className="h-4 w-4" /> : entry.diferencia < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{entry.ingredienteNombre}</p>
                          <p className="text-[10px] text-muted-foreground font-medium">
                            {entry.cantidadAntes} → {entry.cantidadDespues} {entry.unidad}
                            {' · '}
                            <span className={cn("font-black", esPositivo ? "text-green-600" : "text-red-500")}>
                              {esPositivo ? '+' : ''}{entry.diferencia} {entry.unidad}
                            </span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={cn(
                            "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                            esCompra ? "bg-blue-100 text-blue-600" : "bg-primary-suave text-primary"
                          )}>
                            {esCompra ? 'compra' : 'ajuste'}
                          </span>
                          <p className="text-[9px] text-muted-foreground mt-1">
                            {format(entry._date, 'HH:mm')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
