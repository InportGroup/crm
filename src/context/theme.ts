import { createContext, useContext } from 'react'

export type Theme = 'light' | 'dark'

export interface ThemeState {
  theme: Theme
  toggle: () => void
}

export const ThemeContext = createContext<ThemeState | null>(null)

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}

export const THEME_KEY = 'ipg-crm-theme'

/** Stored choice if there is one, otherwise whatever the OS prefers. */
export function initialTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
