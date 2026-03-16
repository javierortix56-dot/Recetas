'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronRight, Calendar, Activity, DollarSign, TrendingDown, TrendingUp, Minus
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { GradientPlaceholder } from '@/components/gradient-placeholder';
import { format, startOfWeek, startOfDay, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from '@/store/app-store';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, ReferenceLine } from "recharts";
import Image from "next/image";
import { cn, formatPrecio } from '@/lib/utils';

function MacroRing({ label, value, target, size = 60, strokeWidth = 6 }: { label: string, value: number, target: number, size?: number, strokeWidth?: number }) {
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
            strokeLinecap="round" className={`${ringColor} transition-all duration-500`} 
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-black">{Math.round(rawPercentage)}%</span>
        </div>
      </div>
      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-tight">{label}</span>
    </div>
  );
}

function WeeklyEvolutionChart({ data, target }: { data: any[], target: number }) {
  const maxVal = Math.max(...data.map(d => d.value), target, 1);
  
  return (
    <div className="h-32 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorVal" x1="0" x2="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
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
          <ReferenceLine y={target} stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeOpacity={0.3} />
          <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" animationDuration={1000} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function InicioTab() {
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const { userProfile, macrosHoy, planificacion, macrosSemana, recetas, historialCompras } = useAppStore();

  const [formattedDate, setFormattedDate] = React.useState("");

  React.useEffect(() => {
    setMounted(true);
    const now = new Date();
    setFormattedDate(format(now, "EEEE d 'de' MMMM", { locale: es }));
  }, []);

  const todayStr = React.useMemo(() => mounted ? format(new Date(), "yyyy-MM-dd") : "", [mounted]);
  const goals = userProfile?.objetivosMacros || { calorias: 2000, proteinas: 150, carbohidratos: 250, grasas: 65 };
  
  const currentMacros = React.useMemo(() => {
    if (macrosHoy && macrosHoy.totalesDia && Number(macrosHoy.totalesDia.calorias) > 0) {
      return {
        calorias: Number(macrosHoy.totalesDia.calorias || 0),
        proteinas: Number(macrosHoy.totalesDia.proteinas || 0),
        carbohidratos: Number(macrosHoy.totalesDia.carbohidratos || 0),
        grasas: Number(macrosHoy.totalesDia.grasas || 0)
      };
    }
    
    const todayPlans = planificacion.filter(p => p.date === todayStr);
    return todayPlans.reduce((acc, p) => ({
      calorias: acc.calorias + Number(p.macros?.calorias || 0),
      proteinas: acc.proteinas + Number(p.macros?.proteinas || 0),
      carbohidratos: acc.carbohidratos + Number(p.macros?.carbohidratos || 0),
      grasas: acc.grasas + Number(p.macros?.grasas || 0),
    }), { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 });
  }, [macrosHoy, planificacion, todayStr]);

  const todayPlansSorted = React.useMemo(() => {
    const orden = ["Desayuno", "Almuerzo", "Merienda", "Cena"];
    return planificacion
      .filter(p => p.date === todayStr)
      .sort((a, b) => orden.indexOf(a.mealType) - orden.indexOf(b.mealType));
  }, [planificacion, todayStr]);

  const weeklyData = React.useMemo(() => {
    if (!mounted) return [];
    const labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const data = labels.map(label => ({ name: label, value: 0 }));
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const startTs = startOfDay(start).getTime();
    
    macrosSemana.forEach(m => {
      const dateVal = m.date || m.id;
      if (!dateVal) return;
      const macroDate = new Date(dateVal + "T00:00:00");
      const diff = Math.floor((macroDate.getTime() - startTs) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff < 7) {
        data[diff].value = Number(m.totalesDia?.calorias || 0);
      }
    });
    return data;
  }, [macrosSemana, mounted]);

  // Gasto Semanal Comparativo
  const spendingStats = React.useMemo(() => {
    if (!mounted) return null;
    const weekId = format(new Date(), "yyyy-'W'ww");
    const lastWeekId = format(subWeeks(new Date(), 1), "yyyy-'W'ww");
    
    const currentWeekData = historialCompras.find(h => h.semana === weekId);
    const lastWeekData = historialCompras.find(h => h.semana === lastWeekId);
    
    const current = currentWeekData?.totalGastado || 0;
    const previous = lastWeekData?.totalGastado || 0;
    
    let diffPercent = 0;
    if (previous > 0) {
      diffPercent = Math.round(((current - previous) / previous) * 100);
    }

    return { current, previous, diffPercent };
  }, [historialCompras, mounted]);

  if (!mounted) {
    return <div className="space-y-6 p-4"><Skeleton className="h-48 w-full rounded-[2rem]" /></div>;
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-primary leading-none uppercase tracking-tighter">
            {userProfile?.displayName?.split(' ')[0] || 'Chef'}
          </h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1.5">{formattedDate}</p>
        </div>
        <Avatar className="h-10 w-10 ring-4 ring-primary/5">
          <AvatarFallback className="bg-primary-suave text-primary font-black text-xs">CF</AvatarFallback>
        </Avatar>
      </header>

      <Card className="border-none shadow-recipe bg-white rounded-3xl cursor-pointer" onClick={() => router.push('/macros')}>
        <CardContent className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-black flex items-center gap-2 uppercase">
              <Activity className="h-5 w-5 text-primary" /> Nutrición de hoy
            </h3>
            <Badge variant="secondary" className="bg-primary-suave text-primary border-none text-[10px] px-3">En vivo</Badge>
          </div>
          <div className="flex justify-around items-center pt-2">
            <MacroRing label="Kcal" value={currentMacros.calorias} target={goals.calorias} size={85} />
            <MacroRing label="Prot" value={currentMacros.proteinas} target={goals.proteinas} />
            <MacroRing label="Carbs" value={currentMacros.carbohidratos} target={goals.carbohidratos} />
            <MacroRing label="Grasas" value={currentMacros.grasas} target={goals.grasas} />
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base font-black flex items-center gap-2 uppercase">
            <Calendar className="h-5 w-5 text-primary" /> Mi Plan de hoy
          </h3>
          <Button variant="link" className="text-primary font-black text-[10px] p-0" onClick={() => router.push('/planificacion')}>
            Ver calendario <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
        
        {todayPlansSorted.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x px-1">
            {todayPlansSorted.map((plan) => {
              const recipe = recetas.find(r => r.id === plan.recipeId);
              const imageUrl = plan.recipeImageUrl || recipe?.fotoURL || recipe?.imageUrl;

              return (
                <Card key={plan.id} className="min-w-[180px] max-w-[180px] border-none shadow-sm rounded-2xl overflow-hidden snap-start active:scale-95 transition-transform" onClick={() => router.push(`/recetas/${plan.recipeId}`)}>
                  <div className="h-24 w-full relative">
                    {imageUrl ? (
                      <Image 
                        src={imageUrl} 
                        alt={plan.recipeName} 
                        fill 
                        className="object-cover" 
                      />
                    ) : (
                      <GradientPlaceholder categoria={plan.recipeCategory || "Almuerzo"} />
                    )}
                    <Badge className="absolute top-2 right-2 bg-white/90 text-[8px] font-black text-primary border-none">{plan.mealType}</Badge>
                  </div>
                  <CardContent className="p-3">
                    <h4 className="font-bold text-xs truncate leading-tight">{plan.recipeName}</h4>
                    <p className="text-[9px] font-black text-primary uppercase mt-1">
                      {Math.round(plan.macros?.calorias || recipe?.macros?.calorias || 0)} kcal
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="bg-primary/5 border-2 border-dashed border-primary/20 rounded-[2rem] p-8 text-center cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => router.push('/planificacion')}>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Nada planeado para hoy. ¡Empezá a cocinar!</p>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-none shadow-recipe bg-white rounded-3xl">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-base font-black flex items-center gap-2 uppercase">
              <Activity className="h-5 w-5 text-primary" /> Progreso de Calorías
            </h3>
            <WeeklyEvolutionChart data={weeklyData} target={goals.calorias} />
          </CardContent>
        </Card>

        {/* Nuevo Widget de Gasto Semanal */}
        <Card className="border-none shadow-recipe bg-white rounded-3xl overflow-hidden" onClick={() => router.push('/compras')}>
          <CardContent className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black flex items-center gap-2 uppercase">
                <DollarSign className="h-5 w-5 text-primary" /> Gasto Semanal
              </h3>
              {spendingStats && (
                <div className={cn(
                  "flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase",
                  spendingStats.diffPercent > 0 ? "bg-destructive/10 text-destructive" : spendingStats.diffPercent < 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {spendingStats.diffPercent > 0 ? <TrendingUp className="h-3 w-3" /> : spendingStats.diffPercent < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  {Math.abs(spendingStats.diffPercent)}%
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Esta semana</p>
                <p className="text-2xl font-black text-primary leading-tight">{formatPrecio(spendingStats?.current || 0)}</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">La anterior</p>
                <p className="text-xl font-bold text-muted-foreground leading-tight">{formatPrecio(spendingStats?.previous || 0)}</p>
              </div>
            </div>

            {spendingStats && (
              <div className="space-y-2">
                <div className="h-2 w-full bg-primary-suave rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-primary transition-all duration-1000" 
                    style={{ width: `${Math.min((spendingStats.current / (spendingStats.previous || spendingStats.current || 1)) * 100, 100)}%` }} 
                  />
                </div>
                {!spendingStats.previous && <p className="text-[10px] font-bold text-muted-foreground italic text-center">Sin datos de la semana pasada</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
