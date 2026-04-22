'use client';

import * as React from 'react';
import { Settings, ChevronRight, Check, Plus, Pencil, X, MoveRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore } from '@/firebase';
import { writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { useAppStore } from '@/store/app-store';
import { USER_ID } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function normalizeCategoria(cat: string): string {
  return (cat || 'Otros').trim();
}

export function CategoryManagerDialog({ asMenuItem }: { asMenuItem?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const db = useFirestore();
  const { ingredientes } = useAppStore();

  const [expandedCats, setExpandedCats] = React.useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [renamingCat, setRenamingCat] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState('');
  const [newCatInput, setNewCatInput] = React.useState('');
  const [extraCats, setExtraCats] = React.useState<string[]>([]);
  const [moveTo, setMoveTo] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  // Build category tree from ingredients + any locally added empty categories
  const categoryMap = React.useMemo(() => {
    const map: Record<string, typeof ingredientes> = {};
    ingredientes.forEach(ing => {
      const cat = normalizeCategoria(ing.categoria || 'Otros');
      if (!map[cat]) map[cat] = [];
      map[cat].push(ing);
    });
    extraCats.forEach(c => { if (!map[c]) map[c] = []; });
    return map;
  }, [ingredientes, extraCats]);

  const allCategories = Object.keys(categoryMap).sort((a, b) => a.localeCompare(b, 'es'));

  const toggleExpand = (cat: string) =>
    setExpandedCats(prev => { const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s; });

  const toggleProduct = (id: string) =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleAllInCat = (cat: string) => {
    const ids = categoryMap[cat].map(i => i.id);
    const allSelected = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const s = new Set(prev);
      ids.forEach(id => allSelected ? s.delete(id) : s.add(id));
      return s;
    });
  };

  const handleRenameCategory = async (oldName: string) => {
    const newName = renameValue.trim();
    if (!db || !newName || newName === oldName) { setRenamingCat(null); return; }
    setIsSaving(true);
    try {
      const toUpdate = ingredientes.filter(i => normalizeCategoria(i.categoria || 'Otros') === oldName);
      const batch = writeBatch(db);
      toUpdate.forEach(ing =>
        batch.update(doc(db, 'users', USER_ID, 'ingredients', ing.id), {
          categoria: newName, updatedAt: serverTimestamp(),
        })
      );
      await batch.commit();
      setExtraCats(prev => prev.map(c => c === oldName ? newName : c));
      toast({ title: `"${oldName}" → "${newName}" ✓` });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al renombrar' });
    } finally {
      setIsSaving(false);
      setRenamingCat(null);
    }
  };

  const handleMoveSelected = async () => {
    if (!db || !moveTo || selectedIds.size === 0) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id =>
        batch.update(doc(db, 'users', USER_ID, 'ingredients', id), {
          categoria: moveTo, updatedAt: serverTimestamp(),
        })
      );
      await batch.commit();
      toast({ title: `${selectedIds.size} producto(s) movidos a "${moveTo}" ✓` });
      setSelectedIds(new Set());
      setMoveTo('');
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al mover productos' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCategory = () => {
    const name = newCatInput.trim();
    if (!name || allCategories.includes(name)) return;
    setExtraCats(prev => [...prev, name]);
    setExpandedCats(prev => new Set(prev).add(name));
    setNewCatInput('');
  };

  const trigger = asMenuItem ? (
    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }} className="gap-3 font-bold">
      <Settings className="h-4 w-4" /> Gestionar categorías
    </DropdownMenuItem>
  ) : (
    <Button variant="ghost" size="icon"><Settings className="h-4 w-4" /></Button>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSelectedIds(new Set()); setRenamingCat(null); setMoveTo(''); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm rounded-3xl p-0 flex flex-col max-h-[88vh] overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50">
          <DialogTitle className="text-xl font-black text-primary">Categorías</DialogTitle>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
            {allCategories.length} categorías · {ingredientes.length} ingredientes
          </p>
        </DialogHeader>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {allCategories.map(cat => {
            const items = categoryMap[cat] || [];
            const isOpen = expandedCats.has(cat);
            const isRenaming = renamingCat === cat;
            const selectedInCat = items.filter(i => selectedIds.has(i.id)).length;

            return (
              <div key={cat} className="border-b border-border/30 last:border-0">
                {/* Category row */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-primary/5 transition-colors">
                  <button onClick={() => toggleExpand(cat)} className="shrink-0">
                    <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-90')} />
                  </button>

                  {isRenaming ? (
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameCategory(cat); if (e.key === 'Escape') setRenamingCat(null); }}
                      className="h-7 text-sm font-bold flex-1 rounded-lg px-2 border-primary"
                    />
                  ) : (
                    <span className="flex-1 font-bold text-sm truncate">{cat}</span>
                  )}

                  <Badge className="text-[8px] font-black h-4 px-1.5 bg-primary/10 text-primary border-none shrink-0">
                    {items.length}
                  </Badge>

                  {isRenaming ? (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => handleRenameCategory(cat)} className="h-6 w-6 flex items-center justify-center rounded-lg bg-primary text-white">
                        <Check className="h-3 w-3" />
                      </button>
                      <button onClick={() => setRenamingCat(null)} className="h-6 w-6 flex items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setRenamingCat(cat); setRenameValue(cat); }}
                      className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-muted shrink-0"
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Products */}
                {isOpen && (
                  <div className="bg-background/60">
                    {items.length === 0 ? (
                      <p className="px-10 py-3 text-[10px] font-black text-muted-foreground uppercase">Sin productos</p>
                    ) : (
                      <>
                        {/* Select all in category */}
                        <button
                          onClick={() => toggleAllInCat(cat)}
                          className="w-full flex items-center gap-2 px-10 py-1.5 hover:bg-primary/5 text-left"
                        >
                          <div className={cn(
                            'h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                            selectedInCat === items.length ? 'bg-primary border-primary text-white' :
                            selectedInCat > 0 ? 'bg-primary/30 border-primary' : 'border-muted-foreground/30'
                          )}>
                            {selectedInCat === items.length && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                          </div>
                          <span className="text-[9px] font-black uppercase text-muted-foreground">
                            {selectedInCat === items.length ? 'Desmarcar todos' : 'Seleccionar todos'}
                          </span>
                        </button>

                        {items
                          .slice()
                          .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))
                          .map(ing => (
                            <button
                              key={ing.id}
                              onClick={() => toggleProduct(ing.id)}
                              className="w-full flex items-center gap-3 px-10 py-2 hover:bg-primary/5 text-left transition-colors"
                            >
                              <div className={cn(
                                'h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                                selectedIds.has(ing.id) ? 'bg-primary border-primary text-white' : 'border-muted-foreground/30'
                              )}>
                                {selectedIds.has(ing.id) && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                              </div>
                              <span className="text-sm font-medium truncate">{ing.nombre}</span>
                              <span className="text-[9px] text-muted-foreground ml-auto shrink-0">{ing.stockActual} {ing.unidad}</span>
                            </button>
                          ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-border/50 px-4 py-3 space-y-2 bg-white">
          {/* Move selected */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <MoveRight className="h-4 w-4 text-primary shrink-0" />
              <span className="text-[10px] font-black text-primary uppercase shrink-0">{selectedIds.size} prod.</span>
              <Select value={moveTo} onValueChange={setMoveTo}>
                <SelectTrigger className="h-8 rounded-xl text-xs font-bold flex-1">
                  <SelectValue placeholder="Mover a..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {allCategories.map(c => (
                    <SelectItem key={c} value={c} className="text-xs font-bold">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleMoveSelected}
                disabled={!moveTo || isSaving}
                size="sm"
                className="h-8 rounded-xl font-black text-[10px] uppercase px-3 bg-primary text-white shrink-0"
              >
                Mover
              </Button>
            </div>
          )}

          {/* Add category */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nueva categoría..."
              value={newCatInput}
              onChange={e => setNewCatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
              className="h-8 rounded-xl text-xs font-bold flex-1"
            />
            <Button
              onClick={handleAddCategory}
              disabled={!newCatInput.trim()}
              size="icon"
              className="h-8 w-8 rounded-xl bg-primary text-white shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
