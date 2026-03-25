"use client"

import { motion } from "framer-motion"
import { usePathname } from "next/navigation"

const CORE_TABS = ['/inicio', '/planificacion', '/recetas', '/stock', '/compras', '/macros']

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isCoreTab = CORE_TABS.some(tab => pathname === tab || pathname === tab + '/')

  if (isCoreTab) return <>{children}</>

  return (
    <motion.div
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  )
}
