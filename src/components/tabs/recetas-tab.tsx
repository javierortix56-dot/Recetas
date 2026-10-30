'use client';

import * as React from 'react';
import { Search, Sparkles, CheckSquare, X, Check, Flame, Plus, MoreHorizontal, Trash2, Clock, ChefHat } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from 'framer-motion';
import { writeBatch, doc } from 'firebase/firestore';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHeader, HeaderButton, EmptyState } from '@/components/ui/page-header';
import { FilterChip } from '@/components/ui/segmented';
import { easeOut, spring, stagger } from '@/components/ui/motion';
import { GradientPlaceholder } from "@/components/gradient-placeholder";
import { RecipeImportModal } from "@/components/recipe-import-modal";
import { useAppStore } from '@/store/app-store';
import { useFirestore } from '@/firebase';
import { toast } from '@/hooks/use-toast';
import { USER_ID } from '@/lib/constants';
import { cn, getSafeImageSource } from '@/lib/utils';

const CATEGORIES = ["Todos", "Desayuno", "Almuerzo", "Merienda", "Cena", "Postre", "Snack"];

const recipeCats = (r: any): string[] => Array.isArray(r.categorias) ? r.categorias : (r.categoria ? [r.categoria] : []);

export function RecetasTab() {
  const router = useRouter();
  const db = useFirestore();
  const recetas = useAppStore(s => s.recetas);
  const recetasCargadas = useAppStore(s => s.recetasCargadas);
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);
  const [activeCategory, setActiveCategory] = React.useState("Todos");
  const [activeTag, setActiveTag] = React.useState<string | null>(null);
  const [showTags, setShowTags] = React.useState(false);
  const [isImportOpen, setIsImportOpen] = React.useState(false);

  const [isSelectionMode, setIsSelectionMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const tagsSorted = React.useMemo(() => {
    const counts: Record<string, number> = {};
    recetas.forEach(r => (r.tags || []).forEach((t: string) => {
      const tag = t.toLowerCase().trim();
      if (tag) counts[tag] = (counts[tag] || 0) + 1;
    }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([tag]) => tag).slice(0, 24);
  }, [recetas]);

  const filtered = React.useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    return recetas
      .filter(r => {
        const matchesSearch = !q
          || (r.nombre || "").toLowerCase().includes(q)
          || r.ingredientes?.some((ing: any) => (ing.nombre || "").toLowerCase().includes(q));
        const matchesCategory = activeCategory === "Todos" || recipeCats(r).includes(activeCategory);
        const matchesTag = !activeTag || (r.tags || []).some((t: string) => t.toLowerCase().trim() === activeTag);
        return matchesSearch && matchesCategory && matchesTag;
      })
      .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));
  }, [recetas, deferredSearch, activeCategory, activeTag]);

  const toggleSelection = React.useCallback((id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  }), []);

  const exitSelection = () => { setIsSelectionMode(false); setSelectedIds(new Set()); };

  const handleDeleteSelected = async () => {
    if (!db || selectedIds.size === 0) return;
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => batch.delete(doc(db, "users", USER_ID, "recipes", id)));
      await batch.commit();
      toast({ title: `${selectedIds.size} ${selectedIds.size === 1 ? "receta eliminada" : "recetas eliminadas"}` });
      exitSelection();
    } catch {
      toast({ variant: "destructive", title: "Error al eliminar" });
    } finally {
      setConfirmDelete(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        sticky
        subtitle={isSelectionMode ? "Tocá para seleccionar" : `${recetas.length} recetas`}
        title={isSelectionMode ? `${selectedIds.size} seleccionadas` : "Recetas"}
        actions={isSelectionMode ? (
          <HeaderButton label="Salir de selección" onClick={exitSelection}><X /></HeaderButton>
        ) : (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <HeaderButton label="Más opciones"><MoreHorizontal /></HeaderButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsImportOpen(true)}>
                  <Sparkles /> Importar con IA
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsSelectionMode(true)} disabled={recetas.length === 0}>
                  <CheckSquare /> Seleccionar varias
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <HeaderButton primary label="Nueva receta" onClick={() => router.push("/recetas/nueva")}><Plus /></HeaderButton>
          </>
        )}
      >
        {!isSelectionMode && (
          <>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nombre o ingrediente" className="pl-10 glass" value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && (
                <button onClick={() => setSearch("")} aria-label="Limpiar búsqueda" className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-foreground/10 flex items-center justify-center">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="-mx-4 px-4 flex gap-2 overflow-x-auto scrollbar-hide">
              {CATEGORIES.map(cat => (
                <FilterChip key={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)}>{cat}</FilterChip>
              ))}
              {tagsSorted.length > 0 && (
                <FilterChip active={showTags || !!activeTag} onClick={() => setShowTags(v => !v)} tone="accent">
                  #{activeTag || "tags"}
                </FilterChip>
              )}
            </div>
            <AnimatePresence initial={false}>
              {showTags && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={easeOut} className="overflow-hidden">
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {tagsSorted.map(tag => (
                      <button
                        key={tag}
                        onClick={() => { setActiveTag(activeTag === tag ? null : tag); setShowTags(false); }}
                        className={cn("px-2.5 h-7 rounded-full text-[11px] font-semibold transition-colors", activeTag === tag ? "bg-accent text-accent-foreground" : "bg-foreground/[0.06] text-muted-foreground")}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </PageHeader>

      {!recetasCargadas && recetas.length === 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-square w-full rounded-[22px]" />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((recipe, i) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              index={i}
              isSelectionMode={isSelectionMode}
              isSelected={selectedIds.has(recipe.id)}
              onToggle={toggleSelection}
            />
          ))}
        </div>
      ) : recetas.length === 0 ? (
        <EmptyState
          icon={ChefHat}
          title="Todavía no hay recetas"
          description="Creá una a mano o importá varias de una vez con IA."
          action={<Button onClick={() => setIsImportOpen(true)} className="mt-2"><Sparkles className="h-4 w-4" /> Importar con IA</Button>}
        />
      ) : (
        <EmptyState icon={Search} title="Sin resultados" description="Probá con otro nombre, ingrediente o categoría." />
      )}

      {/* Barra de acciones de selección */}
      <AnimatePresence>
        {isSelectionMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={spring}
            className="fixed bottom-[calc(max(12px,env(safe-area-inset-bottom))+76px)] inset-x-0 mx-auto w-[calc(100%-24px)] max-w-[480px] z-50"
          >
            <div className="glass-strong rounded-[22px] p-2 pl-4 flex items-center justify-between">
              <span className="text-sm font-semibold">{selectedIds.size} seleccionadas</span>
              <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectedIds.size} {selectedIds.size === 1 ? "receta" : "recetas"}?</AlertDialogTitle>
            <AlertDialogDescription>No se puede deshacer. Los planes existentes conservan su copia de ingredientes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RecipeImportModal open={isImportOpen} onOpenChange={setIsImportOpen} />
    </div>
  );
}

const RecipeCard = React.memo(function RecipeCard({ recipe, index, isSelectionMode, isSelected, onToggle }: {
  recipe: any
  index: number
  isSelectionMode: boolean
  isSelected: boolean
  onToggle: (id: string) => void
}) {
  const category = recipeCats(recipe)[0] || "Almuerzo";
  const imageSource = getSafeImageSource(recipe);
  const totalTime = (Number(recipe.tiempoPreparacion) || 0) + (Number(recipe.tiempoCoccion) || 0);

  const body = (
    <>
      {imageSource ? (
        <Image src={imageSource} alt={recipe.nombre} fill sizes="50vw" className="object-cover" unoptimized />
      ) : (
        <GradientPlaceholder categoria={category} className="rounded-none" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
      <span className="absolute top-2 left-2 rounded-full bg-black/30 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold text-white">{category}</span>
      {isSelectionMode && (
        <span className={cn("absolute top-2 right-2 h-6 w-6 rounded-full flex items-center justify-center border-2 transition-colors", isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-black/20 border-white/70")}>
          {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
        </span>
      )}
      <div className="absolute bottom-2.5 left-3 right-3 text-white">
        <h3 className="font-semibold text-[13px] leading-tight line-clamp-2">{recipe.nombre}</h3>
        <div className="flex items-center gap-2.5 mt-1 text-[11px] text-white/80 tabular-nums">
          <span className="flex items-center gap-0.5"><Flame className="h-3 w-3" />{Math.round(recipe.macros?.calorias || 0)}</span>
          {totalTime > 0 && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{totalTime}′</span>}
        </div>
      </div>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...easeOut, delay: stagger(index) }}
      className={cn("relative aspect-square rounded-[22px] overflow-hidden shadow-soft active:scale-[0.97] transition-transform", isSelected && "ring-[3px] ring-primary ring-offset-2 ring-offset-background")}
    >
      {isSelectionMode ? (
        <button type="button" onClick={() => onToggle(recipe.id)} className="absolute inset-0 text-left">{body}</button>
      ) : (
        <Link href={`/recetas/${recipe.id}`} className="absolute inset-0">{body}</Link>
      )}
    </motion.div>
  );
});
