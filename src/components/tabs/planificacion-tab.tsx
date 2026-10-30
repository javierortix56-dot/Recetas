'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Trash2, Plus, Sparkles, Loader2, CalendarX, MoreHorizontal, Minus } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import Image from "next/image";
import { useRouter } from "next/navigation";
import { format, addDays, startOfWeek, subWeeks, addWeeks, isSameWeek } from "date-fns";
import { es } from "date-fns/locale";
import { writeBatch, doc, serverTimestamp } from "firebase/firestore";
import { useShallow } from 'zustand/react/shallow';
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader, HeaderButton } from '@/components/ui/page-header';
import { MacroRing } from '@/components/ui/macro-ring';
import { easeOut, spring } from '@/components/ui/motion';
import { ProfileSwitcher } from '@/components/profile-switcher';
import { AddMealPlanDialog } from '@/components/plan/add-meal-plan-dialog';
import { GradientPlaceholder } from '@/components/gradient-placeholder';
import { useFirestore } from "@/firebase";
import { toast } from "@/hooks/use-toast";
import { useAppStore } from '@/store/app-store';
import { USER_ID } from '@/lib/constants';
import { cn, getSafeImageSource } from '@/lib/utils';
import { syncShoppingList } from '@/lib/sync-logic';
import { addMealPlan, addToSummary, clearPlansForDates, removeMealPlan, sumMacros, MOMENTOS, EMPTY_MACROS } from '@/lib/meal-plan';
import { autoPlanWeek } from '@/ai/flows/auto-plan-week-flow';
import { autoPlanDay } from '@/ai/flows/auto-plan-day-flow';

const DEFAULT_GOALS = { calorias: 2000, proteinas: 150, carbohidratos: 250, grasas: 65 };

const recipesForAI = (recetas: any[]) => recetas.map(r => ({
  id: r.id,
  nombre: r.nombre,
  categorias: r.categorias,
  categoria: r.categoria,
  tags: r.tags,
}));

export function PlanificacionTab() {
  const router = useRouter();
  const db = useFirestore();
  const { planificacion, planificacionCargada, recetas, activeProfile, userProfile } = useAppStore(useShallow(s => ({
    planificacion: s.planificacion,
    planificacionCargada: s.planificacionCargada,
    recetas: s.recetas,
    activeProfile: s.activeProfile,
    userProfile: s.userProfile,
  })));

  const [currentWeek, setCurrentWeek] = React.useState(() => new Date());
  const [selectedDay, setSelectedDay] = React.useState(() => format(new Date(), "yyyy-MM-dd"));
  const [planToDelete, setPlanToDelete] = React.useState<any>(null);
  const [busy, setBusy] = React.useState<null | 'week' | 'clear' | string>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = React.useState(false);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const startDate = React.useMemo(() => startOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);
  const weekDays = React.useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startDate, i)), [startDate]);
  const weekStrs = React.useMemo(() => weekDays.map(d => format(d, "yyyy-MM-dd")), [weekDays]);
  const recipesById = React.useMemo(() => new Map(recetas.map(r => [r.id, r])), [recetas]);

  // Planes agrupados por día una sola vez (antes se filtraba la lista en cada celda)
  const plansByDay = React.useMemo(() => {
    const map = new Map<string, any[]>();
    planificacion.forEach(p => {
      const list = map.get(p.date) || [];
      list.push(p);
      map.set(p.date, list);
    });
    return map;
  }, [planificacion]);

  const goals = userProfile?.objetivosMacros || DEFAULT_GOALS;
  const weeklyTotals = React.useMemo(() => sumMacros(weekStrs.flatMap(d => plansByDay.get(d) || [])), [weekStrs, plansByDay]);

  // Al cambiar de semana, seleccionar hoy (si está) o el lunes
  const goToWeek = (d: Date) => {
    setCurrentWeek(d);
    const start = startOfWeek(d, { weekStartsOn: 1 });
    setSelectedDay(isSameWeek(d, new Date(), { weekStartsOn: 1 }) ? todayStr : format(start, "yyyy-MM-dd"));
  };

  const commitAndSync = async (batch: ReturnType<typeof writeBatch>) => {
    await batch.commit();
    syncShoppingList(db, activeProfile).catch(() => {});
  };

  const writeAIPlans = async (plans: { date: string; mealType: string; recipeId: string }[], dates: string[]) => {
    const batch = writeBatch(db);
    await clearPlansForDates(batch, db, dates, activeProfile);
    const totals = new Map<string, typeof EMPTY_MACROS>();
    for (const p of plans) {
      const recipe = recipesById.get(p.recipeId);
      if (!recipe || !dates.includes(p.date)) continue;
      const macros = addMealPlan(batch, db, { recipe, date: p.date, mealType: p.mealType, portions: recipe.porciones || 3, profile: activeProfile });
      totals.set(p.date, sumMacros([{ macros: totals.get(p.date) || EMPTY_MACROS }, { macros }]));
    }
    totals.forEach((m, date) => addToSummary(batch, db, date, activeProfile, m));
    await commitAndSync(batch);
  };

  const handleAutoPlanWeek = async () => {
    if (!db || recetas.length === 0) return;
    setBusy('week');
    try {
      const result = await autoPlanWeek({ recipes: recipesForAI(recetas), startDate: weekStrs[0] });
      await writeAIPlans(result.plans, weekStrs);
      toast({ title: "Semana planificada ✨" });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error al generar el plan semanal" });
    } finally {
      setBusy(null);
    }
  };

  const handleAutoPlanDay = async (dateStr: string) => {
    if (!db || recetas.length === 0) return;
    setBusy(dateStr);
    try {
      const result = await autoPlanDay({ recipes: recipesForAI(recetas), date: dateStr });
      await writeAIPlans(result.plans.map(p => ({ ...p, date: dateStr })), [dateStr]);
      toast({ title: "Día planificado ✓" });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error al planificar el día" });
    } finally {
      setBusy(null);
    }
  };

  const handleClearWeek = async () => {
    if (!db) return;
    setBusy('clear');
    try {
      const batch = writeBatch(db);
      await clearPlansForDates(batch, db, weekStrs, activeProfile);
      await commitAndSync(batch);
      toast({ title: "Semana vaciada" });
    } catch {
      toast({ variant: "destructive", title: "Error al vaciar la semana" });
    } finally {
      setBusy(null);
    }
  };

  const handleUpdatePortions = async (plan: any, delta: number) => {
    if (!db) return;
    const next = Math.max(1, (plan.plannedPortions || 1) + delta);
    if (next === plan.plannedPortions) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "users", USER_ID, "meal_plans", plan.id), { plannedPortions: next, updatedAt: serverTimestamp() });
      await commitAndSync(batch);
    } catch {
      toast({ variant: "destructive", title: "No se pudieron cambiar las porciones" });
    }
  };

  const handleDelete = async () => {
    if (!db || !planToDelete) return;
    const plan = planToDelete;
    setPlanToDelete(null);
    try {
      const batch = writeBatch(db);
      await removeMealPlan(batch, db, plan, activeProfile);
      await commitAndSync(batch);
      toast({ title: "Comida quitada del plan" });
    } catch {
      toast({ variant: "destructive", title: "Error al quitar" });
    }
  };

  const selectedDate = new Date(selectedDay + "T00:00:00");
  const dayPlans = plansByDay.get(selectedDay) || [];
  const dayKcal = sumMacros(dayPlans).calorias;
  const isCurrentWeek = isSameWeek(currentWeek, new Date(), { weekStartsOn: 1 });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        subtitle={`${format(startDate, "d MMM", { locale: es })} – ${format(addDays(startDate, 6), "d MMM", { locale: es })}`}
        title="Plan"
        actions={
          <>
            <ProfileSwitcher />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <HeaderButton label="Acciones de la semana">
                  {busy === 'week' || busy === 'clear' ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
                </HeaderButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleAutoPlanWeek} disabled={!!busy || recetas.length === 0}>
                  <Sparkles className="text-accent" /> Planificar semana con IA
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsConfirmClearOpen(true)} disabled={!!busy} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                  <CalendarX /> Vaciar semana
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* Navegación de semana + tira de días */}
      <section className="glass rounded-[24px] p-3 space-y-3">
        <div className="flex items-center justify-between px-1">
          <button onClick={() => goToWeek(subWeeks(currentWeek, 1))} aria-label="Semana anterior" className="hit-44 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-foreground/5 active:scale-90">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => goToWeek(new Date())} disabled={isCurrentWeek} className="text-xs font-semibold text-primary disabled:text-foreground">
            {isCurrentWeek ? "Esta semana" : "Volver a hoy"}
          </button>
          <button onClick={() => goToWeek(addWeeks(currentWeek, 1))} aria-label="Semana siguiente" className="hit-44 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-foreground/5 active:scale-90">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day, i) => {
            const dayStr = weekStrs[i];
            const isSelected = selectedDay === dayStr;
            const isToday = dayStr === todayStr;
            const count = plansByDay.get(dayStr)?.length || 0;
            return (
              <button
                key={dayStr}
                onClick={() => setSelectedDay(dayStr)}
                className={cn("relative flex flex-col items-center gap-1 py-2 rounded-2xl transition-colors", isSelected ? "text-primary-foreground" : isToday ? "text-primary" : "text-foreground")}
              >
                {isSelected && <motion.span layoutId="plan-day" transition={spring} className="absolute inset-0 rounded-2xl bg-primary shadow-glow" />}
                <span className={cn("relative text-[10px] font-semibold uppercase", !isSelected && "text-muted-foreground")}>{format(day, "EEEEEE", { locale: es })}</span>
                <span className="relative text-base font-bold leading-none tabular-nums">{format(day, "d")}</span>
                <span className="relative flex gap-0.5 h-1">
                  {Array.from({ length: Math.min(count, 4) }).map((_, j) => (
                    <span key={j} className={cn("h-1 w-1 rounded-full", isSelected ? "bg-primary-foreground/80" : "bg-primary")} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Día seleccionado */}
      {!planificacionCargada && planificacion.length === 0 ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={selectedDay}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between px-1">
              <div>
                <p className="text-[15px] font-bold first-letter:uppercase">{format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{Math.round(dayKcal)} / {goals.calorias} kcal</p>
              </div>
              <button
                onClick={() => handleAutoPlanDay(selectedDay)}
                disabled={!!busy || recetas.length === 0}
                className="h-8 px-3 rounded-full glass text-xs font-semibold text-accent flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                {busy === selectedDay ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Armar día
              </button>
            </div>

            {MOMENTOS.map((m) => {
              const mealPlans = dayPlans.filter(p => p.mealType === m);
              return (
                <div key={m} className="glass rounded-[22px] p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between pl-1.5">
                    <p className="eyebrow">{m}</p>
                    <AddMealPlanDialog date={selectedDate} momento={m}>
                      <button aria-label={`Agregar a ${m}`} className="hit-44 h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center active:scale-90">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </AddMealPlanDialog>
                  </div>
                  {mealPlans.length === 0 && (
                    <AddMealPlanDialog date={selectedDate} momento={m}>
                      <button className="w-full h-11 rounded-2xl border border-dashed border-foreground/15 text-xs font-medium text-muted-foreground hover:bg-foreground/[0.03]">
                        Agregar receta
                      </button>
                    </AddMealPlanDialog>
                  )}
                  {mealPlans.map(plan => {
                    const recipe = recipesById.get(plan.recipeId);
                    const imageUrl = getSafeImageSource(recipe) || getSafeImageSource(plan);
                    return (
                      <motion.div layout key={plan.id} transition={easeOut} className="flex items-center gap-2.5 rounded-2xl bg-card/70 p-1.5 pr-2">
                        <button onClick={() => router.push(`/recetas/${plan.recipeId}`)} className="h-11 w-11 rounded-xl overflow-hidden shrink-0 relative bg-muted">
                          {imageUrl ? (
                            <Image src={imageUrl} alt={plan.recipeName} fill className="object-cover" unoptimized />
                          ) : (
                            <GradientPlaceholder categoria={plan.recipeCategory || "Almuerzo"} />
                          )}
                        </button>
                        <button onClick={() => router.push(`/recetas/${plan.recipeId}`)} className="flex-1 min-w-0 text-left">
                          <p className="font-semibold text-[13px] truncate leading-tight">{plan.recipeName}</p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">{Math.round(plan.macros?.calorias || 0)} kcal/porc.</p>
                        </button>
                        <div className="flex items-center gap-1 rounded-full bg-foreground/[0.05] p-0.5">
                          <button aria-label="Menos porciones" onClick={() => handleUpdatePortions(plan, -1)} className="h-6 w-6 rounded-full flex items-center justify-center active:scale-90"><Minus className="h-3 w-3" /></button>
                          <span className="text-[11px] font-bold tabular-nums w-5 text-center">{plan.plannedPortions || 1}</span>
                          <button aria-label="Más porciones" onClick={() => handleUpdatePortions(plan, 1)} className="h-6 w-6 rounded-full flex items-center justify-center active:scale-90"><Plus className="h-3 w-3" /></button>
                        </div>
                        <button aria-label="Quitar del plan" onClick={() => setPlanToDelete(plan)} className="hit-44 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })}
          </motion.section>
        </AnimatePresence>
      )}

      {/* Balance semanal */}
      <section className="glass rounded-[24px] p-4">
        <p className="eyebrow mb-3">Balance de la semana</p>
        <div className="flex justify-around items-center">
          <MacroRing label="Kcal" value={weeklyTotals.calorias} target={goals.calorias * 7} size={68} />
          <MacroRing label="Prot" value={weeklyTotals.proteinas} target={goals.proteinas * 7} size={56} strokeWidth={5} />
          <MacroRing label="Carbs" value={weeklyTotals.carbohidratos} target={goals.carbohidratos * 7} size={56} strokeWidth={5} />
          <MacroRing label="Grasas" value={weeklyTotals.grasas} target={goals.grasas * 7} size={56} strokeWidth={5} />
        </div>
      </section>

      <AlertDialog open={isConfirmClearOpen} onOpenChange={setIsConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Vaciar la semana?</AlertDialogTitle>
            <AlertDialogDescription>Se quitan todas las comidas planificadas de esta semana para este perfil.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearWeek} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Vaciar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!planToDelete} onOpenChange={(o) => !o && setPlanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar del plan?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quita <span className="font-semibold text-foreground">{planToDelete?.recipeName}</span> y su registro de macros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Quitar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
