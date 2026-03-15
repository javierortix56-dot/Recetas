"use client"

import * as React from "react"
import { motion, useMotionValue, useTransform } from "framer-motion"
import { Trash2 } from "lucide-react"

interface SwipeToDeleteProps {
  children: React.ReactNode
  onDelete: () => void
  threshold?: number
}

export function SwipeToDelete({ children, onDelete, threshold = -80 }: SwipeToDeleteProps) {
  const x = useMotionValue(0)
  const opacity = useTransform(x, [0, threshold], [0, 1])
  const scale = useTransform(x, [0, threshold], [0.5, 1])

  const handleDragEnd = (_: any, info: any) => {
    // Si el usuario deslizó más allá del umbral (negativo hacia la izquierda)
    if (info.offset.x < threshold) {
      onDelete()
    }
  }

  return (
    <div className="relative overflow-hidden w-full">
      {/* Capa de fondo (Color rojo y bote de basura) */}
      <div className="absolute inset-0 bg-destructive flex items-center justify-end px-6">
        <motion.div style={{ opacity, scale }}>
          <Trash2 className="h-6 w-6 text-white" />
        </motion.div>
      </div>

      {/* Capa de contenido (Lo que el usuario ve y desliza) */}
      <motion.div
        drag="x"
        dragConstraints={{ left: threshold, right: 0 }}
        dragElastic={{ left: 0.2, right: 0.1 }}
        style={{ x }}
        onDragEnd={handleDragEnd}
        className="relative z-10 w-full bg-white"
      >
        {children}
      </motion.div>
    </div>
  )
}
