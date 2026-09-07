import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useLocalStorage } from '@/lib/storage'
import type { FontSizePref, LineHeightPref, Settings, ThemePref } from '@/lib/types'

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontSize: 'base',
  lineHeight: 'normal',
}

interface SettingsValue {
  settings: Settings
  setTheme: (t: ThemePref) => void
  setFontSize: (f: FontSizePref) => void
  setLineHeight: (l: LineHeightPref) => void
}

const SettingsContext = createContext<SettingsValue | null>(null)

function applyTheme(theme: ThemePref) {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = theme === 'dark' || (theme === 'system' && prefersDark)
  root.classList.toggle('dark', dark)
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useLocalStorage<Settings>('settings', DEFAULT_SETTINGS)

  useEffect(() => {
    applyTheme(settings.theme)
    if (settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings.theme])

  const value = useMemo<SettingsValue>(
    () => ({
      settings,
      setTheme: (theme) => setSettings((s) => ({ ...s, theme })),
      setFontSize: (fontSize) => setSettings((s) => ({ ...s, fontSize })),
      setLineHeight: (lineHeight) => setSettings((s) => ({ ...s, lineHeight })),
    }),
    [settings, setSettings],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}

export const FONT_SIZE_CLASS: Record<FontSizePref, string> = {
  sm: 'text-[13px]',
  base: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
}

export const LINE_HEIGHT_CLASS: Record<LineHeightPref, string> = {
  tight: 'leading-[1.55]',
  normal: 'leading-[1.75]',
  relaxed: 'leading-[2]',
}

export const FONT_SIZE_LABEL: Record<FontSizePref, string> = {
  sm: 'Small',
  base: 'Normal',
  lg: 'Large',
  xl: 'Extra large',
}

export const LINE_HEIGHT_LABEL: Record<LineHeightPref, string> = {
  tight: 'Compact',
  normal: 'Normal',
  relaxed: 'Relaxed',
}
