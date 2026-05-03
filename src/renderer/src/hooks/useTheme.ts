import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'ejoos-theme'

export type ThemeMode = 'light' | 'dark'

export function useThemeMode(): [ThemeMode, () => void] {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode)
    // Update html attribute for CSS selectors
    document.documentElement.setAttribute('data-theme', mode)
  }, [mode])

  const toggle = useCallback(() => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'))
  }, [])

  return [mode, toggle]
}
