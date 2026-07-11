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
 * This context is the single source of truth consumed by all components
 * and permission guards. It replaces the scattered `setUser(data.user)` calls.
 *
 * NOTE: The admin bootstrap (Supabase session → upsertAdminFromSupabase →
 * setCurrentUser) and the cashier restore-on-refresh logic both live in
 * app/dashboard/layout.tsx (DashboardContent's initSession). This context
 * only restores a LOCAL session on mount (for cases outside the dashboard
 * layout's own effect, or a quick re-render before it runs) — it does not
 * duplicate the Supabase bootstrap to avoid two competing init flows.
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { Permission } from '@/lib/rbac'
import { hasPermission } from '@/lib/rbac'
import { getUserById } from '@/lib/user-data'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AppUser {
  id: string
  name: string
  email: string | null
  phone: string | null
  avatarUrl: string | null
  role: 'admin' | 'cashier'
  permissions: Permission[]
  supabaseUser?: any   // populated for admin only
}

interface UserContextValue {
  currentUser: AppUser | null
  isLoading: boolean
  setCurrentUser: (user: AppUser | null) => void
  setIsLoading: (loading: boolean) => void
  /**
   * Returns true if the active user has the given permission.
   * Admins always return true regardless of the permission key.
   */
  can: (permission: Permission) => boolean
  /**
   * Returns true if the active user's role matches.
   */
  isRole: (role: 'admin' | 'cashier') => boolean
  /** Clears the active session (used on logout or user switch). */
  clearUser: () => void
}

// ─── Context ─────────────────────────────────────────────────────────────────

const UserContext = createContext<UserContextValue | null>(null)

// ─── Provider ────────────────────────────────────────────────────────────────

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<AppUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ─── Restore a local session on mount ───────────────────────────────────
  // Reads the last active user id from sessionStorage and reloads their
  // row from SQLite. If the user was deactivated in the meantime (or the
  // id is stale), the stored session is cleared. If nothing is stored,
  // this is a no-op — DashboardLayout's initSession is responsible for
  // resolving the admin from the Supabase session in that case.
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
          setCurrentUserState({
            id: row.id,
            name: row.name,
            email: row.email,
            phone: row.phone,
            avatarUrl: row.avatarUrl,
            role: row.role,
            permissions: row.permissions,
          })
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
    setCurrentUserState(user)
    // Persist the active user's ID in sessionStorage so a page refresh
    // can restore context without requiring a new PIN entry.
    if (user) {
      sessionStorage.setItem('barkahflow_active_user_id', user.id)
      sessionStorage.setItem('barkahflow_active_user_role', user.role)
    } else {
      sessionStorage.removeItem('barkahflow_active_user_id')
      sessionStorage.removeItem('barkahflow_active_user_role')
    }
  }, [])

  const clearUser = useCallback(() => {
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