'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { isPinEnabled, getInactivityTimeoutSeconds } from '@/lib/pin-storage'

interface PinContextType {
  isLocked: boolean
  lockApp: () => void
  unlockApp: () => void
  resetInactivityTimer: () => void
  pauseInactivity: () => void
  resumeInactivity: () => void
  isInactivityPaused: boolean
}

const PinContext = createContext<PinContextType | undefined>(undefined)

export function PinProvider({ children }: { children: ReactNode }) {
  const [isLocked, setIsLocked] = useState(false)
  const [timeoutSeconds, setTimeoutSeconds] = useState(30)
  const [isInactivityPaused, setIsInactivityPaused] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null)
  const isMounted = useRef(true)

  // ─── Sources de vérité "live", jamais périmées dans les closures ───
  const isLockedRef = useRef(isLocked)
  const pauseCountRef = useRef(0) // compteur de pauses imbriquées (0 = actif)
  const pathnameRef = useRef(pathname)
  const timeoutSecondsRef = useRef(timeoutSeconds)

  useEffect(() => { isLockedRef.current = isLocked }, [isLocked])
  useEffect(() => { pathnameRef.current = pathname }, [pathname])
  useEffect(() => { timeoutSecondsRef.current = timeoutSeconds }, [timeoutSeconds])

  const isResetScreen = useCallback(() => {
    const showSwitch = localStorage.getItem('barkahflow_show_switch') === 'true'
    const showSwitchParam = searchParams.get('showSwitch') === 'true'
    if (showSwitch || showSwitchParam) return true
    if (pathnameRef.current?.includes('/auth/reset-pin-verify')) return true
    return false
  }, [searchParams])

  const clearTimer = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current)
      timeoutIdRef.current = null
    }
  }, [])

  const lockApp = useCallback(() => {
    if (isPinEnabled() && !isLockedRef.current && !isResetScreen()) {
      clearTimer()
      isLockedRef.current = true
      setIsLocked(true)
    }
  }, [clearTimer, isResetScreen])

  // ─── startTimer : le callback du setTimeout relit toujours les REFS
  // au moment où il se déclenche, jamais une valeur figée dans une closure ───
  const startTimer = useCallback(() => {
    clearTimer()

    if (
      pauseCountRef.current > 0 ||
      isLockedRef.current ||
      pathnameRef.current === '/' ||
      !isPinEnabled() ||
      isResetScreen()
    ) {
      return
    }

    timeoutIdRef.current = setTimeout(() => {
      if (
        isMounted.current &&
        pauseCountRef.current === 0 &&
        !isLockedRef.current &&
        !isResetScreen()
      ) {
        lockApp()
      }
    }, timeoutSecondsRef.current * 1000)
  }, [clearTimer, isResetScreen, lockApp])

  const unlockApp = useCallback(() => {
    isLockedRef.current = false
    setIsLocked(false)
    if (pauseCountRef.current === 0 && !isResetScreen()) {
      setTimeout(() => startTimer(), 100)
    }
  }, [isResetScreen, startTimer])

  const resetInactivityTimer = useCallback(() => {
    if (!isLockedRef.current && pauseCountRef.current === 0 && !isResetScreen()) {
      startTimer()
    }
  }, [isResetScreen, startTimer])

  // ─── Pause/Reprise à base de COMPTEUR : supporte plusieurs pauses
  // imbriquées (ex: CashierLockScreen + UserSwitchScreen ouverts en
  // cascade) sans que l'une écrase la pause de l'autre ───
  const pauseInactivity = useCallback(() => {
    pauseCountRef.current += 1
    clearTimer()
    setIsInactivityPaused(true)
    console.log('⏸️ Inactivité PAUSÉE (compteur =', pauseCountRef.current, ')')
  }, [clearTimer])

  const resumeInactivity = useCallback(() => {
    pauseCountRef.current = Math.max(0, pauseCountRef.current - 1)
    console.log('▶️ Inactivité — reprise demandée (compteur =', pauseCountRef.current, ')')
    if (pauseCountRef.current === 0) {
      setIsInactivityPaused(false)
      if (!isLockedRef.current && !isResetScreen()) {
        startTimer()
      }
    }
  }, [isResetScreen, startTimer])

  // Charge la durée configurée et écoute les changements en direct
  useEffect(() => {
    setTimeoutSeconds(getInactivityTimeoutSeconds())
    const handleChange = () => setTimeoutSeconds(getInactivityTimeoutSeconds())
    window.addEventListener('barkahflow:inactivity-timeout-changed', handleChange)
    return () => window.removeEventListener('barkahflow:inactivity-timeout-changed', handleChange)
  }, [])

  // ─── Timer d'inactivité : ne dépend plus que de ce qui doit vraiment
  // le redémarrer. isLocked/isInactivityPaused sont lus via les refs
  // dans startTimer, plus besoin de les mettre en dépendance ici ───
  useEffect(() => {
    if (pathname === '/' || !isPinEnabled() || isResetScreen()) {
      clearTimer()
      return
    }

    startTimer()

    const resetTimer = () => {
      if (!isLockedRef.current && pauseCountRef.current === 0 && !isResetScreen()) {
        startTimer()
      }
    }

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(event => document.addEventListener(event, resetTimer))

    return () => {
      clearTimer()
      events.forEach(event => document.removeEventListener(event, resetTimer))
    }
  }, [pathname, timeoutSeconds, searchParams, clearTimer, startTimer, isResetScreen])

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      clearTimer()
    }
  }, [clearTimer])

  return (
    <PinContext.Provider
      value={{
        isLocked,
        lockApp,
        unlockApp,
        resetInactivityTimer,
        pauseInactivity,
        resumeInactivity,
        isInactivityPaused,
      }}
    >
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