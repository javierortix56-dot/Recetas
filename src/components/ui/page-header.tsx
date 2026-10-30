'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { easeOut } from './motion'

interface HeaderProps {
  title: React.ReactNode
  /** Sobre-título chico (fecha, perfil, contador) */
  subtitle?: React.ReactNode
  /** Acciones a la derecha del título */
  actions?: React.ReactNode
  children?: React.ReactNode
  /** Header pegajoso con blur (listas largas con buscador) */
  sticky?: boolean
}

/** Encabezado "large title" de cada pantalla, transparente sobre el fondo ambiental */
export function PageHeader({ title, subtitle, actions, children, sticky = false }: HeaderProps) {
  return (
    <header
      className={cn(
        'pb-3 flex flex-col gap-3',
        sticky && 'sticky top-0 z-30 -mx-4 px-4 pt-1 bg-background/70 backdrop-blur-xl'
      )}
    >
      <div className="flex items-end gap-3">
        <motion.div
          className="flex-1 min-w-0"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={easeOut}
        >
          {subtitle && <p className="text-xs font-medium text-muted-foreground mb-1 truncate first-letter:uppercase">{subtitle}</p>}
          <h1 className="text-[28px] leading-none font-bold tracking-tight text-foreground truncate">{title}</h1>
        </motion.div>
        {actions && <div className="flex items-center gap-1.5 flex-shrink-0">{actions}</div>}
      </div>
      {children}
    </header>
  )
}

/** Botón redondo glass para acciones de header */
export const HeaderButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; primary?: boolean }
>(({ children, label, active = false, primary = false, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label={label}
    title={label}
    className={cn(
      'hit-44 h-9 min-w-9 px-2.5 flex items-center justify-center gap-1 rounded-full text-xs font-semibold transition-all active:scale-90 disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4',
      primary ? 'bg-brand text-white shadow-glow' : 'glass',
      !primary && (active ? 'text-primary' : 'text-foreground/70'),
      className
    )}
    {...props}
  >
    {children}
  </button>
))
HeaderButton.displayName = 'HeaderButton'

/** Etiqueta de sección dentro de una pantalla */
export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-2 px-1', className)}>
      <p className="eyebrow">{children}</p>
      {action}
    </div>
  )
}

/** Estado vacío consistente */
export function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="py-16 px-6 text-center flex flex-col items-center gap-3">
      <div className="h-16 w-16 rounded-[22px] bg-primary/10 flex items-center justify-center">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {description && <p className="text-sm text-muted-foreground max-w-[260px]">{description}</p>}
      {action}
    </div>
  )
}
