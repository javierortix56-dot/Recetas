"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, CalendarDays, ChefHat, Package, ShoppingCart, type LucideIcon } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/app-store"
import { spring } from "@/components/ui/motion"

const navItems: { href: string; icon: LucideIcon; key: string; label: string }[] = [
  { href: "/inicio", icon: Home, key: "inicio", label: "Inicio" },
  { href: "/planificacion", icon: CalendarDays, key: "planificacion", label: "Plan" },
  { href: "/recetas", icon: ChefHat, key: "recetas", label: "Recetas" },
  { href: "/stock", icon: Package, key: "stock", label: "Despensa" },
  { href: "/compras", icon: ShoppingCart, key: "compras", label: "Compras" },
]

/** Dock flotante glass (mismo patrón que Finanzas J&M) */
export function BottomNav() {
  const pathname = usePathname()
  const activeTab = useAppStore(s => s.activeTab)
  const setActiveTab = useAppStore(s => s.setActiveTab)
  const pendingCompras = useAppStore(s => s.listaCompras.reduce((n, i) => n + (i.isPurchased ? 0 : 1), 0))

  // Las subpáginas de recetas (detalle, edición, modo cocina) tienen su propia barra inferior
  const isSubpage = pathname.startsWith("/recetas/") && pathname.replace(/\/$/, "") !== "/recetas"
  if (pathname.startsWith("/login") || isSubpage) return null

  return (
    <nav className="fixed bottom-[max(12px,env(safe-area-inset-bottom))] inset-x-0 mx-auto w-[calc(100%-24px)] max-w-[480px] z-50">
      <div className="glass-strong rounded-[26px] h-16 flex items-stretch px-1">
        {navItems.map(({ href, icon: Icon, key, label }) => {
          // Nutrición se abre desde Inicio
          const isActive = activeTab === key || (key === "inicio" && activeTab === "macros")
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setActiveTab(key)}
              aria-current={isActive ? "page" : undefined}
              className="relative flex-1 flex flex-col items-center justify-center gap-0.5 h-full"
            >
              {isActive && (
                <motion.span
                  layoutId="nav-active"
                  transition={spring}
                  className="absolute inset-x-1 inset-y-1.5 rounded-[18px] bg-primary/10"
                />
              )}
              <motion.span
                className="relative"
                animate={{ y: isActive ? -1 : 0, scale: isActive ? 1.06 : 1 }}
                transition={spring}
              >
                <Icon size={21} strokeWidth={isActive ? 2.3 : 1.8} className={isActive ? "text-primary" : "text-muted-foreground"} />
                {key === "compras" && pendingCompras > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-accent text-[9px] font-bold text-accent-foreground flex items-center justify-center tabular-nums">
                    {pendingCompras > 99 ? "99+" : pendingCompras}
                  </span>
                )}
              </motion.span>
              <span className={cn("relative text-[10px] font-semibold transition-colors", isActive ? "text-primary" : "text-muted-foreground")}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
