'use client';

import * as React from 'react';
import {
  Search, Download, Clock, CheckSquare,
  X, Check, Flame, Hash, Plus, Users, MoreVertical, Bot
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { GradientPlaceholder } from "@/components/gradient-placeholder";
import { RecipeImportModal } from "@/components/recipe-import-modal";
import { RecipePromptSheet } from "@/components/recipe-prompt-sheet";
import { useAppStore } from '@/store/app-store';
import { cn, getSafeImageSource } from '@/lib/utils';
import { useFirestore } from '@/firebase';
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

  if (!recetasCargadas && recetas.length === 0) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-3xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-32">
      <header className="flex flex-col gap-4 sticky top-0 bg-background/95 backdrop-blur-md z-30 -mx-4 px-4 pb-4">
        <div className="flex items-center justify-between pt-2">
          <h1 className="text-3xl font-black tracking-tight text-primary">
            {isSelectionMode ? `(${selectedIds.size})` : 'Recetas'}
          </h1>
          <div className="flex gap-2">
            {isSelectionMode ? (
              <Button size="icon" variant="ghost" onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }} className="rounded-full bg-primary text-white">
                <X className="h-5 w-5" />
              </Button>
            ) : (
              <>
                <Button size="icon" variant="ghost" onClick={() => router.push("/recetas/nueva")} className="rounded-full bg-primary text-white shadow-md">
                  <Plus className="h-6 w-6" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="rounded-full bg-primary-suave text-primary">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-2xl">
                    <DropdownMenuItem onClick={() => setIsSelectionMode(true)} className="gap-3 font-bold">
                      <CheckSquare className="h-4 w-4" /> Seleccionar
                    </DropdownMenuItem>
                    <RecipePromptSheet onOpenImport={() => setIsImportOpen(true)} asMenuItem />
                    <DropdownMenuItem onClick={() => setIsImportOpen(true)} className="gap-3 font-bold">
                      <Download className="h-4 w-4" /> Importar JSON
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
        
        {!isSelectionMode && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Buscar recetas..." className="pl-10 h-12 bg-white rounded-2xl font-bold shadow-sm border-2 border-primary/5" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            
            <div className="flex flex-wrap gap-2 pb-1 items-center">
              {CATEGORIES.map((cat) => (
                <Badge key={cat} variant={activeCategory === cat ? "default" : "secondary"} className={cn("px-4 py-2 rounded-full cursor-pointer whitespace-nowrap text-[10px] font-black snap-start transition-all uppercase tracking-widest", activeCategory === cat ? "bg-primary text-white shadow-md" : "bg-primary-suave text-primary border-none")} onClick={() => setActiveCategory(cat)}>{cat}</Badge>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setIsTagsExpanded(!isTagsExpanded)} className={cn("rounded-full h-8 px-3 shrink-0 font-black text-[10px] uppercase tracking-widest gap-1", isTagsExpanded ? "bg-primary text-white" : "bg-primary-suave text-primary")}>
                <Hash className="h-3 w-3" /> Tags {isTagsExpanded ? '↑' : '↓'}
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
        <div className="grid grid-cols-3 gap-2">
          {filteredRecipes.map((recipe, i) => (
            <RecipeListItem key={recipe.id} recipe={recipe} index={i} isSelectionMode={isSelectionMode} isSelected={selectedIds.has(recipe.id)} onToggleSelection={() => toggleRecipeSelection(recipe.id)} />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center">
          <p className="font-bold text-muted-foreground uppercase text-xs tracking-widest">No encontramos recetas</p>
        </div>
      )}

      <RecipeImportModal open={isImportOpen} onOpenChange={setIsImportOpen} />
    </div>
  );
}

function RecipeListItem({ recipe, index, isSelectionMode, isSelected, onToggleSelection }: any) {
  const handleClick = (e: React.MouseEvent) => {
    if (isSelectionMode && onToggleSelection) {
      e.preventDefault();
      onToggleSelection();
    }
  };

  const primaryCategory = Array.isArray(recipe.categorias) && recipe.categorias.length > 0 ? recipe.categorias[0] : (recipe.categoria || "Almuerzo");
  const imageSource = getSafeImageSource(recipe);
  const totalTime = (recipe.tiempoPreparacion || 0) + (recipe.tiempoCoccion || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.4) }}
    >
      <Card onClick={handleClick} className={cn("overflow-hidden border-none shadow-recipe hover:shadow-card-hover active:scale-[0.97] transition-all rounded-3xl h-full flex flex-col relative group", isSelected ? "ring-4 ring-primary" : "bg-white")}>
        {isSelectionMode && <div className={cn("absolute top-3 right-3 z-20 h-7 w-7 rounded-full flex items-center justify-center border-2", isSelected ? "bg-primary border-primary text-white" : "bg-white/80 border-primary/20")}>{isSelected && <Check className="h-4 w-4 stroke-[4]" />}</div>}
        <div className="relative h-24 w-full pointer-events-none bg-muted">
          {imageSource ? (
            <Image
              src={imageSource}
              alt={recipe.nombre}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              unoptimized
            />
          ) : (
            <GradientPlaceholder categoria={primaryCategory} className="rounded-none" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
          <div className="absolute bottom-2 left-2 right-2">
            <h3 className="font-black text-[11px] leading-tight text-white drop-shadow-sm line-clamp-2">{recipe.nombre}</h3>
            <span className="flex items-center gap-0.5 text-[9px] font-black text-white/80 mt-0.5">
              <Flame className="h-2.5 w-2.5" /> {recipe.macros?.calorias || 0}
            </span>
          </div>
          <Badge className="absolute top-1.5 left-1.5 bg-white/90 backdrop-blur-sm text-[7px] font-black text-primary border-none h-4 px-1.5 uppercase shadow-sm">
            {primaryCategory}
          </Badge>
        </div>
        {!isSelectionMode && <Link href={`/recetas/${recipe.id}`} className="absolute inset-0 z-10" />}
      </Card>
    </motion.div>
  )
}
