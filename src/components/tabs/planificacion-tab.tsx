
'use client';

import * as React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Eye, 
  Plus,
  MoreVertical,
  Sparkles,
  Loader2,
  CalendarX,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, addDays, startOfWeek, subWeeks, addWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { collection, writeBatch, doc, serverTimestamp, getDocs, query, where, increment } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useAppStore } from '@/store/app-store';
import { AddMealPlanDialog } from '@/components/plan/add-meal-plan-dialog';
import { USER_ID } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { GradientPlaceholder } from '@/components/gradient-placeholder';
import { motion, AnimatePresence } from 'framer-motion';
import { autoPlanWeek } from '@/ai/flows/auto-plan-week-flow';
import { autoPlanDay } from '@/ai/flows/auto-plan-day-flow';
import Image from "next/image";
import { syncShoppingList } from '@/lib/sync-logic';

const MOMENTOS = ["Desayuno", "Almuerzo", "Merienda", "Cena"];

// Helper robusto para obtener el timestamp de una imagen
const getImageSource = (recipe: any) => {
  const rawUrl = recipe?.recipeImageUrl || recipe?.fotoURL || recipe?.imageUrl;
  if (!rawUrl) return null;
  
  let ts = "";
  if (recipe.updatedAt) {
    if (typeof recipe.updatedAt.toMillis === 'function') ts = recipe.updatedAt.toMillis();
    else if (recipe.updatedAt.seconds) ts = recipe.updatedAt.seconds * 1000;
  }
  
  return ts ? `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}t=${ts}` : rawUrl;
};

function WeeklyMacroRing({ label, value, target, size = 60, strokeWidth = 5, icon: Icon }: { label: string, value: number, target: number, size?: number, strokeWidth?: number, icon?: any }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const rawPercentage = target > 0 ? (value / target) * 100 : 0;
  const visualPercentage = Math.min(rawPercentage, 100);
  const offset = circumference - (visualPercentage / 100) * circumference;

  let ringColor = "text-primary";
  if (rawPercentage > 110) ringColor = "text-destructive";
  else if (rawPercentage > 100) ringColor = "text-accent";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke="currentColor" strokeWidth={strokeWidth} className="text-primary-suave" />
          <circle 
            cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke="currentColor" 
            strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} 
            strokeLinecap="round" className={`${ringColor} transition-all duration-700 ease-out`} 
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {Icon && <Icon className={cn("h-3 w-3 mb-0.5", ringColor)} />}
          <span className="text-[10px] font-black leading-none">{Math.round(rawPercentage)}%</span>
        </div>
      </div>
      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter">{label}</span>
    </div>
  );
}

export function PlanificacionTab() {
  const router = useRouter();
  const db = useFirestore();
  const { planificacion, planificacionCargada, recetas, activeProfile, userProfile } = useAppStore();
  
  const [currentWeek, setCurrentWeek] = React.useState(new Date());
  const [expandedDay, setExpandedDay] = React.useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = React.useState<any>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isAutoPlanning, setIsAutoPlanning] = React.useState(false);
  const [isAutoPlanningDay, setIsAutoPlanningDay] = React.useState<string | null>(null);
  const [isClearing, setIsClearing] = React.useState(false);

  const startDate = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

  const goals = userProfile?.objetivosMacros || { calorias: 2000, proteinas: 150, carbohidratos: 250, grasas: 65 };
  const weeklyGoals = React.useMemo(() => ({
    calorias: goals.calorias * 7,
    proteinas: goals.proteinas * 7,
    carbohidratos: goals.carbohidratos * 7,
    grasas: goals.grasas * 7
  }), [goals]);

  const weeklyTotals = React.useMemo(() => {
    const weekStrArray = weekDays.map(d => format(d, "yyyy-MM-dd"));
    const weekPlans = planificacion.filter(p => weekStrArray.includes(p.date));
    
    return weekPlans.reduce((acc, p) => {
      const m = p.macros || {};
      return {
        calorias: acc.calorias + (Number(m.calorias) || 0),
        proteinas: acc.proteinas + (Number(m.proteinas) || 0),
        carbohidratos: acc.carbohidratos + (Number(m.carbohidratos) || 0),
        grasas: acc.grasas + (Number(m.grasas) || 0),
      };
    }, { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 });
  }, [planificacion, weekDays]);

  React.useEffect(() => {
    if (planificacionCargada && !expandedDay) {
      setExpandedDay(format(new Date(), "yyyy-MM-dd"));
    }
  }, [planificacionCargada, expandedDay]);

  const handleAutoPlan = async () => {
    if (!db || recetas.length === 0) return;
    setIsAutoPlanning(true);
    try {
      const result = await autoPlanWeek({
        recipes: recetas.map(r => ({
          id: r.id,
          nombre: r.nombre,
          categorias: r.categorias,
          categoria: r.categoria,
          tags: r.tags
        })),
        startDate: format(startDate, "yyyy-MM-dd")
      });

      const batch = writeBatch(db);
      const weekStr = weekDays.map(d => format(d, "yyyy-MM-dd"));
      
      const currentPlansSnap = await getDocs(query(
        collection(db, "users", USER_ID, "meal_plans"), 
        where("date", "in", weekStr),
        where("perfil", "==", activeProfile)
      ));
      currentPlansSnap.docs.forEach(d => batch.delete(d.ref));
      
      const currentLogsSnap = await getDocs(query(
        collection(db, "users", USER_ID, "daily_logs"), 
        where("date", "in", weekStr),
        where("perfil", "==", activeProfile)
      ));
      currentLogsSnap.docs.forEach(d => batch.delete(d.ref));

      for (const date of weekStr) {
        const summaryId = `${date}_${activeProfile}`
        batch.set(doc(db, "users", USER_ID, "daily_macro_summaries", summaryId), {
          totalesDia: { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 },
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      for (const p of result.plans) {
        const fullRecipe = recetas.find(r => r.id === p.recipeId);
        if (!fullRecipe) continue;

        const m = fullRecipe.macros || {};
        const macrosCalculados = {
          calorias: Math.round(Number(m.calorias || 0)),
          proteinas: Math.round(Number(m.proteinas || 0)),
          carbohidratos: Math.round(Number(m.carbohidratos || 0)),
          grasas: Math.round(Number(m.grasas || 0)),
        };

        const planRef = doc(collection(db, "users", USER_ID, "meal_plans"));
        batch.set(planRef, {
          userId: USER_ID,
          perfil: activeProfile,
          date: p.date,
          mealType: p.mealType,
          recipeId: p.recipeId,
          recipeName: p.recipeName,
          recipeCategory: fullRecipe.categoria || "Almuerzo",
          recipeImageUrl: fullRecipe.fotoURL || fullRecipe.imageUrl || null,
          plannedPortions: 3,
          recipeOriginalPortions: fullRecipe.porciones || 1,
          macros: macrosCalculados,
          ingredientes: fullRecipe.ingredientes || [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        batch.set(doc(collection(db, "users", USER_ID, "daily_logs")), {
          userId: USER_ID,
          perfil: activeProfile,
          date: p.date,
          momento: p.mealType,
          recetaId: p.recipeId,
          recetaNombre: p.recipeName,
          recetaCategoria: fullRecipe.categoria || "Almuerzo",
          porciones: 1, 
          macros: macrosCalculados,
          planId: planRef.id,
          createdAt: serverTimestamp()
        });

        const summaryRef = doc(db, "users", USER_ID, "daily_macro_summaries", `${p.date}_${activeProfile}`);
        batch.set(summaryRef, {
          totalesDia: {
            calorias: increment(macrosCalculados.calorias),
            proteinas: increment(macrosCalculados.proteinas),
            carbohidratos: increment(macrosCalculados.carbohidratos),
            grasas: increment(macrosCalculados.grasas)
          },
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      await batch.commit();
      await syncShoppingList(db);
      toast({ title: `¡Plan de ${activeProfile} listo! ✨` });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error al generar plan semanal" });
    } finally {
      setIsAutoPlanning(false);
    }
  };

  const handleAutoPlanDay = async (date: Date) => {
    if (!db || recetas.length === 0) return;

    const dateStr = format(date, "yyyy-MM-dd");
    setIsAutoPlanningDay(dateStr);
    try {
      const result = await autoPlanDay({
        recipes: recetas.map(r => ({
          id: r.id,
          nombre: r.nombre,
          categorias: r.categorias,
          categoria: r.categoria,
          tags: r.tags
        })),
        date: dateStr
      });

      const batch = writeBatch(db);
      
      const currentLogsSnap = await getDocs(query(
        collection(db, "users", USER_ID, "daily_logs"), 
        where("date", "==", dateStr),
        where("perfil", "==", activeProfile)
      ));
      currentLogsSnap.docs.forEach(d => batch.delete(d.ref));

      const summaryRef = doc(db, "users", USER_ID, "daily_macro_summaries", `${dateStr}_${activeProfile}`);
      batch.set(summaryRef, {
        totalesDia: { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 },
        updatedAt: serverTimestamp()
      }, { merge: true });

      for (const p of result.plans) {
        const fullRecipe = recetas.find(r => r.id === p.recipeId);
        if (!fullRecipe) continue;

        const m = fullRecipe.macros || {};
        const macrosCalculados = {
          calorias: Math.round(Number(m.calorias || 0)),
          proteinas: Math.round(Number(m.proteinas || 0)),
          carbohidratos: Math.round(Number(m.carbohidratos || 0)),
          grasas: Math.round(Number(m.grasas || 0)),
        };

        const planRef = doc(collection(db, "users", USER_ID, "meal_plans"));
        batch.set(planRef, {
          userId: USER_ID,
          perfil: activeProfile,
          date: dateStr,
          mealType: p.mealType,
          recipeId: p.recipeId,
          recipeName: p.recipeName,
          recipeCategory: fullRecipe.categoria || "Almuerzo",
          recipeImageUrl: fullRecipe.fotoURL || fullRecipe.imageUrl || null,
          plannedPortions: 3,
          recipeOriginalPortions: fullRecipe.porciones || 1,
          macros: macrosCalculados,
          ingredientes: fullRecipe.ingredientes || [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        batch.set(doc(collection(db, "users", USER_ID, "daily_logs")), {
          userId: USER_ID,
          perfil: activeProfile,
          date: dateStr,
          momento: p.mealType,
          recetaId: p.recipeId,
          recetaNombre: p.recipeName,
          recetaCategoria: fullRecipe.categoria || "Almuerzo",
          porciones: 1, 
          macros: macrosCalculados,
          planId: planRef.id,
          createdAt: serverTimestamp()
        });

        batch.set(summaryRef, {
          totalesDia: {
            calorias: increment(macrosCalculados.calorias),
            proteinas: increment(macrosCalculados.proteinas),
            carbohidratos: increment(macrosCalculados.carbohidratos),
            grasas: increment(macrosCalculados.grasas)
          },
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      await batch.commit();
      await syncShoppingList(db);
      
      toast({ title: `Día de ${activeProfile} planeado ✓` });
      setExpandedDay(dateStr);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al planear el día" });
    } finally {
      setIsAutoPlanningDay(null);
    }
  };

  const handleUnplanWeek = async () => {
    if (!db) return;
    setIsClearing(true);
    try {
      const batch = writeBatch(db);
      const weekStr = weekDays.map(d => format(d, "yyyy-MM-dd"));
      
      const currentPlansSnap = await getDocs(query(
        collection(db, "users", USER_ID, "meal_plans"), 
        where("date", "in", weekStr),
        where("perfil", "==", activeProfile)
      ));
      
      const currentLogsSnap = await getDocs(query(
        collection(db, "users", USER_ID, "daily_logs"), 
        where("date", "in", weekStr),
        where("perfil", "==", activeProfile)
      ));
      
      currentPlansSnap.docs.forEach(d => batch.delete(d.ref));
      currentLogsSnap.docs.forEach(d => batch.delete(d.ref));
      
      for (const date of weekStr) {
        const summaryId = `${date}_${activeProfile}`
        batch.set(doc(db, "users", USER_ID, "daily_macro_summaries", summaryId), {
          totalesDia: { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 },
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      await batch.commit();
      await syncShoppingList(db);
      toast({ title: `Semana desplanificada` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al limpiar plan" });
    } finally {
      setIsClearing(false);
    }
  };

  const handleUpdatePortions = async (planId: string, currentPortions: number, delta: number) => {
    if (!db) return;
    const newPortions = Math.max(1, currentPortions + delta);
    try {
      const planRef = doc(db, "users", USER_ID, "meal_plans", planId);
      await writeBatch(db)
        .update(planRef, { plannedPortions: newPortions, updatedAt: serverTimestamp() })
        .commit();
      await syncShoppingList(db);
    } catch (e) {}
  };

  const handleDeleteFromPlan = async () => {
    if (!db || !selectedPlan) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "users", USER_ID, "meal_plans", selectedPlan.id));
      
      const logSnap = await getDocs(query(
        collection(db, "users", USER_ID, "daily_logs"), 
        where("planId", "==", selectedPlan.id),
        where("perfil", "==", activeProfile)
      ));
      logSnap.docs.forEach(d => batch.delete(d.ref));

      const macros = selectedPlan.macros || {};
      const summaryRef = doc(db, "users", USER_ID, "daily_macro_summaries", `${selectedPlan.date}_${activeProfile}`);
      batch.set(summaryRef, {
        totalesDia: {
          calorias: increment(-Math.round(macros.calorias || 0)),
          proteinas: increment(-Math.round(macros.proteinas || 0)),
          carbohidratos: increment(-Math.round(macros.carbohidratos || 0)),
          grasas: increment(-Math.round(macros.grasas || 0))
        },
        updatedAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();
      await syncShoppingList(db);
      
      toast({ title: "Comida eliminada" });
      setSelectedPlan(null);
    } catch (e) { 
      toast({ variant: "destructive", title: "Error al borrar" }); 
    }
    finally { setIsDeleting(false); }
  };

  if (!planificacionCargada && planificacion.length === 0) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12">
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black text-primary">Planificación</h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Semana de {activeProfile}</p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <AlertDialog>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={isClearing} className="h-10 w-10 bg-destructive/10 text-destructive rounded-full border border-destructive/20">
                      {isClearing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CalendarX className="h-5 w-5" />}
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <AlertDialogContent className="rounded-[2rem]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-black text-primary text-xl">¿Desplanificar tu semana?</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm font-medium">Se quitarán tus comidas de esta semana. Los planes de los demás no se tocarán.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleUnplanWeek} className="bg-destructive text-white rounded-xl font-black">Sí, vaciar mi plan</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <TooltipContent>Vaciar tu plan semanal</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleAutoPlan} disabled={isAutoPlanning} className="h-10 w-10 bg-accent/10 text-accent rounded-full border border-accent/20">
                  {isAutoPlanning ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Planear tu semana con IA</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex items-center gap-1 bg-white border rounded-full p-1 shadow-sm">
            <Button variant="ghost" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))} className="h-8 w-8 rounded-full"><ChevronLeft className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))} className="h-8 w-8 rounded-full"><ChevronRight className="h-5 w-5" /></Button>
          </div>
        </div>
      </header>

      <Card className="border-none shadow-recipe bg-white rounded-[2.5rem] overflow-hidden border-2 border-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-[10px] font-black uppercase text-primary tracking-widest">Cumplimiento del Plan Semanal</h3>
            </div>
            <Badge variant="secondary" className="bg-primary-suave text-primary border-none text-[8px] px-2 font-black uppercase">En Tiempo Real</Badge>
          </div>
          
          <div className="flex justify-around items-center">
            <WeeklyMacroRing label="Calorías" value={weeklyTotals.calorias} target={weeklyGoals.calorias} size={85} strokeWidth={7} icon={Flame} />
            <WeeklyMacroRing label="Prots" value={weeklyTotals.proteinas} target={weeklyGoals.proteinas} icon={Beef} />
            <WeeklyMacroRing label="Carbos" value={weeklyTotals.carbohidratos} target={weeklyGoals.carbohidratos} icon={Wheat} />
            <WeeklyMacroRing label="Grasas" value={weeklyTotals.grasas} target={weeklyGoals.grasas} icon={Droplets} />
          </div>

          <div className="mt-6 pt-4 border-t border-primary/5">
            <p className="text-[8px] font-black text-muted-foreground uppercase text-center tracking-widest leading-relaxed">
              Basado en {planificacion.length} comidas planeadas para esta semana.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {weekDays.map((day) => {
          const dayStr = format(day, "yyyy-MM-dd");
          const isExpanded = expandedDay === dayStr;
          const plans = planificacion.filter(p => p.date === dayStr);
          const isLoadingThisDay = isAutoPlanningDay === dayStr;

          return (
            <div key={dayStr} className={cn("rounded-3xl border border-border overflow-hidden bg-white", isExpanded && "shadow-md ring-2 ring-primary/10")}>
              <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => setExpandedDay(isExpanded ? null : dayStr)}>
                <div className="flex items-center gap-3">
                  <span className="text-base font-black capitalize">{format(day, "EEEE d", { locale: es })}</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-accent/5 text-accent rounded-full hover:bg-accent/10" onClick={(e) => { e.stopPropagation(); handleAutoPlanDay(day); }} disabled={!!isAutoPlanningDay}>
                          {isLoadingThisDay ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Planear tu día</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <ChevronLeft className={cn("h-5 w-5 transition-transform", isExpanded ? "-rotate-90" : "")} />
              </div>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden bg-background/30 border-t">
                    <div className="p-4 space-y-4">
                      {MOMENTOS.map((m) => {
                        const plan = plans.find(p => p.mealType === m);
                        const recipe = plan ? recetas.find(r => r.id === plan.recipeId) : null;
                        const imageUrl = getImageSource(plan) || getImageSource(recipe);

                        return (
                          <div key={m} className="flex items-start gap-4">
                            <span className="w-20 text-[10px] font-black text-muted-foreground uppercase pt-3 shrink-0">{m}</span>
                            {plan ? (
                              <div className="flex-1 flex items-center gap-3 bg-white p-2 rounded-2xl relative shadow-sm border">
                                <div className="h-12 w-12 rounded-xl overflow-hidden shrink-0 relative">
                                  {imageUrl ? (
                                    <Image 
                                      src={imageUrl} 
                                      alt={plan.recipeName} 
                                      fill 
                                      className="object-cover" 
                                      unoptimized
                                    />
                                  ) : (
                                    <GradientPlaceholder categoria={plan.recipeCategory || "Almuerzo"} />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 pr-8">
                                  <h4 className="font-bold text-sm truncate leading-tight cursor-pointer" onClick={() => router.push(`/recetas/${plan.recipeId}`)}>{plan.recipeName}</h4>
                                  <div className="flex items-center gap-3 mt-1">
                                    <div className="flex items-center gap-1.5">
                                      <button onClick={() => handleUpdatePortions(plan.id, plan.plannedPortions || 3, -1)} className="h-5 w-5 bg-background rounded shadow-sm flex items-center justify-center font-bold">-</button>
                                      <span className="text-[10px] font-black">{plan.plannedPortions || 3}p</span>
                                      <button onClick={() => handleUpdatePortions(plan.id, plan.plannedPortions || 3, 1)} className="h-5 w-5 bg-background rounded shadow-sm flex items-center justify-center font-bold">+</button>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] font-black text-primary uppercase">
                                      <Flame className="h-3 w-3 fill-current" />
                                      {plan.macros?.calorias ?? recipe?.macros?.calorias ?? 0} kcal
                                    </div>
                                  </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSelectedPlan(plan)}><MoreVertical className="h-4 w-4" /></Button>
                              </div>
                            ) : (
                              <AddMealPlanDialog date={day} momento={m} onSave={() => {}}>
                                <button className="flex-1 h-14 border-2 border-dashed border-border rounded-2xl flex items-center justify-center gap-2 text-muted-foreground hover:bg-primary/5 transition-colors">
                                  <Plus className="h-4 w-4" /><span className="text-[10px] font-black uppercase">Planificar</span>
                                </button>
                              </AddMealPlanDialog>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      <Sheet open={!!selectedPlan} onOpenChange={(open) => !open && setSelectedPlan(null)}>
        <SheetContent side="bottom" className="rounded-t-[2rem] p-6 pb-12">
          <SheetHeader className="mb-6"><SheetTitle className="text-left font-black text-primary text-xl">Gestionar Comida</SheetTitle></SheetHeader>
          <div className="grid gap-2">
            <Button variant="ghost" className="h-14 rounded-2xl justify-start gap-4" onClick={() => { router.push(`/recetas/${selectedPlan.recipeId}`); setSelectedPlan(null); }}><Eye className="h-6 w-6 text-primary" /><span className="font-bold">Ver Receta completa</span></Button>
            <Button variant="ghost" className="h-14 rounded-2xl justify-start gap-4 text-destructive" onClick={handleDeleteFromPlan} disabled={isDeleting}><Trash2 className="h-6 w-6" /><span className="font-bold">Eliminar de tu plan</span></Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
