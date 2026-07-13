'use client'

/**
 * context/UserContext.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Global current-user state for BarkahFlow.
 *
 * The "active user" is whoever is currently operating the app — either
 * the admin (identified via Supabase session) or a cashier (identified by
 * their local PIN login).
 *
 * Ce contexte est le point de passage unique pour tout changement de
 * profil actif : c'est ici, et pas dans les écrans de PIN, qu'on marque
 * un caissier "hors ligne" dès qu'on le quitte — ce qui corrige le bug
 * de présence qui restait figée sur "en ligne/actif".
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import type { Permission } from '@/lib/rbac'
import { hasPermission } from '@/lib/rbac'
import { getUserById, markUserOffline, markUserOnline } from '@/lib/user-data'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AppUser {
  id: string
  name: string
  email: string | null
  phone: string | null
  avatarUrl: string | null
  role: 'admin' | 'cashier'
  permissions: Permission[]
  active: boolean
  supabaseUser?: any
}

interface UserContextValue {
  currentUser: AppUser | null
  isLoading: boolean
  setCurrentUser: (user: AppUser | null) => void
  setIsLoading: (loading: boolean) => void
  can: (permission: Permission) => boolean
  isRole: (role: 'admin' | 'cashier') => boolean
  clearUser: () => void
}

// ─── Context ─────────────────────────────────────────────────────────────────

const UserContext = createContext<UserContextValue | null>(null)

// ─── Provider ────────────────────────────────────────────────────────────────

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<AppUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const previousUserRef = useRef<AppUser | null>(null)

  useEffect(() => {
    const savedId = sessionStorage.getItem('barkahflow_active_user_id')

    if (!savedId) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    getUserById(savedId)
      .then((row) => {
        if (cancelled) return

        if (row && row.active) {
          const restored: AppUser = {
            id: row.id,
            name: row.name,
            email: row.email,
            phone: row.phone,
            avatarUrl: row.avatarUrl,
            role: row.role,
            permissions: row.permissions,
            active: row.active,
          }
          previousUserRef.current = restored
          setCurrentUserState(restored)
        } else {
          sessionStorage.removeItem('barkahflow_active_user_id')
          sessionStorage.removeItem('barkahflow_active_user_role')
        }
      })
      .catch(() => {
        sessionStorage.removeItem('barkahflow_active_user_id')
        sessionStorage.removeItem('barkahflow_active_user_role')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const setCurrentUser = useCallback((user: AppUser | null) => {
    const previous = previousUserRef.current

    // ⚠️ Correction du bug de présence figée : dès qu'on quitte le profil
    // d'un caissier (vers un autre profil ou vers rien), il est marqué
    // hors-ligne immédiatement en base.
    if (previous && previous.role === 'cashier' && previous.id !== user?.id) {
      markUserOffline(previous.id).catch(() => {})
    }

    if (user && user.role === 'cashier' && previous?.id !== user.id) {
      markUserOnline(user.id).catch(() => {})
    }

    previousUserRef.current = user
    setCurrentUserState(user)

    if (user) {
      sessionStorage.setItem('barkahflow_active_user_id', user.id)
      sessionStorage.setItem('barkahflow_active_user_role', user.role)
    } else {
      sessionStorage.removeItem('barkahflow_active_user_id')
      sessionStorage.removeItem('barkahflow_active_user_role')
    }
  }, [])

  const clearUser = useCallback(() => {
    const previous = previousUserRef.current
    if (previous && previous.role === 'cashier') {
      markUserOffline(previous.id).catch(() => {})
    }
    previousUserRef.current = null
    setCurrentUserState(null)
    sessionStorage.removeItem('barkahflow_active_user_id')
    sessionStorage.removeItem('barkahflow_active_user_role')
  }, [])

  const can = useCallback(
    (permission: Permission): boolean => {
      if (!currentUser) return false
      return hasPermission(currentUser.role, currentUser.permissions, permission)
    },
    [currentUser]
  )

  const isRole = useCallback(
    (role: 'admin' | 'cashier'): boolean => currentUser?.role === role,
    [currentUser]
  )

  return (
    <UserContext.Provider
      value={{
        currentUser,
        isLoading,
        setCurrentUser,
        setIsLoading,
        can,
        isRole,
        clearUser,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUserContext(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) {
    throw new Error('useUserContext must be used inside <UserProvider>')
  }
  return ctx
}