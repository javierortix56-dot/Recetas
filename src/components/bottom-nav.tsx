"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Calendar, ChefHat, Package, ShoppingCart, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import { ContextualFabSheet } from "./contextual-fab-sheet"
import { useAppStore } from "@/store/app-store"

const navItems = [
  { href: "/inicio", label: "Inicio", icon: Home, key: 'inicio' },
  { href: "/planificacion", label: "Plan", icon: Calendar, key: 'planificacion' },
  { href: "/recetas", label: "Recetas", icon: ChefHat, key: 'recetas' },
  { href: "/stock", label: "Stock", icon: Package, key: 'stock' },
  { href: "/compras", label: "Compras", icon: ShoppingCart, key: 'compras' },
  { href: "/macros", label: "Macros", icon: Activity, key: 'macros' },
]

export function BottomNav() {
  const pathname = usePathname()
  const { activeTab, setActiveTab } = useAppStore()

  if (pathname === "/login" || pathname.startsWith("/recetas/cooking")) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <ContextualFabSheet />

      <nav className="bg-white border-t border-border h-[64px] safe-area-pb flex items-center">
        <div className="flex justify-around items-center w-full max-w-lg mx-auto px-1">
          {navItems.map(({ href, label, icon: Icon, key }) => {
            const isActive = pathname === href || (href !== "/inicio" && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full min-w-[44px] transition-all duration-200 py-1",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-xl transition-colors duration-200",
                  isActive && "bg-primary-suave"
                )}>
                  <Icon className={cn("h-5 w-5", isActive && "fill-primary/20")} />
                </div>
                <span className="text-[9px] font-black mt-0.5 tracking-tight uppercase">
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
