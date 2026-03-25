"use client"

import * as React from "react"
import { motion, useMotionValue, useTransform, animate } from "framer-motion"
import { Trash2 } from "lucide-react"

interface SwipeToDeleteProps {
  children: React.ReactNode
  onDelete: () => void
}

// Requiere deslizar al menos 130px o velocidad alta + 70px para evitar activaciones accidentales
const DELETE_THRESHOLD = -130
const VELOCITY_THRESHOLD = -600
const VELOCITY_MIN_OFFSET = -70

export function SwipeToDelete({ children, onDelete }: SwipeToDeleteProps) {
  const x = useMotionValue(0)
  const opacity = useTransform(x, [0, DELETE_THRESHOLD], [0, 1])
  const scale = useTransform(x, [0, DELETE_THRESHOLD], [0.4, 1])

  const handleDragEnd = (_: any, info: any) => {
    const offsetX = info.offset.x
    const velocityX = info.velocity.x

    const hitThreshold = offsetX < DELETE_THRESHOLD
    const hitVelocity = velocityX < VELOCITY_THRESHOLD && offsetX < VELOCITY_MIN_OFFSET

    if (hitThreshold || hitVelocity) {
      // Animar fuera de pantalla y luego eliminar
      animate(x, -400, { duration: 0.2, ease: "easeIn" }).then(() => onDelete())
    } else {
      // Volver al origen con spring natural
      animate(x, 0, { type: "spring", stiffness: 400, damping: 35 })
    }
  }

  return (
    <div className="relative overflow-hidden w-full">
      {/* Fondo rojo con icono */}
      <div className="absolute inset-0 bg-destructive flex items-center justify-end px-6">
        <motion.div style={{ opacity, scale }}>
          <Trash2 className="h-6 w-6 text-white" />
        </motion.div>
      </div>

      {/* Contenido deslizable */}
      <motion.div
        drag="x"
        dragConstraints={{ left: DELETE_THRESHOLD, right: 0 }}
        dragElastic={{ left: 0.1, right: 0.05 }}
        style={{ x }}
        onDragEnd={handleDragEnd}
        className="relative z-10 w-full bg-white"
      >
        {children}
      </motion.div>
    </div>
  )
}
