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
          <Skeleton key={i} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-500">
      <header className="flex flex-col gap-3 sticky top-0 bg-background/95 backdrop-blur-md z-30 -mx-4 px-4 pb-3">
        <div className="flex items-center justify-between pt-2">
          <h1 className="text-xl font-semibold text-foreground">
            {isSelectionMode ? `${selectedIds.size} seleccionadas` : 'Recetas'}
          </h1>
          <div className="flex gap-2">
            {isSelectionMode ? (
              <Button size="icon" variant="ghost" onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }} className="rounded-full bg-primary text-white h-9 w-9">
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button size="icon" variant="ghost" onClick={() => router.push("/recetas/nueva")} className="rounded-full bg-primary text-white h-9 w-9">
                  <Plus className="h-5 w-5" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="rounded-full bg-muted text-muted-foreground h-9 w-9">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-2xl">
                    <DropdownMenuItem onClick={() => setIsSelectionMode(true)} className="gap-3">
                      <CheckSquare className="h-4 w-4" /> Seleccionar
                    </DropdownMenuItem>
                    <RecipePromptSheet onOpenImport={() => setIsImportOpen(true)} asMenuItem />
                    <DropdownMenuItem onClick={() => setIsImportOpen(true)} className="gap-3">
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar recetas o ingredientes..."
                className="pl-9 h-10 bg-white rounded-xl font-normal text-sm shadow-sm border border-border/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-1.5 items-center">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                    activeCategory === cat
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {cat}
                </button>
              ))}
              <button
                onClick={() => setIsTagsExpanded(!isTagsExpanded)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0",
                  isTagsExpanded ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                )}
              >
                <Hash className="h-3 w-3" /> Tags
              </button>
            </div>

            <AnimatePresence>
              {isTagsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap gap-1.5 pt-1 px-0.5">
                    {allTagsSorted.slice(0, 20).map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border",
                          activeTag === tag
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-muted-foreground border-border/50 hover:border-primary/30"
                        )}
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
      </header>

      {filteredRecipes.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {filteredRecipes.map((recipe, i) => (
            <RecipeListItem
              key={recipe.id}
              recipe={recipe}
              index={i}
              isSelectionMode={isSelectionMode}
              isSelected={selectedIds.has(recipe.id)}
              onToggleSelection={() => toggleRecipeSelection(recipe.id)}
            />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center">
          <p className="text-sm text-muted-foreground">No encontramos recetas</p>
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.35) }}
    >
      <Card
        onClick={handleClick}
        className={cn(
          "overflow-hidden border-none shadow-recipe hover:shadow-card-hover active:scale-[0.97] transition-all rounded-2xl h-full flex flex-col relative group",
          isSelected ? "ring-2 ring-primary" : "bg-white"
        )}
      >
        {isSelectionMode && (
          <div className={cn(
            "absolute top-2 right-2 z-20 h-6 w-6 rounded-full flex items-center justify-center border-2 shadow-sm",
            isSelected ? "bg-primary border-primary text-white" : "bg-white/90 border-white/60"
          )}>
            {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
          </div>
        )}
        <div className="relative h-28 w-full pointer-events-none bg-muted">
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
          <div className="absolute bottom-2 left-2 right-2">
            <h3 className="font-semibold text-[11px] leading-tight text-white drop-shadow-sm line-clamp-2">
              {recipe.nombre}
            </h3>
            {recipe.macros?.calorias > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] font-medium text-white/70 mt-0.5">
                <Flame className="h-2.5 w-2.5" /> {recipe.macros.calorias}
              </span>
            )}
          </div>
          <span className="absolute top-1.5 left-1.5 bg-black/30 backdrop-blur-sm text-[8px] font-medium text-white/90 rounded-md px-1.5 py-0.5">
            {primaryCategory}
          </span>
        </div>
        {!isSelectionMode && <Link href={`/recetas/${recipe.id}`} className="absolute inset-0 z-10" />}
      </Card>
    </motion.div>
  )
}
