"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Calendar, ChefHat, Package, ShoppingCart, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/app-store"
import { motion } from "framer-motion"

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
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-3 safe-area-pb pointer-events-none">
      <nav className="bg-white/80 backdrop-blur-2xl border border-white/50 shadow-nav rounded-[1.75rem] h-[64px] flex items-center pointer-events-auto max-w-lg mx-auto">
        <div className="flex justify-around items-center w-full px-2">
          {navItems.map(({ href, label, icon: Icon, key }) => {
            const isActive = activeTab === key || pathname === href || (href !== "/inicio" && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "relative flex flex-col items-center justify-center flex-1 h-[56px] min-w-[44px] transition-all duration-300",
                  isActive ? "text-primary" : "text-muted-foreground/70"
                )}
              >
                <div className="relative p-1.5">
                  {isActive && (
                    <motion.div
                      layoutId="navIndicator"
                      className="absolute inset-0 bg-primary/10 rounded-2xl"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <Icon className={cn("h-[22px] w-[22px] relative z-10 transition-all duration-300", isActive && "scale-110")} />
                </div>
                <span className={cn(
                  "text-[8px] font-black tracking-tight uppercase transition-all duration-300",
                  isActive ? "opacity-100" : "opacity-50"
                )}>
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
