'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { isPinEnabled, getInactivityTimeoutSeconds } from '@/lib/pin-storage'

interface PinContextType {
  isLocked: boolean
  lockApp: () => void
  unlockApp: () => void
  resetInactivityTimer: () => void
}

const PinContext = createContext<PinContextType | undefined>(undefined)

export function PinProvider({ children }: { children: ReactNode }) {
  const [isLocked, setIsLocked] = useState(false)
  const [timeoutSeconds, setTimeoutSeconds] = useState(30)
  const pathname = usePathname()

  // Charge la durée configurée et écoute les changements en direct (depuis Sécurité)
  useEffect(() => {
    setTimeoutSeconds(getInactivityTimeoutSeconds())
    const handleChange = () => setTimeoutSeconds(getInactivityTimeoutSeconds())
    window.addEventListener('barkahflow:inactivity-timeout-changed', handleChange)
    return () => window.removeEventListener('barkahflow:inactivity-timeout-changed', handleChange)
  }, [])

  // Timer d'inactivité
  useEffect(() => {
    // Ne pas verrouiller sur la page de login ou si le PIN n'est pas activé
    if (pathname === '/' || !isPinEnabled()) return

    let timeoutId: NodeJS.Timeout

    const resetTimer = () => {
      clearTimeout(timeoutId)
      if (!isLocked) {
        timeoutId = setTimeout(() => {
          lockApp()
        }, timeoutSeconds * 1000)
      }
    }

    // Écouter les événements d'interaction
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(event => document.addEventListener(event, resetTimer))

    // Démarrer le timer initial
    resetTimer()

    return () => {
      clearTimeout(timeoutId)
      events.forEach(event => document.removeEventListener(event, resetTimer))
    }
  }, [pathname, isLocked, timeoutSeconds])

  const lockApp = () => {
    if (isPinEnabled()) {
      setIsLocked(true)
    }
  }

  const unlockApp = () => {
    setIsLocked(false)
    // Réinitialiser le timer après déverrouillage
    // Le useEffect s'en chargera via resetTimer
  }

  const resetInactivityTimer = () => {
    // Si on interagit manuellement, on reset via les événements déjà écoutés
    // mais on peut aussi appeler cette fonction depuis des composants
  }

  return (
    <PinContext.Provider value={{ isLocked, lockApp, unlockApp, resetInactivityTimer }}>
      {children}
    </PinContext.Provider>
  )
}

export function usePin() {
  const context = useContext(PinContext)
  if (context === undefined) {
    throw new Error('usePin must be used within a PinProvider')
  }
  return context
}