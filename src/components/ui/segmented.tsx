'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { spring } from './motion'

export interface SegmentOption<T extends string> {
  value: T
  label: React.ReactNode
}

interface Props<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Identificador único por instancia: el indicador se anima con layoutId */
  id: string
  size?: 'sm' | 'md'
  /** 'solid' = indicador de color con texto blanco · 'glass' = indicador claro */
  variant?: 'solid' | 'glass'
  className?: string
}

const SIZES = { sm: 'h-8 text-[11px]', md: 'h-9 text-xs' }

/**
 * Control segmentado con indicador que se desliza entre opciones.
 * Reemplaza los chips/badges sueltos que se usaban como filtros.
 */
export function Segmented<T extends string>({
  options, value, onChange, id, size = 'md', variant = 'glass', className,
}: Props<T>) {
  return (
    <div role="tablist" className={cn('relative flex gap-0.5 p-[3px] rounded-[14px] bg-foreground/[0.06]', className)}>
      {options.map((opt) => {
        const active = opt.value === value
        const solid = variant === 'solid'
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative flex-1 px-2.5 rounded-[11px] font-semibold whitespace-nowrap transition-colors duration-200',
              SIZES[size],
              active ? (solid ? 'text-primary-foreground' : 'text-foreground') : 'text-muted-foreground hover:text-foreground/80'
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={spring}
                className={cn(
                  'absolute inset-0 rounded-[11px]',
                  solid ? 'bg-primary shadow-glow' : 'bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_-4px_rgba(0,0,0,0.12)]'
                )}
              />
            )}
            <span className="relative z-[1] inline-flex items-center justify-center gap-1">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Chip de filtro (on/off) con el mismo lenguaje visual */
export function FilterChip({ active, onClick, children, tone = 'primary' }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  tone?: 'primary' | 'destructive' | 'accent'
}) {
  const tones = {
    primary: active ? 'bg-primary text-primary-foreground shadow-glow' : 'glass text-foreground/70',
    destructive: active ? 'bg-destructive text-destructive-foreground' : 'glass text-foreground/70',
    accent: active ? 'bg-accent text-accent-foreground' : 'glass text-foreground/70',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('h-8 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all active:scale-95 [&_svg]:h-3.5 [&_svg]:w-3.5', tones[tone])}
    >
      {children}
    </button>
  )
}
