"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useAppStore, UserProfileName } from "@/store/app-store"
import { cn } from "@/lib/utils"
import { spring } from "@/components/ui/motion"

export const PROFILES: { id: UserProfileName; label: string; emoji: string }[] = [
  { id: "javi", label: "Javi", emoji: "🧔‍♂️" },
  { id: "mary", label: "Mary", emoji: "👩🏻‍🦰" },
]

/**
 * Selector de perfil compacto para el header de las pantallas que dependen
 * del perfil (Inicio, Plan, Nutrición). Antes era una barra fija arriba de
 * todas las pestañas, incluso las compartidas (Recetas, Despensa, Compras).
 */
export function ProfileSwitcher({ className }: { className?: string }) {
  const activeProfile = useAppStore(s => s.activeProfile)
  const setActiveProfile = useAppStore(s => s.setActiveProfile)

  return (
    <div role="tablist" aria-label="Perfil" className={cn("relative flex gap-0.5 p-[3px] rounded-full glass", className)}>
      {PROFILES.map((p) => {
        const isActive = activeProfile === p.id
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => !isActive && setActiveProfile(p.id)}
            className={cn(
              "relative h-8 px-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors",
              isActive ? "text-primary-foreground" : "text-muted-foreground"
            )}
          >
            {isActive && (
              <motion.span layoutId="profile-active" transition={spring} className="absolute inset-0 rounded-full bg-primary shadow-glow" />
            )}
            <span className="relative z-10 text-sm leading-none">{p.emoji}</span>
            <AnimatePresence initial={false}>
              {isActive && (
                <motion.span
                  className="relative z-10 overflow-hidden whitespace-nowrap"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {p.label}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        )
      })}
    </div>
  )
}
