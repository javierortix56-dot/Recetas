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

const TABS = {
  inicio: InicioTab,
  planificacion: PlanificacionTab,
  recetas: RecetasTab,
  stock: StockTab,
  compras: ComprasTab,
  macros: MacrosTab,
} as const;

type TabKey = keyof typeof TABS;

const PATH_TO_TAB: Record<string, TabKey> = {
  '/inicio': 'inicio',
  '/planificacion': 'planificacion',
  '/recetas': 'recetas',
  '/stock': 'stock',
  '/compras': 'compras',
  '/macros': 'macros',
};

/**
 * Contenedor de pestañas persistentes. Cada pestaña se monta recién la
 * primera vez que se visita (antes se montaban las seis al abrir la app) y
 * después queda viva para conservar su scroll y estado.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeTab = useAppStore(s => s.activeTab) as TabKey;
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const isOnline = useOnlineStatus();

  const normalizedPath = React.useMemo(() => {
    if (!pathname || pathname === '/' || pathname === '/inicio' || pathname === '/inicio/') return '/inicio';
    return pathname.replace(/\/$/, '');
  }, [pathname]);

  const routeTab = PATH_TO_TAB[normalizedPath];
  const isCoreTab = !!routeTab;

  React.useEffect(() => {
    if (routeTab) setActiveTab(routeTab);
  }, [routeTab, setActiveTab]);

  const [visited, setVisited] = React.useState<Set<TabKey>>(() => new Set(routeTab ? [routeTab] : []));
  React.useEffect(() => {
    if (!isCoreTab || visited.has(activeTab)) return;
    setVisited(prev => new Set(prev).add(activeTab));
  }, [activeTab, isCoreTab, visited]);

  return (
    <div className="relative w-full h-full min-h-[100dvh] overflow-hidden">
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="glass-strong text-destructive px-3.5 py-1.5 rounded-full flex items-center gap-1.5 pointer-events-auto">
            <WifiOff className="h-3.5 w-3.5" />
            <span className="text-[11px] font-semibold">Sin conexión · los cambios se sincronizan al volver</span>
          </div>
        </div>
      )}

      {(Object.keys(TABS) as TabKey[]).map((key) => {
        if (!visited.has(key) && !(isCoreTab && activeTab === key)) return null;
        const Tab = TABS[key];
        return (
          <div
            key={key}
            className={cn(
              "tab-panel absolute inset-0 overflow-y-auto overscroll-contain px-4 pb-32 pt-[max(1.25rem,env(safe-area-inset-top))]",
              isCoreTab && activeTab === key && 'visible'
            )}
          >
            <Tab />
          </div>
        );
      })}

      {/* Subpáginas (detalle, edición, modo cocina) */}
      {!isCoreTab && <div className="relative w-full min-h-[100dvh]">{children}</div>}
    </div>
  );
}
