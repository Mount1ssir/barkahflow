'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Évite le flash d'hydratation — on attend que le composant soit monté côté client
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="w-9 h-9" /> // Placeholder vide le temps du chargement
  }

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="relative w-9 h-9 flex items-center justify-center rounded-lg
                 transition-colors duration-200"
      style={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
        color: isDark ? '#c9a84c' : '#374151',
      }}
      aria-label="Changer le thème"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}