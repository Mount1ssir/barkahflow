// hooks/usePresence.ts

import { useEffect, useRef, useCallback } from 'react'
import { useUserContext } from '@/context/UserContext'
import { updateLastActivity } from '@/lib/user-data'

export function usePresence() {
  const { currentUser } = useUserContext()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastUpdateRef = useRef<number>(0)
  const isMountedRef = useRef(true)

  const sendHeartbeat = useCallback(async () => {
    if (!currentUser || !isMountedRef.current) return
    
    const now = Date.now()
    if (now - lastUpdateRef.current < 10000) return
    
    try {
      await updateLastActivity(currentUser.id)
      lastUpdateRef.current = now
    } catch (error) {
      // Silencieux
    }
  }, [currentUser])

  const triggerActivity = useCallback(() => {
    sendHeartbeat()
  }, [sendHeartbeat])

  useEffect(() => {
    isMountedRef.current = true
    
    if (!currentUser) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    sendHeartbeat()

    intervalRef.current = setInterval(() => {
      sendHeartbeat()
    }, 30000)

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    const handleActivity = () => triggerActivity()
    
    events.forEach(event => document.addEventListener(event, handleActivity))

    return () => {
      isMountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      events.forEach(event => document.removeEventListener(event, handleActivity))
    }
  }, [currentUser, sendHeartbeat, triggerActivity])

  return { triggerActivity }
}