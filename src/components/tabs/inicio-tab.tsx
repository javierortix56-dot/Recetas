'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, TrendingDown, TrendingUp, Minus, CalendarPlus, AlertTriangle, ShoppingCart } from 'lucide-react';
import { motion } from 'framer-motion';
import { format, startOfWeek, startOfDay, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { useShallow } from 'zustand/react/shallow';
import Image from "next/image";
import { GradientPlaceholder } from '@/components/gradient-placeholder';
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, SectionTitle } from '@/components/ui/page-header';
import { WeekBars } from '@/components/ui/week-bars';
import { ProfileSwitcher } from '@/components/profile-switcher';
import { easeOut, stagger } from '@/components/ui/motion';
import { useAppStore } from '@/store/app-store';
import { cn, formatPrecio, getSafeImageSource, weekId } from '@/lib/utils';
import { MOMENTOS, sumMacros, summaryDate } from '@/lib/meal-plan';

const DEFAULT_GOALS = { calorias: 2000, proteinas: 150, carbohidratos: 250, grasas: 65 };

export function InicioTab() {
  const router = useRouter();
  const [now, setNow] = React.useState<Date | null>(null);
  const { userProfile, planificacion, macrosSemana, recetas, historialCompras, ingredientes, listaCompras, planificacionCargada } = useAppStore(useShallow(s => ({
    userProfile: s.userProfile,
    planificacion: s.planificacion,
    macrosSemana: s.macrosSemana,
    recetas: s.recetas,
    historialCompras: s.historialCompras,
    ingredientes: s.ingredientes,
    listaCompras: s.listaCompras,
    planificacionCargada: s.planificacionCargada,
  })));

  // "Hoy" se recalcula al volver a la app y cada minuto: en iPhone la app
  // instalada se reanuda sin recargar y, si no, mostraba el día anterior
  React.useEffect(() => {
    const tick = () => setNow(prev => (prev && prev.toDateString() === new Date().toDateString() ? prev : new Date()));
    tick();
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    const id = window.setInterval(tick, 60_000);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.clearInterval(id); };
  }, []);

  const todayStr = now ? format(now, "yyyy-MM-dd") : "";
  const goals = userProfile?.objetivosMacros || DEFAULT_GOALS;
  const recipesById = React.useMemo(() => new Map(recetas.map(r => [r.id, r])), [recetas]);

  const todayPlans = React.useMemo(() => planificacion
    .filter(p => p.date === todayStr)
    .sort((a, b) => MOMENTOS.indexOf(a.mealType) - MOMENTOS.indexOf(b.mealType)),
  [planificacion, todayStr]);

  // El resumen de hoy se busca por fecha (macrosHoy del store se fija al llegar el snapshot)
  const todaySummary = React.useMemo(() => macrosSemana.find(m => summaryDate(m) === todayStr) || null, [macrosSemana, todayStr]);
  const currentMacros = React.useMemo(() => {
    if (todaySummary?.totalesDia && Number(todaySummary.totalesDia.calorias) > 0) {
      return sumMacros([{ macros: todaySummary.totalesDia }]);
    }
    return sumMacros(todayPlans);
  }, [todaySummary, todayPlans]);

  const weeklyData = React.useMemo(() => {
    if (!now) return [];
    const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const startTs = startOfDay(startOfWeek(now, { weekStartsOn: 1 })).getTime();
    const todayIdx = (now.getDay() + 6) % 7;
    const data = labels.map((label, i) => ({ label, value: 0, highlight: i === todayIdx }));
    macrosSemana.forEach(m => {
      const date = summaryDate(m);
      if (!date) return;
      const diff = Math.round((new Date(date + "T00:00:00").getTime() - startTs) / 86_400_000);
      if (diff >= 0 && diff < 7) data[diff].value = Number(m.totalesDia?.calorias || 0);
    });
    return data;
  }, [macrosSemana, now]);

  const spending = React.useMemo(() => {
    if (!now) return null;
    const current = historialCompras.find(h => h.semana === weekId(now))?.totalGastado || 0;
    const previous = historialCompras.find(h => h.semana === weekId(subWeeks(now, 1)))?.totalGastado || 0;
    const diffPercent = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;
    return { current, previous, diffPercent };
  }, [historialCompras, now]);

  const lowStock = React.useMemo(
    () => ingredientes.filter(i => Number(i.stockMinimo) > 0 && Number(i.stockActual) <= Number(i.stockMinimo)).length,
    [ingredientes]
  );
  const pendingCompras = React.useMemo(() => listaCompras.filter(i => !i.isPurchased).length, [listaCompras]);

  if (!now) return <div className="space-y-4"><Skeleton className="h-16 w-2/3" /><Skeleton className="h-48 w-full rounded-[24px]" /></div>;

  const h = now.getHours();
  const greeting = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  const goTo = (tab: string) => router.push(`/${tab}`);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        subtitle={`${greeting} · ${format(now, "EEE d MMM", { locale: es })}`}
        title={userProfile?.displayName?.split(' ')[0] || 'Chef'}
        actions={<ProfileSwitcher />}
      />

      {/* Héroe de nutrición */}
      <motion.button
        type="button"
        onClick={() => goTo('macros')}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={easeOut}
        className="relative overflow-hidden rounded-[28px] bg-brand text-white p-5 text-left shadow-lift active:scale-[0.99] transition-transform"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/75">Nutrición de hoy</p>
            <p className="mt-1.5 text-[34px] leading-none font-bold tracking-tight tabular-nums">
              {Math.round(currentMacros.calorias).toLocaleString('es-AR')}
              <span className="text-base font-semibold text-white/70"> / {goals.calorias} kcal</span>
            </p>
          </div>
          <span className="h-9 w-9 rounded-full bg-white/15 flex items-center justify-center">
            <ChevronRight className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden">
          <motion.div
            className={cn("h-full rounded-full", currentMacros.calorias > goals.calorias * 1.1 ? "bg-rose-300" : "bg-white")}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((currentMacros.calorias / Math.max(goals.calorias, 1)) * 100, 100)}%` }}
            transition={{ ...easeOut, duration: 0.7 }}
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {([
            ['Proteínas', currentMacros.proteinas, goals.proteinas],
            ['Carbos', currentMacros.carbohidratos, goals.carbohidratos],
            ['Grasas', currentMacros.grasas, goals.grasas],
          ] as const).map(([label, value, target]) => (
            <div key={label} className="rounded-2xl bg-white/15 px-3 py-2">
              <p className="text-[10px] font-semibold text-white/70">{label}</p>
              <p className="text-sm font-bold tabular-nums">{Math.round(value)}<span className="text-white/60 font-medium">/{target}g</span></p>
            </div>
          ))}
        </div>
      </motion.button>

      {/* Plan de hoy */}
      <section className="space-y-2.5">
        <SectionTitle action={
          <button onClick={() => goTo('planificacion')} className="text-xs font-semibold text-primary flex items-center gap-0.5">
            Ver semana <ChevronRight className="h-3.5 w-3.5" />
          </button>
        }>
          Plan de hoy
        </SectionTitle>

        {!planificacionCargada && planificacion.length === 0 ? (
          <div className="flex gap-3"><Skeleton className="h-36 w-40 rounded-[22px]" /><Skeleton className="h-36 w-40 rounded-[22px]" /></div>
        ) : todayPlans.length > 0 ? (
          <div className="-mx-4 px-4 flex gap-3 overflow-x-auto scrollbar-hide snap-x pb-1">
            {todayPlans.map((plan, i) => {
              const recipe = recipesById.get(plan.recipeId);
              const imageUrl = getSafeImageSource(recipe) || getSafeImageSource(plan);
              return (
                <motion.button
                  key={plan.id}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...easeOut, delay: stagger(i, 0.05) }}
                  onClick={() => router.push(`/recetas/${plan.recipeId}`)}
                  className="relative shrink-0 w-40 h-36 rounded-[22px] overflow-hidden snap-start shadow-soft active:scale-[0.97] transition-transform text-left"
                >
                  {imageUrl ? (
                    <Image src={imageUrl} alt={plan.recipeName} fill className="object-cover" unoptimized />
                  ) : (
                    <GradientPlaceholder categoria={plan.recipeCategory || "Almuerzo"} className="rounded-none" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                  <span className="absolute top-2 left-2 rounded-full bg-black/30 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold text-white">{plan.mealType}</span>
                  <div className="absolute bottom-2.5 left-3 right-3 text-white">
                    <p className="font-semibold text-[13px] leading-tight line-clamp-2">{plan.recipeName}</p>
                    <p className="text-[11px] text-white/75 mt-0.5 tabular-nums">{Math.round(plan.macros?.calorias || 0)} kcal · {plan.plannedPortions || 1} porc.</p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        ) : (
          <button
            onClick={() => goTo('planificacion')}
            className="w-full glass rounded-[22px] p-5 flex items-center gap-4 text-left active:scale-[0.99] transition-transform"
          >
            <span className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarPlus className="h-5 w-5 text-primary" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">Nada planificado para hoy</span>
              <span className="block text-xs text-muted-foreground mt-0.5">Elegí recetas o dejá que la IA arme el día</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </section>

      {/* Accesos rápidos con estado */}
      {(lowStock > 0 || pendingCompras > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => goTo('compras')} className="glass rounded-[22px] p-4 text-left active:scale-[0.98] transition-transform">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <p className="mt-2 text-2xl font-bold tabular-nums leading-none">{pendingCompras}</p>
            <p className="text-xs text-muted-foreground mt-1">por comprar</p>
          </button>
          <button onClick={() => goTo('stock')} className="glass rounded-[22px] p-4 text-left active:scale-[0.98] transition-transform">
            <AlertTriangle className={cn("h-5 w-5", lowStock > 0 ? "text-accent" : "text-muted-foreground")} />
            <p className="mt-2 text-2xl font-bold tabular-nums leading-none">{lowStock}</p>
            <p className="text-xs text-muted-foreground mt-1">con stock bajo</p>
          </button>
        </div>
      )}

      {/* Semana */}
      <section className="glass rounded-[24px] p-4">
        <SectionTitle className="px-0 mb-1">
          Calorías de la semana
        </SectionTitle>
        <div className="pt-3"><WeekBars data={weeklyData} target={goals.calorias} /></div>
      </section>

      {/* Gasto */}
      {spending && (
        <button onClick={() => goTo('compras')} className="glass rounded-[24px] p-4 text-left active:scale-[0.99] transition-transform">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Gasto en compras</p>
            <span className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold",
              spending.diffPercent > 0 ? "bg-destructive/10 text-destructive" : spending.diffPercent < 0 ? "bg-primary/10 text-primary" : "bg-foreground/5 text-muted-foreground"
            )}>
              {spending.diffPercent > 0 ? <TrendingUp className="h-3 w-3" /> : spending.diffPercent < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {Math.abs(spending.diffPercent)}%
            </span>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground">Esta semana</p>
              <p className="text-2xl font-bold tracking-tight tabular-nums">{formatPrecio(spending.current)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">Anterior</p>
              <p className="text-base font-semibold text-muted-foreground tabular-nums">{formatPrecio(spending.previous)}</p>
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
