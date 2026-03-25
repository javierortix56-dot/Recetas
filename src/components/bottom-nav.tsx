"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Calendar, ChefHat, Package, ShoppingCart } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/app-store"
import { motion } from "framer-motion"

const navItems = [
  { href: "/inicio", icon: Home, key: 'inicio' },
  { href: "/planificacion", icon: Calendar, key: 'planificacion' },
  { href: "/recetas", icon: ChefHat, key: 'recetas' },
  { href: "/stock", icon: Package, key: 'stock' },
  { href: "/compras", icon: ShoppingCart, key: 'compras' },
]

export function BottomNav() {
  const pathname = usePathname()
  const { activeTab, setActiveTab } = useAppStore()

  if (pathname === "/login" || pathname.startsWith("/recetas/cooking")) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-3 safe-area-pb pointer-events-none">
      <nav className="bg-white/85 backdrop-blur-2xl border border-white/60 shadow-nav rounded-[1.75rem] h-[58px] flex items-center pointer-events-auto max-w-lg mx-auto">
        <div className="flex justify-around items-center w-full px-3">
          {navItems.map(({ href, icon: Icon, key }) => {
            const isActive = activeTab === key || pathname === href || (href !== "/inicio" && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "relative flex items-center justify-center flex-1 h-[48px] min-w-[44px] transition-all duration-300",
                  isActive ? "text-primary" : "text-muted-foreground/50"
                )}
              >
                <div className="relative p-2">
                  {isActive && (
                    <motion.div
                      layoutId="navIndicator"
                      className="absolute inset-0 bg-primary/12 rounded-2xl"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
                    />
                  )}
                  <Icon className={cn("h-[21px] w-[21px] relative z-10 transition-all duration-300", isActive ? "scale-110 stroke-[2.2]" : "stroke-[1.8]")} />
                </div>
                {isActive && (
                  <motion.div
                    layoutId="navDot"
                    className="absolute bottom-1.5 w-1 h-1 rounded-full bg-primary"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
                  />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
