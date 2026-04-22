'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { WifiOff } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { InicioTab } from './tabs/inicio-tab';
import { RecetasTab } from './tabs/recetas-tab';
import { StockTab } from './tabs/stock-tab';
import { PlanificacionTab } from './tabs/planificacion-tab';
import { ComprasTab } from './tabs/compras-tab';
import { MacrosTab } from './tabs/macros-tab';
import { ProfileSwitcher } from './profile-switcher';
import { cn } from '@/lib/utils';

function useOnlineStatus() {
  const [isOnline, setIsOnline] = React.useState(true);
  React.useEffect(() => {
    setIsOnline(navigator.onLine);
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return isOnline;
}

/**
 * @fileOverview Contenedor principal que maneja la persistencia de las pestañas.
 * Se ha eliminado la pantalla de bienvenida obligatoria para una entrada directa.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeTab, setActiveTab } = useAppStore();
  const isOnline = useOnlineStatus();
  
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
      {/* Selector de perfil superior - Siempre visible en pestañas principales */}
      {isCoreTab && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md px-4 py-3 flex justify-center max-w-lg mx-auto pointer-events-none">
          <div className="pointer-events-auto">
            <ProfileSwitcher />
          </div>
        </div>
      )}

      {/* Indicador sin conexión */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
          <div className="mt-14 mx-4 bg-destructive/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg pointer-events-auto">
            <WifiOff className="h-3 w-3" />
            <span className="text-[10px] font-black uppercase tracking-widest">Sin conexión · Modo local</span>
          </div>
        </div>
      )}

      {/* Paneles persistentes */}
      <div className={cn("tab-panel absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-none pb-20 px-4 pt-16", (activeTab === 'inicio' && isCoreTab) ? 'visible' : 'hidden')}>
        <InicioTab />
      </div>
      <div className={cn("tab-panel absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-none pb-20 px-4 pt-16", (activeTab === 'planificacion' && isCoreTab) ? 'visible' : 'hidden')}>
        <PlanificacionTab />
      </div>
      <div className={cn("tab-panel absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-none pb-20 px-4 pt-16", (activeTab === 'recetas' && isCoreTab) ? 'visible' : 'hidden')}>
        <RecetasTab />
      </div>
      <div className={cn("tab-panel absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-none pb-20 px-4 pt-16", (activeTab === 'stock' && isCoreTab) ? 'visible' : 'hidden')}>
        <StockTab />
      </div>
      <div className={cn("tab-panel absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-none pb-20 px-4 pt-16", (activeTab === 'compras' && isCoreTab) ? 'visible' : 'hidden')}>
        <ComprasTab />
      </div>
      <div className={cn("tab-panel absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-none pb-20 px-4 pt-16", (activeTab === 'macros' && isCoreTab) ? 'visible' : 'hidden')}>
        <MacrosTab />
      </div>

      {/* Contenido dinámico (Subpáginas) */}
      <div className={cn("relative w-full min-h-screen", isCoreTab ? 'hidden' : 'block')}>
        {!isCoreTab && children}
      </div>
    </div>
  );
}
