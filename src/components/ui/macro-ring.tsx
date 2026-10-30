'use client'

import { cn } from '@/lib/utils'

/**
 * Anillo de progreso de un macro contra su meta. Único componente para
 * Inicio, Plan y Nutrición (antes había tres copias con estilos distintos).
 * Verde ≤100 %, ámbar hasta 110 %, rojo por encima.
 */
export function MacroRing({ label, value, target, size = 64, strokeWidth = 6, showValue = false, unit = '' }: {
  label: string
  value: number
  target: number
  size?: number
  strokeWidth?: number
  /** Muestra el valor absoluto debajo del porcentaje */
  showValue?: boolean
  unit?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const pct = target > 0 ? (value / target) * 100 : 0
  const offset = circumference - (Math.min(pct, 100) / 100) * circumference

  const color = pct > 110 ? 'text-destructive' : pct > 100 ? 'text-accent' : 'text-primary'

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke="currentColor" strokeWidth={strokeWidth} className="text-foreground/[0.07]" />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke="currentColor"
            strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" className={cn(color, 'transition-[stroke-dashoffset] duration-700 ease-out')}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className={cn('font-bold tabular-nums', size >= 80 ? 'text-base' : 'text-[11px]')}>{Math.round(pct)}%</span>
          {showValue && <span className="text-[9px] font-medium text-muted-foreground mt-0.5 tabular-nums">{Math.round(value)}{unit}</span>}
        </div>
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  )
}
