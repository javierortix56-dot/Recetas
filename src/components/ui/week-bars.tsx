'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { easeOut, stagger } from './motion'

export interface WeekBarDatum {
  label: string
  value: number
  highlight?: boolean
}

/**
 * Barras semanales en SVG/CSS con línea de meta. Reemplaza los AreaChart de
 * recharts (librería pesada para 7 puntos). Ámbar >100 %, rojo >110 %.
 */
export function WeekBars({ data, target, unit = '', height = 112, color = 'primary' }: {
  data: WeekBarDatum[]
  target: number
  unit?: string
  height?: number
  color?: 'primary' | 'accent' | 'destructive' | 'sky'
}) {
  const max = Math.max(...data.map(d => d.value), target, 1) * 1.12
  const plot = height - 20 // espacio para las etiquetas
  const targetY = (target / max) * plot
  const base = {
    primary: 'bg-primary/25',
    accent: 'bg-accent/30',
    destructive: 'bg-destructive/25',
    sky: 'bg-sky-500/25',
  }[color]
  const strong = {
    primary: 'bg-primary',
    accent: 'bg-accent',
    destructive: 'bg-destructive',
    sky: 'bg-sky-500',
  }[color]

  return (
    <div className="relative" style={{ height }}>
      {target > 0 && (
        <div className="absolute inset-x-0 border-t border-dashed border-foreground/25" style={{ bottom: 20 + targetY }} aria-hidden>
          <span className="absolute right-0 -top-4 text-[9px] font-semibold text-muted-foreground">meta {target}{unit}</span>
        </div>
      )}
      <div className="absolute inset-0 flex items-end gap-2">
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max((d.value / max) * plot, 4) : 2
          const over = target > 0 && d.value > target * 1.1
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`${Math.round(d.value)}${unit}`}>
              <motion.div
                className={cn('w-full rounded-[7px]', over ? 'bg-destructive/70' : d.highlight ? strong : base)}
                initial={{ height: 0 }}
                animate={{ height: h }}
                transition={{ ...easeOut, delay: stagger(i, 0.04) }}
              />
              <span className={cn('mt-1.5 h-[14px] text-[10px] font-semibold leading-[14px]', d.highlight ? 'text-foreground' : 'text-muted-foreground')}>{d.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
