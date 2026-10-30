'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Trash2, Plus, ArrowLeft, Target, CalendarClock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { format, addDays, subDays, startOfWeek, startOfDay, isToday as isTodayFn } from "date-fns";
import { es } from "date-fns/locale";
import { doc, query, collection, where, writeBatch } from "firebase/firestore";
import { useShallow } from 'zustand/react/shallow';
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, SectionTitle } from '@/components/ui/page-header';
import { MacroRing } from '@/components/ui/macro-ring';
import { Segmented } from '@/components/ui/segmented';
import { WeekBars } from '@/components/ui/week-bars';
import { easeOut } from '@/components/ui/motion';
import { ProfileSwitcher } from '@/components/profile-switcher';
import { GoalSettingsSheet } from "@/components/macros/goal-settings-sheet";
import { AddMealLogDialog } from "@/components/macros/add-meal-log-dialog";
import { GradientPlaceholder } from "@/components/gradient-placeholder";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { toast } from "@/hooks/use-toast";
import { useAppStore } from '@/store/app-store';
import { USER_ID } from '@/lib/constants';
import { getSafeImageSource } from "@/lib/utils";
import { addToSummary, recipeMacros, sumMacros, summaryDate, MOMENTOS } from '@/lib/meal-plan';

const DEFAULT_GOALS = { calorias: 2000, proteinas: 150, carbohidratos: 250, grasas: 65 };

export function MacrosTab() {
  const router = useRouter();
  const db = useFirestore();
  const { userProfile, macrosSemana, macrosCargados, activeProfile, recetas } = useAppStore(useShallow(s => ({
    userProfile: s.userProfile,
    macrosSemana: s.macrosSemana,
    macrosCargados: s.macrosCargados,
    activeProfile: s.activeProfile,
    recetas: s.recetas,
  })));
  const [selectedDate, setSelectedDate] = React.useState(() => new Date());
  const [view, setView] = React.useState<'dia' | 'semana'>('dia');

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const recipesById = React.useMemo(() => new Map(recetas.map(r => [r.id, r])), [recetas]);

  const dayLogsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, "users", USER_ID, "daily_logs"),
      where("date", "==", dateStr),
      where("perfil", "==", activeProfile)
    );
  }, [db, dateStr, activeProfile]);

  const { data: rawDayLogs, loading: loadingLogs } = useCollection<any>(dayLogsQuery);

  const dayLogs = React.useMemo(() => [...(rawDayLogs || [])].sort((a: any, b: any) =>
    (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0)
  ), [rawDayLogs]);

  const goals = userProfile?.objetivosMacros || DEFAULT_GOALS;

  // Fuente de verdad: los registros del día. El resumen solo se usa para la vista semanal.
  const current = React.useMemo(() => sumMacros(dayLogs), [dayLogs]);

  const weekData = React.useMemo(() => {
    const start = startOfDay(startOfWeek(selectedDate, { weekStartsOn: 1 })).getTime();
    const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const days = labels.map((label, i) => ({ label, i, calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }));
    macrosSemana.forEach(m => {
      const d = summaryDate(m);
      if (!d) return;
      const diff = Math.round((new Date(d + "T00:00:00").getTime() - start) / 86_400_000);
      if (diff >= 0 && diff < 7) Object.assign(days[diff], sumMacros([{ macros: m.totalesDia }]));
    });
    const selIdx = (selectedDate.getDay() + 6) % 7;
    return days.map(d => ({ ...d, highlight: d.i === selIdx }));
  }, [macrosSemana, selectedDate]);

  const handleDeleteLog = async (log: any) => {
    if (!db) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "users", USER_ID, "daily_logs", log.id));
      addToSummary(batch, db, dateStr, activeProfile, recipeMacros(log), -1);
      await batch.commit();
      toast({ title: "Registro eliminado" });
    } catch {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  const isToday = isTodayFn(selectedDate);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        subtitle={
          <button onClick={() => router.push('/inicio')} className="inline-flex items-center gap-1 text-primary font-semibold">
            <ArrowLeft className="h-3 w-3" /> Inicio
          </button>
        }
        title="Nutrición"
        actions={
          <>
            <ProfileSwitcher />
            <GoalSettingsSheet currentGoals={goals} />
          </>
        }
      >
        <Segmented id="macros-view" options={[{ value: 'dia', label: 'Día' }, { value: 'semana', label: 'Semana' }]} value={view} onChange={setView} />
      </PageHeader>

      {/* Selector de fecha */}
      <div className="flex items-center justify-between glass rounded-full h-11 px-1">
        <button onClick={() => setSelectedDate(subDays(selectedDate, view === 'semana' ? 7 : 1))} aria-label="Anterior" className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground active:scale-90"><ChevronLeft className="h-4 w-4" /></button>
        <button onClick={() => setSelectedDate(new Date())} className="text-sm font-semibold capitalize">
          {view === 'semana'
            ? `Semana del ${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "d 'de' MMM", { locale: es })}`
            : isToday ? "Hoy" : format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
        </button>
        <button onClick={() => setSelectedDate(addDays(selectedDate, view === 'semana' ? 7 : 1))} aria-label="Siguiente" className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground active:scale-90"><ChevronRight className="h-4 w-4" /></button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {view === 'dia' ? (
          <motion.div key="dia" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.18 }} className="flex flex-col gap-4">
            <section className="glass rounded-[24px] p-5">
              <div className="flex justify-around items-center">
                <MacroRing label="Kcal" value={current.calorias} target={goals.calorias} size={92} strokeWidth={8} showValue />
                <MacroRing label="Prot" value={current.proteinas} target={goals.proteinas} showValue unit="g" />
                <MacroRing label="Carbs" value={current.carbohidratos} target={goals.carbohidratos} showValue unit="g" />
                <MacroRing label="Grasas" value={current.grasas} target={goals.grasas} showValue unit="g" />
              </div>
              <p className="mt-4 pt-3 border-t border-hairline text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                <Target className="h-3 w-3" /> Meta: {goals.calorias} kcal · {goals.proteinas} P · {goals.carbohidratos} C · {goals.grasas} G
              </p>
            </section>

            <SectionTitle action={
              <AddMealLogDialog date={dateStr}>
                <button className="h-8 px-3 rounded-full glass text-xs font-semibold text-primary flex items-center gap-1 active:scale-95">
                  <Plus className="h-3.5 w-3.5" /> Comida fuera del plan
                </button>
              </AddMealLogDialog>
            }>
              Registro del día
            </SectionTitle>

            {loadingLogs && dayLogs.length === 0 ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : dayLogs.length === 0 ? (
              <button onClick={() => router.push('/planificacion')} className="glass rounded-[22px] p-5 flex items-center gap-4 text-left active:scale-[0.99]">
                <span className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0"><CalendarClock className="h-5 w-5 text-primary" /></span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold">Sin registros este día</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">Lo que planifiques se registra automáticamente</span>
                </span>
              </button>
            ) : (
              <div className="space-y-3">
                {MOMENTOS.map(m => {
                  const logs = dayLogs.filter((l: any) => l.momento === m);
                  if (logs.length === 0) return null;
                  return (
                    <div key={m} className="glass rounded-[22px] p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between px-1.5">
                        <p className="eyebrow">{m}</p>
                        <p className="text-[11px] font-semibold text-muted-foreground tabular-nums">{Math.round(sumMacros(logs).calorias)} kcal</p>
                      </div>
                      <AnimatePresence initial={false}>
                        {logs.map((log: any) => (
                          <LogRow
                            key={log.id}
                            log={log}
                            image={getSafeImageSource(recipesById.get(log.recetaId))}
                            onOpen={() => router.push(`/recetas/${log.recetaId}`)}
                            onDelete={() => handleDeleteLog(log)}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="semana" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }} className="flex flex-col gap-3">
            {!macrosCargados && macrosSemana.length === 0 ? (
              <Skeleton className="h-48 w-full rounded-[24px]" />
            ) : (
              ([
                ['Calorías', 'calorias', goals.calorias, ' kcal', 'primary'],
                ['Proteínas', 'proteinas', goals.proteinas, 'g', 'destructive'],
                ['Carbohidratos', 'carbohidratos', goals.carbohidratos, 'g', 'accent'],
                ['Grasas', 'grasas', goals.grasas, 'g', 'sky'],
              ] as const).map(([label, key, target, unit, color], i) => {
                const values = weekData.map(d => d[key]);
                const active = values.filter(v => v > 0);
                const avg = active.length ? Math.round(active.reduce((a, b) => a + b, 0) / active.length) : 0;
                return (
                  <motion.section key={key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...easeOut, delay: i * 0.05 }} className="glass rounded-[24px] p-4">
                    <div className="flex items-baseline justify-between mb-3">
                      <p className="eyebrow">{label}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">promedio <span className="font-semibold text-foreground">{avg}{unit}</span></p>
                    </div>
                    <WeekBars data={weekData.map(d => ({ label: d.label, value: d[key], highlight: d.highlight }))} target={target} unit={unit.trim() === 'kcal' ? '' : unit} color={color} height={i === 0 ? 120 : 96} />
                  </motion.section>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LogRow({ log, image, onOpen, onDelete }: { log: any; image: string | null; onOpen: () => void; onDelete: () => void }) {
  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={easeOut} className="flex items-center gap-2.5 rounded-2xl bg-card/70 p-1.5 pr-2">
      <button onClick={onOpen} className="h-11 w-11 rounded-xl overflow-hidden shrink-0 relative bg-muted">
        {image ? <Image src={image} alt={log.recetaNombre} fill className="object-cover" unoptimized /> : <GradientPlaceholder categoria={log.recetaCategoria || 'Almuerzo'} />}
      </button>
      <button onClick={onOpen} className="flex-1 min-w-0 text-left">
        <p className="font-semibold text-[13px] truncate leading-tight">{log.recetaNombre}</p>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {log.planId ? "Planificado" : `${log.porciones} porc.`} · {Math.round(log.macros?.calorias || 0)} kcal · {Math.round(log.macros?.proteinas || 0)}g P
        </p>
      </button>
      {/* Lo planificado se quita desde Plan, para no dejar plan y registro desincronizados */}
      {!log.planId && (
        <button aria-label="Eliminar registro" onClick={onDelete} className="hit-44 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.div>
  );
}
