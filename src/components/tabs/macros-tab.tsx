'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Trash2, Activity, Zap, Beef, Wheat, Droplets, Target, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, addDays, subDays, startOfWeek, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { doc, query, collection, where, deleteDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GoalSettingsSheet } from "@/components/macros/goal-settings-sheet";
import { AddMealLogDialog } from "@/components/macros/add-meal-log-dialog";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useAppStore } from '@/store/app-store';
import { USER_ID } from '@/lib/constants';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { GradientPlaceholder } from "@/components/gradient-placeholder";
import { getSafeImageSource } from "@/lib/utils";
import Image from "next/image";

const MOMENTOS = ["Desayuno", "Almuerzo", "Merienda", "Cena"];

function MacroRing({ label, value, target, size = 80 }: { label: string, value: number, target: number, size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = radius * 2 * Math.PI;
  const rawPercentage = target > 0 ? (value / target) * 100 : 0;
  const visualPercentage = Math.min(rawPercentage, 100);
  const offset = circumference - (visualPercentage / 100) * circumference;
  
  let ringColor = "hsl(var(--primary))";
  const ratio = target > 0 ? value / target : 0;
  
  if (ratio > 1.1) ringColor = "hsl(var(--destructive))";
  else if (ratio > 1.0) ringColor = "hsl(var(--accent))";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke="currentColor" strokeWidth="6" className="text-primary-suave" />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke={ringColor} strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-500 ease-out" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-black">{Math.round(rawPercentage)}%</span>
        </div>
      </div>
      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{label}</span>
    </div>
  );
}

export function MacrosTab() {
  const router = useRouter();
  const db = useFirestore();
  const { userProfile, macrosHoy, macrosSemana, macrosCargados, planificacion, activeProfile, recetas } = useAppStore();
  const [mounted, setMounted] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState(new Date());

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const dateStr = mounted ? format(selectedDate, "yyyy-MM-dd") : "";

  const dayLogsQuery = useMemoFirebase(() => {
    if (!db || !dateStr) return null;
    return query(
      collection(db, "users", USER_ID, "daily_logs"), 
      where("date", "==", dateStr),
      where("perfil", "==", activeProfile)
    );
  }, [db, dateStr, activeProfile]);

  const { data: rawDayLogs, loading: loadingLogs } = useCollection(dayLogsQuery);

  const dayLogs = React.useMemo(() => {
    if (!rawDayLogs) return [];
    return [...rawDayLogs].sort((a: any, b: any) => {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    });
  }, [rawDayLogs]);

  const goals = userProfile?.objetivosMacros || { calorias: 2000, proteinas: 150, carbohidratos: 250, grasas: 65 };
  
  const todayStr = mounted ? format(new Date(), "yyyy-MM-dd") : "";
  const isToday = dateStr === todayStr;
  
  const currentMacros = React.useMemo(() => {
    const summary = isToday ? macrosHoy : macrosSemana.find(m => (m.id === dateStr || m.date === dateStr));
    
    if (summary && summary.totalesDia && Number(summary.totalesDia.calorias) > 0) {
      return {
        calorias: Number(summary.totalesDia.calorias || 0),
        proteinas: Number(summary.totalesDia.proteinas || 0),
        carbohidratos: Number(summary.totalesDia.carbohidratos || 0),
        grasas: Number(summary.totalesDia.grasas || 0)
      };
    }
    
    if (dayLogs.length > 0) {
      return dayLogs.reduce((acc, log) => ({
        calorias: acc.calorias + Number(log.macros?.calorias || 0),
        proteinas: acc.proteinas + Number(log.macros?.proteinas || 0),
        carbohidratos: acc.carbohidratos + Number(log.macros?.carbohidratos || 0),
        grasas: acc.grasas + Number(log.macros?.grasas || 0),
      }), { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 });
    }

    const dayPlans = planificacion.filter(p => p.date === dateStr);
    if (dayPlans.length > 0) {
      return dayPlans.reduce((acc, p) => ({
        calorias: acc.calorias + Number(p.macros?.calorias || 0),
        proteinas: acc.proteinas + Number(p.macros?.proteinas || 0),
        carbohidratos: acc.carbohidratos + Number(p.macros?.carbohidratos || 0),
        grasas: acc.grasas + Number(p.macros?.grasas || 0),
      }), { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 });
    }

    return { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };
  }, [isToday, macrosHoy, macrosSemana, dayLogs, planificacion, dateStr]);

  const chartData = React.useMemo(() => {
    if (!mounted) return [];
    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const startTs = startOfDay(start).getTime();
    
    const data = days.map((label, i) => ({
      name: label,
      calorias: 0,
      proteinas: 0,
      carbohidratos: 0,
      grasas: 0
    }));

    macrosSemana.forEach(m => {
      const dateVal = m.date || m.id;
      if (!dateVal) return;
      const macroDate = new Date(dateVal + "T00:00:00");
      const diff = Math.floor((macroDate.getTime() - startTs) / (1000 * 60 * 60 * 24));
      
      if (diff >= 0 && diff < 7) {
        const t = m.totalesDia || {};
        data[diff].calorias = Number(t.calorias || 0);
        data[diff].proteinas = Number(t.proteinas || 0);
        data[diff].carbohidratos = Number(t.carbohidratos || 0);
        data[diff].grasas = Number(t.grasas || 0);
      }
    });
    
    return data;
  }, [macrosSemana, mounted, selectedDate]);

  const handleDeleteLog = async (log: any) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "users", USER_ID, "daily_logs", log.id));
      
      const summaryId = `${dateStr}_${activeProfile}`
      const summaryRef = doc(db, "users", USER_ID, "daily_macro_summaries", summaryId);
      const snap = await getDoc(summaryRef);
      if (snap.exists()) {
        const d = snap.data();
        const currentTotales = d.totalesDia || { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };
        await updateDoc(summaryRef, {
          "totalesDia.calorias": Math.max(0, Number(currentTotales.calorias || 0) - Number(log.macros?.calorias || 0)),
          "totalesDia.proteinas": Math.max(0, Number(currentTotales.proteinas || 0) - Number(log.macros?.proteinas || 0)),
          "totalesDia.carbohidratos": Math.max(0, Number(currentTotales.carbohidratos || 0) - Number(log.macros?.carbohidratos || 0)),
          "totalesDia.grasas": Math.max(0, Number(currentTotales.grasas || 0) - Number(log.macros?.grasas || 0)),
          updatedAt: serverTimestamp()
        });
      }
      toast({ title: "Registro eliminado" });
    } catch (e) { 
      toast({ variant: "destructive", title: "Error al eliminar" }); 
    }
  };

  if (!mounted || (!macrosCargados && dayLogs.length === 0 && macrosSemana.length === 0)) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-64 w-full rounded-[2rem]" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-primary leading-tight">Nutrición</h1>
          <div className="flex items-center gap-2 mt-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-primary-suave/50" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest min-w-[120px] text-center">
              {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-primary-suave/50" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <AddMealLogDialog date={dateStr}>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-primary text-white shadow-md">
                <Plus className="h-6 w-6" />
              </Button>
           </AddMealLogDialog>
           <div className="text-right hidden sm:block">
              <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest leading-none">Editando perfil</p>
              <p className="text-[10px] font-black uppercase text-primary leading-none mt-1">{activeProfile}</p>
           </div>
           <GoalSettingsSheet currentGoals={goals} />
        </div>
      </header>

      <Tabs defaultValue="dia" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-primary-suave p-1 rounded-2xl h-14 mb-6">
          <TabsTrigger value="dia" className="rounded-xl font-black uppercase text-xs data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Día</TabsTrigger>
          <TabsTrigger value="semana" className="rounded-xl font-black uppercase text-xs data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Semana</TabsTrigger>
        </TabsList>

        <TabsContent value="dia" className="space-y-8">
          <Card className="border-none shadow-recipe bg-white rounded-[2.5rem] overflow-hidden border-2 border-primary/5">
            <CardContent className="p-8">
              <div className="flex justify-around items-center">
                <MacroRing label="Kcal" value={currentMacros.calorias} target={goals.calorias} size={100} />
                <MacroRing label="Prot" value={currentMacros.proteinas} target={goals.proteinas} />
                <MacroRing label="Carbs" value={currentMacros.carbohidratos} target={goals.carbohidratos} />
                <MacroRing label="Grasas" value={currentMacros.grasas} target={goals.grasas} />
              </div>
              <div className="mt-6 pt-6 border-t border-primary/5 flex justify-center items-center gap-4">
                 <div className="flex items-center gap-2">
                    <Target className="h-3 w-3 text-primary/40" />
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Tus metas: {goals.calorias} kcal · {goals.proteinas}p · {goals.carbohidratos}c · {goals.grasas}g</span>
                 </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {MOMENTOS.map(m => {
              const logs = dayLogs?.filter(l => l.momento === m);
              const plans = planificacion.filter(p => p.date === dateStr && p.mealType === m);
              
              return (
                <section key={m} className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase text-primary px-4 tracking-[0.2em]">{m}</h3>
                  <div className="space-y-2">
                    {logs?.length > 0 ? (
                      logs.map(l => {
                        const recetaDelLog = recetas.find(r => r.id === l.recetaId);
                        return (
                          <MacroLogItem
                            key={l.id}
                            log={l}
                            receta={recetaDelLog}
                            onClick={() => router.push(`/recetas/${l.recetaId}`)}
                            onDelete={() => handleDeleteLog(l)}
                          />
                        );
                      })
                    ) : plans.length > 0 ? (
                      plans.map(p => {
                        const recetaDelPlan = recetas.find(r => r.id === p.recipeId);
                        const planImageUrl = getSafeImageSource(p) || getSafeImageSource(recetaDelPlan);
                        return (
                        <div key={p.id} className="px-4 opacity-60 grayscale-[0.5] pointer-events-none">
                           <Card className="border-none shadow-sm bg-primary-suave/30 rounded-2xl overflow-hidden border-dashed border-2">
                            <CardContent className="p-4 flex items-center gap-4">
                              <div className="h-10 w-10 rounded-xl overflow-hidden shrink-0 relative bg-muted">
                                {planImageUrl ? (
                                  <Image src={planImageUrl} alt={p.recipeName} fill className="object-cover" unoptimized />
                                ) : (
                                  <GradientPlaceholder categoria={p.recipeCategory || 'Almuerzo'} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm truncate text-foreground">{p.recipeName} (Planeado)</h4>
                                <p className="text-[10px] font-black text-primary uppercase mt-1 tracking-tight">
                                  {Math.round(p.macros?.calorias || 0)} kcal
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                        );
                      })
                    ) : !loadingLogs && (
                      <div className="px-4 py-6 border-2 border-dashed border-primary/5 rounded-2xl text-center opacity-30">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest italic">Sin registros</p>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="semana" className="space-y-6">
          <Card className="border-none shadow-recipe bg-white rounded-[2rem] p-6">
             <div className="flex items-center gap-2 mb-6">
                <Zap className="h-5 w-5 text-primary" />
                <h3 className="text-xs font-black text-primary uppercase tracking-widest">Evolución Calorías</h3>
             </div>
             <EvolutionChart data={chartData} dataKey="calorias" target={goals.calorias} color="#2D9A6B" unit="kcal" />
          </Card>

          <Card className="border-none shadow-recipe bg-white rounded-[2rem] p-6">
             <div className="flex items-center gap-2 mb-6">
                <Beef className="h-5 w-5 text-red-500" />
                <h3 className="text-xs font-black text-red-500 uppercase tracking-widest">Evolución Proteínas</h3>
             </div>
             <EvolutionChart data={chartData} dataKey="proteinas" target={goals.proteinas} color="#ef4444" unit="g" />
          </Card>

          <Card className="border-none shadow-recipe bg-white rounded-[2rem] p-6">
             <div className="flex items-center gap-2 mb-6">
                <Wheat className="h-5 w-5 text-amber-500" />
                <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest">Evolución Carbos</h3>
             </div>
             <EvolutionChart data={chartData} dataKey="carbohidratos" target={goals.carbohidratos} color="#f59e0b" unit="g" />
          </Card>

          <Card className="border-none shadow-recipe bg-white rounded-[2rem] p-6">
             <div className="flex items-center gap-2 mb-6">
                <Droplets className="h-5 w-5 text-blue-500" />
                <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Evolución Grasas</h3>
             </div>
             <EvolutionChart data={chartData} dataKey="grasas" target={goals.grasas} color="#3b82f6" unit="g" />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MacroLogItem({ log, receta, onClick, onDelete }: { log: any, receta?: any, onClick: () => void, onDelete: () => void }) {
  const imageUrl = getSafeImageSource(receta);
  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative group px-4">
      <div className="absolute inset-0 bg-destructive rounded-2xl flex items-center justify-end px-6 text-white mr-4 ml-4">
        <Trash2 className="h-6 w-6" />
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: -80, right: 0 }}
        onDragEnd={(_, info) => { if (info.offset.x < -50) onDelete(); }}
        className="relative z-10"
      >
        <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden active:scale-[0.98] transition-transform cursor-pointer border border-primary/5" onClick={onClick}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl overflow-hidden shrink-0 relative bg-muted">
              {imageUrl ? (
                <Image src={imageUrl} alt={log.recetaNombre} fill className="object-cover" unoptimized />
              ) : (
                <GradientPlaceholder categoria={log.recetaCategoria || 'Almuerzo'} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm truncate text-foreground">{log.recetaNombre}</h4>
              <p className="text-[10px] font-black text-primary uppercase mt-1 tracking-tight">
                {log.porciones} porc · {Math.round(log.macros?.calorias || 0)} kcal
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function EvolutionChart({ data, dataKey, target, color, unit }: { data: any[], dataKey: string, target: number, color: string, unit: string }) {
  const maxVal = Math.max(...data.map(d => d[dataKey]), target, 1);
  const activeData = data.filter(d => d[dataKey] > 0);
  const average = activeData.length > 0 
    ? Math.round(activeData.reduce((acc, d) => acc + d[dataKey], 0) / activeData.length) 
    : 0;
  
  return (
    <div className="h-48 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
            dy={10}
          />
          <YAxis hide domain={[0, maxVal * 1.1]} />
          <Tooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-white p-2 rounded-lg border shadow-sm">
                    <p className="text-[10px] font-black text-primary uppercase">{payload[0].payload.name}</p>
                    <p className="text-sm font-bold">{payload[0].value} {unit}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <ReferenceLine 
            y={target} 
            stroke={color} 
            strokeDasharray="3 3" 
            strokeOpacity={0.5}
            label={{ position: 'right', value: 'META', fill: color, fontSize: 8, fontWeight: 900 }}
          />
          <Area 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={3} 
            fillOpacity={1} 
            fill={`url(#gradient-${dataKey})`} 
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex justify-between items-center px-2 mt-4 border-t border-border/50 pt-2">
        <span className="text-[10px] font-black text-muted-foreground uppercase">Meta: {target} {unit}</span>
        <span className="text-[10px] font-black text-muted-foreground uppercase">Promedio: {average} {unit}</span>
      </div>
    </div>
  );
}
