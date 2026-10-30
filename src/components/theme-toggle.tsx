'use client'

import * as React from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Segmented } from '@/components/ui/segmented'
import { getThemePref, setThemePref, type ThemePref } from '@/lib/theme'

/** Selector de tema (sistema / claro / oscuro). Se guarda por dispositivo. */
export function ThemeSelector() {
  const [pref, setPref] = React.useState<ThemePref>('system')
  React.useEffect(() => setPref(getThemePref()), [])

  return (
    <Segmented
      id="theme"
      value={pref}
      onChange={(v) => { setThemePref(v); setPref(v) }}
      options={[
        { value: 'system', label: <><Monitor className="h-3.5 w-3.5" /> Sistema</> },
        { value: 'light', label: <><Sun className="h-3.5 w-3.5" /> Claro</> },
        { value: 'dark', label: <><Moon className="h-3.5 w-3.5" /> Oscuro</> },
      ]}
    />
  )
}
