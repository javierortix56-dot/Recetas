'use client';

import * as React from 'react';
import { Settings, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore } from '@/firebase';
import { writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { useAppStore } from '@/store/app-store';
import { USER_ID } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export const CANONICAL_CATEGORIES = [
  'Frutas y Verduras',
  'Lácteos y Huevos',
  'Carnes y Aves',
  'Pescados y Mariscos',
  'Almacén',
  'Especias y Condimentos',
  'Bebidas',
  'Otros',
] as const;

export function normalizeCategoria(cat: string): string {
  const c = (cat || 'Otros').toLowerCase().trim();
  if (['frutas', 'verduras', 'frutas y verduras', 'frutas&verduras'].includes(c)) return 'Frutas y Verduras';
  if (['lacteos', 'lácteos', 'lacteos y huevos', 'lácteos y huevos', 'huevos'].includes(c)) return 'Lácteos y Huevos';
  if (['carnes', 'aves', 'carnes y aves'].includes(c)) return 'Carnes y Aves';
  if (['pescados', 'mariscos', 'pescados y mariscos'].includes(c)) return 'Pescados y Mariscos';
  if (['especias', 'condimentos', 'especias y condimentos'].includes(c)) return 'Especias y Condimentos';
  if (['almacen', 'almacén'].includes(c)) return 'Almacén';
  if (['bebidas', 'bebida'].includes(c)) return 'Bebidas';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

export function CategoryManagerDialog({ asMenuItem }: { asMenuItem?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const db = useFirestore();
  const { ingredientes } = useAppStore();
  const [renames, setRenames] = React.useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = React.useState(false);

  const categoryStats = React.useMemo(() => {
    const stats: Record<string, number> = {};
    ingredientes.forEach(i => {
      const cat = i.categoria || 'Otros';
      stats[cat] = (stats[cat] || 0) + 1;
    });
    return Object.entries(stats).sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [ingredientes]);

  const isCanonical = (cat: string) =>
    (CANONICAL_CATEGORIES as readonly string[]).includes(cat);

  const nonCanonicalCount = categoryStats.filter(([cat]) => !isCanonical(cat)).length;

  const handleApplyRenames = async () => {
    if (!db || Object.keys(renames).length === 0) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      let count = 0;
      ingredientes.forEach(ing => {
        const newCat = renames[ing.categoria || 'Otros'];
        if (newCat) {
          batch.update(doc(db, 'users', USER_ID, 'ingredients', ing.id), {
            categoria: newCat,
            updatedAt: serverTimestamp(),
          });
          count++;
        }
      });
      await batch.commit();
      toast({ title: `${count} ingrediente(s) actualizados ✓` });
      setRenames({});
    } catch (e) {
      console.error('handleApplyRenames:', e);
      toast({ variant: 'destructive', title: 'Error al actualizar categorías' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleNormalizeAll = async () => {
    if (!db) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      let count = 0;
      ingredientes.forEach(ing => {
        const current = ing.categoria || 'Otros';
        const normalized = normalizeCategoria(current);
        if (normalized !== current) {
          batch.update(doc(db, 'users', USER_ID, 'ingredients', ing.id), {
            categoria: normalized,
            updatedAt: serverTimestamp(),
          });
          count++;
        }
      });
      await batch.commit();
      toast({ title: count > 0 ? `${count} ingrediente(s) normalizados ✓` : 'Todo ya está normalizado ✓' });
      setRenames({});
    } catch (e) {
      console.error('handleNormalizeAll:', e);
      toast({ variant: 'destructive', title: 'Error al normalizar' });
    } finally {
      setIsSaving(false);
    }
  };

  const trigger = asMenuItem ? (
    <DropdownMenuItem
      onSelect={(e) => { e.preventDefault(); setOpen(true); }}
      className="gap-3 font-bold"
    >
      <Settings className="h-4 w-4" /> Gestionar categorías
    </DropdownMenuItem>
  ) : (
    <Button variant="ghost" size="icon">
      <Settings className="h-4 w-4" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setRenames({}); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="max-w-sm rounded-3xl p-6 flex flex-col max-h-[85vh]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-primary">Gestionar categorías</DialogTitle>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">
            {categoryStats.length} categorías · {ingredientes.length} ingredientes
            {nonCanonicalCount > 0 && (
              <span className="text-accent"> · {nonCanonicalCount} no canónicas</span>
            )}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1 scrollbar-hide">
          {categoryStats.map(([cat, count]) => {
            const canonical = isCanonical(cat);
            const suggested = !canonical ? normalizeCategoria(cat) : null;
            const pendingRename = renames[cat];

            return (
              <div
                key={cat}
                className={cn(
                  'p-3 rounded-2xl border transition-colors',
                  canonical
                    ? 'bg-white border-border/50'
                    : 'bg-accent/5 border-accent/30'
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  {canonical
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    : <AlertTriangle className="h-3.5 w-3.5 text-accent shrink-0" />
                  }
                  <span className="font-bold text-sm flex-1 truncate">{cat}</span>
                  <Badge className="text-[8px] font-black h-4 px-1.5 bg-primary/10 text-primary border-none shrink-0">
                    {count} {count === 1 ? 'ítem' : 'ítems'}
                  </Badge>
                </div>

                {!canonical && (
                  <Select
                    value={pendingRename ?? (suggested !== cat ? suggested! : '')}
                    onValueChange={(val) =>
                      setRenames(prev => ({ ...prev, [cat]: val }))
                    }
                  >
                    <SelectTrigger className="h-8 rounded-xl text-xs font-bold border-accent/30 bg-white">
                      <SelectValue placeholder="Renombrar a..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {CANONICAL_CATEGORIES.map(c => (
                        <SelectItem key={c} value={c} className="text-xs font-bold">
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })}

          {categoryStats.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Sin ingredientes aún</p>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-3 border-t border-border/50">
          {nonCanonicalCount > 0 && (
            <Button
              onClick={handleNormalizeAll}
              disabled={isSaving}
              variant="outline"
              className="w-full rounded-2xl font-black text-[10px] uppercase tracking-wider"
            >
              Normalizar todo automáticamente
            </Button>
          )}
          {Object.keys(renames).length > 0 && (
            <Button
              onClick={handleApplyRenames}
              disabled={isSaving}
              className="w-full rounded-2xl font-black text-[10px] uppercase tracking-wider bg-primary text-white"
            >
              Aplicar {Object.keys(renames).length} cambio(s) manual(es)
            </Button>
          )}
          {nonCanonicalCount === 0 && Object.keys(renames).length === 0 && (
            <p className="text-center text-[10px] font-black text-primary uppercase tracking-widest py-1">
              ✓ Todas las categorías están normalizadas
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
