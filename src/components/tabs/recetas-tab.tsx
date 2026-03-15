
'use client';

import * as React from 'react';
import { 
  Search, Download, Clock, CheckSquare, 
  Trash2, X, Check, Flame, Hash, Plus
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { GradientPlaceholder } from "@/components/gradient-placeholder";
import { RecipeImportModal } from "@/components/recipe-import-modal";
import { RecipePromptSheet } from "@/components/recipe-prompt-sheet";
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { USER_ID } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = ["Todos", "Desayuno", "Almuerzo", "Cena", "Merienda", "Postre", "Snack"];

export function RecetasTab() {
  const router = useRouter();
  const db = useFirestore();
  const { recetas, recetasCargadas } = useAppStore();
  const [search, setSearch] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState("Todos");
  const [activeTag, setActiveTag] = React.useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = React.useState(false);
  const [isTagsExpanded, setIsTagsExpanded] = React.useState(false);

  const [isSelectionMode, setIsSelectionMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = React.useState(false);

  const allTagsSorted = React.useMemo(() => {
    const tagCounts: Record<string, number> = {};
    recetas.forEach(r => {
      (r.tags || []).forEach((t: string) => {
        const tag = t.toLowerCase().trim();
        if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  }, [recetas]);

  const filteredRecipes = React.useMemo(() => {
    return recetas.filter(r => {
      const nombreLower = (r.nombre || "").toLowerCase();
      const ingredientsMatch = r.ingredientes?.some((ing: any) => 
        (ing.nombre || "").toLowerCase().includes(search.toLowerCase())
      );
      const matchesSearch = nombreLower.includes(search.toLowerCase()) || ingredientsMatch;
      
      const cats = Array.isArray(r.categorias) ? r.categorias : (r.categoria ? [r.categoria] : []);
      const matchesCategory = activeCategory === "Todos" || cats.includes(activeCategory);
      const matchesTag = !activeTag || (r.tags || []).some((t: string) => t.toLowerCase() === activeTag.toLowerCase());
      
      return matchesSearch && matchesCategory && matchesTag;
    });
  }, [recetas, search, activeCategory, activeTag]);

  const toggleRecipeSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleBatchDelete = async () => {
    if (!db || selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, "users", USER_ID, "recipes", id));
      });
      await batch.commit();
      toast({ title: "Recetas eliminadas" });
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!recetasCargadas && recetas.length === 0) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-32">
      <header className="flex flex-col gap-4 sticky top-0 bg-background/95 backdrop-blur-md z-30 -mx-4 px-4 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black tracking-tight text-primary">
            {isSelectionMode ? `(${selectedIds.size})` : 'Recetas'}
          </h1>
          <div className="flex gap-2">
            <Button size="icon" variant="ghost" onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds(new Set()); }} className={cn("rounded-full", isSelectionMode ? "bg-primary text-white" : "bg-primary-suave text-primary")}>
              {isSelectionMode ? <X className="h-5 w-5" /> : <CheckSquare className="h-5 w-5" />}
            </Button>
            {!isSelectionMode && (
              <>
                <Button size="icon" variant="ghost" onClick={() => router.push("/recetas/nueva")} className="rounded-full bg-primary text-white shadow-md">
                  <Plus className="h-6 w-6" />
                </Button>
                <RecipePromptSheet onOpenImport={() => setIsImportOpen(true)} />
                <Button size="icon" variant="ghost" onClick={() => setIsImportOpen(true)} className="rounded-full bg-primary-suave text-primary">
                  <Download className="h-6 w-6" />
                </Button>
              </>
            )}
          </div>
        </div>
        
        {!isSelectionMode && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Buscar recetas o ingredientes..." className="pl-10 h-12 bg-white rounded-2xl font-bold shadow-sm border-2 border-primary/5" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 snap-x items-center">
              {CATEGORIES.map((cat) => (
                <Badge key={cat} variant={activeCategory === cat ? "default" : "secondary"} className={cn("px-4 py-2 rounded-full cursor-pointer whitespace-nowrap text-[10px] font-black snap-start transition-all uppercase tracking-widest", activeCategory === cat ? "bg-primary text-white shadow-md" : "bg-primary-suave text-primary border-none")} onClick={() => setActiveCategory(cat)}>{cat}</Badge>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setIsTagsExpanded(!isTagsExpanded)} className={cn("rounded-full h-8 px-3 shrink-0 font-black text-[10px] uppercase tracking-widest gap-1", isTagsExpanded ? "bg-primary text-white" : "bg-primary-suave text-primary")}>
                <Hash className="h-3 w-3" /> Tags {isTagsExpanded ? '↑' : '↓'}
                {!isTagsExpanded && activeTag && <span className="bg-primary text-white text-[8px] rounded-full h-4 w-4 flex items-center justify-center ml-1">1</span>}
              </Button>
            </div>

            <AnimatePresence>
              {isTagsExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="flex flex-wrap gap-2 pt-2 px-1">
                    {allTagsSorted.slice(0, 20).map((tag) => (
                      <Badge key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)} className={cn("px-3 py-1.5 rounded-xl cursor-pointer text-[9px] font-bold transition-all uppercase border-none", activeTag === tag ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>#{tag}</Badge>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </header>

      {filteredRecipes.length > 0 ? (
        <div className="grid grid-cols-3 gap-4">
          {filteredRecipes.map((recipe) => (
            <RecipeListItem key={recipe.id} recipe={recipe} isSelectionMode={isSelectionMode} isSelected={selectedIds.has(recipe.id)} onToggleSelection={() => toggleRecipeSelection(recipe.id)} />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center">
          <p className="font-bold text-muted-foreground uppercase text-xs tracking-widest">No encontramos recetas</p>
        </div>
      )}

      <AnimatePresence>
        {isSelectionMode && selectedIds.size > 0 && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-20 left-4 right-4 z-[60] max-w-lg mx-auto">
            <div className="bg-primary shadow-2xl rounded-3xl p-4 flex items-center justify-between border-2 border-white/20">
              <span className="text-white font-black text-lg">{selectedIds.size} seleccionadas</span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="bg-white text-destructive rounded-2xl h-12 px-6 font-black uppercase text-xs gap-2"><Trash2 className="h-4 w-4" /> Borrar</Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[2rem]">
                  <AlertDialogHeader><AlertDialogTitle className="font-black text-primary">¿Borrar {selectedIds.size} recetas?</AlertDialogTitle></AlertDialogHeader>
                  <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBatchDelete} className="bg-destructive text-white rounded-xl font-black">Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <RecipeImportModal open={isImportOpen} onOpenChange={setIsImportOpen} />
    </div>
  );
}

function RecipeListItem({ recipe, isSelectionMode, isSelected, onToggleSelection }: any) {
  const [hasError, setHasError] = React.useState(false);
  const handleClick = (e: React.MouseEvent) => {
    if (isSelectionMode && onToggleSelection) {
      e.preventDefault();
      onToggleSelection();
    }
  };
  
  const primaryCategory = Array.isArray(recipe.categorias) && recipe.categorias.length > 0 ? recipe.categorias[0] : (recipe.categoria || "Almuerzo");
  const diff = recipe.dificultad === "Fácil" ? "bg-[#2D9A6B]" : recipe.dificultad === "Difícil" ? "bg-[#F43F5E]" : "bg-[#F59E0B]";
  
  // Priorizar fotoURL sobre imageUrl y forzar refresco con cache-busting
  const timestamp = recipe.updatedAt?.toMillis?.() || Date.now();
  const rawUrl = recipe.fotoURL || recipe.imageUrl;
  const imageSource = rawUrl ? `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}t=${timestamp}` : null;

  return (
    <Card onClick={handleClick} className={cn("overflow-hidden border-none shadow-recipe active:scale-[0.98] transition-all rounded-2xl h-full flex flex-col relative", isSelected ? "ring-4 ring-primary" : "bg-white")}>
      {isSelectionMode && <div className={cn("absolute top-2 right-2 z-20 h-6 w-6 rounded-full flex items-center justify-center border-2", isSelected ? "bg-primary border-primary text-white" : "bg-white/80 border-primary/20")}>{isSelected && <Check className="h-4 w-4 stroke-[4]" />}</div>}
      <div className="relative h-28 w-full pointer-events-none bg-primary-suave/30">
        {imageSource && !hasError ? (
          <Image 
            src={imageSource} 
            alt={recipe.nombre} 
            fill 
            className="object-cover" 
            unoptimized 
            onError={() => setHasError(true)}
          />
        ) : (
          <GradientPlaceholder categoria={primaryCategory} />
        )}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <Badge className="bg-white/90 text-[9px] font-black text-primary border-none h-5 px-1.5 uppercase truncate shadow-sm">
            {primaryCategory} {Array.isArray(recipe.categorias) && recipe.categorias.length > 1 && `+${recipe.categorias.length - 1}`}
          </Badge>
        </div>
        <Badge className="absolute bottom-2 right-2 bg-white/90 text-[9px] font-black text-foreground border-none h-5 px-1.5 flex items-center gap-1.5 shadow-sm">
          <div className={cn("h-1.5 w-1.5 rounded-full", diff)} />
          {recipe.dificultad}
        </Badge>
      </div>
      <CardContent className="p-3 flex flex-col flex-1 gap-2.5">
        <h3 className="font-black text-[11px] leading-tight text-foreground min-h-[1.5rem]">{recipe.nombre}</h3>
        <div className="space-y-1 mt-auto">
          <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase">
            <Clock className="h-3 w-3" /> {(recipe.tiempoPreparacion || 0) + (recipe.tiempoCoccion || 0)}'
          </div>
          <div className="flex items-center gap-1 text-[10px] font-black text-primary uppercase">
            <Flame className="h-3 w-3 fill-current" /> {recipe.macros?.calorias || 0} KCAL
          </div>
        </div>
        {!isSelectionMode && <Link href={`/recetas/${recipe.id}`} className="absolute inset-0 z-10" />}
      </CardContent>
    </Card>
  )
}
