'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/store/app-store';
import { InicioTab } from './tabs/inicio-tab';
import { RecetasTab } from './tabs/recetas-tab';
import { StockTab } from './tabs/stock-tab';
import { PlanificacionTab } from './tabs/planificacion-tab';
import { ComprasTab } from './tabs/compras-tab';
import { MacrosTab } from './tabs/macros-tab';
import { cn } from '@/lib/utils';

/**
 * @fileOverview Contenedor principal que maneja la persistencia de las pestañas.
 * Usa visibilidad CSS para mantener el estado del scroll y de los componentes.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeTab, setActiveTab } = useAppStore();
  
  // Normalización para soportar rutas con o sin barra final, y la raíz
  const normalizedPath = React.useMemo(() => {
    if (!pathname || pathname === '/' || pathname === '/inicio' || pathname === '/inicio/') return '/inicio';
    return pathname.replace(/\/$/, '');
  }, [pathname]);

  React.useEffect(() => {
    const pathMap: Record<string, string> = {
      '/inicio': 'inicio',
      '/planificacion': 'planificacion',
      '/recetas': 'recetas',
      '/stock': 'stock',
      '/compras': 'compras',
      '/macros': 'macros'
    };

    if (pathMap[normalizedPath]) {
      setActiveTab(pathMap[normalizedPath]);
    }
  }, [normalizedPath, setActiveTab]);

  const isCoreTab = ['/inicio', '/planificacion', '/recetas', '/stock', '/compras', '/macros'].includes(normalizedPath);

  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden">
      {/* Paneles persistentes */}
      <div className={cn("tab-panel absolute inset-0 overflow-y-auto pb-24 px-4 pt-4", (activeTab === 'inicio' && isCoreTab) ? 'visible' : 'hidden')}>
        <InicioTab />
      </div>
      <div className={cn("tab-panel absolute inset-0 overflow-y-auto pb-24 px-4 pt-4", (activeTab === 'planificacion' && isCoreTab) ? 'visible' : 'hidden')}>
        <PlanificacionTab />
      </div>
      <div className={cn("tab-panel absolute inset-0 overflow-y-auto pb-24 px-4 pt-4", (activeTab === 'recetas' && isCoreTab) ? 'visible' : 'hidden')}>
        <RecetasTab />
      </div>
      <div className={cn("tab-panel absolute inset-0 overflow-y-auto pb-24 px-4 pt-4", (activeTab === 'stock' && isCoreTab) ? 'visible' : 'hidden')}>
        <StockTab />
      </div>
      <div className={cn("tab-panel absolute inset-0 overflow-y-auto pb-24 px-4 pt-4", (activeTab === 'compras' && isCoreTab) ? 'visible' : 'hidden')}>
        <ComprasTab />
      </div>
      <div className={cn("tab-panel absolute inset-0 overflow-y-auto pb-24 px-4 pt-4", (activeTab === 'macros' && isCoreTab) ? 'visible' : 'hidden')}>
        <MacrosTab />
      </div>

      {/* Contenido dinámico (ej. detalle de receta) */}
      <div className={cn("relative w-full min-h-screen", isCoreTab ? 'hidden' : 'block')}>
        {!isCoreTab && children}
      </div>
    </div>
  );
}
