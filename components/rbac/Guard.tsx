'use client'

/**
 * components/rbac/Guard.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Conditional rendering guard for role and/or permission checks.
 *
 * Usage examples:
 *
 *   // Only visible to admins
 *   <Guard role="admin">
 *     <DeleteButton />
 *   </Guard>
 *
 *   // Only visible if user has the permission
 *   <Guard permission="can_apply_discount">
 *     <DiscountField />
 *   </Guard>
 *
 *   // Page-level redirect (redirectTo prop)
 *   <Guard role="admin" redirectTo="/dashboard">
 *     <ReportsPage />
 *   </Guard>
 *
 *   // Render a fallback instead of nothing
 *   <Guard permission="can_edit_products" fallback={<ReadOnlyBadge />}>
 *     <EditButton />
 *   </Guard>
 */

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useUserContext } from '@/context/UserContext'
import type { Permission } from '@/lib/rbac'

interface GuardProps {
  /** Required role. Admin always passes. */
  role?: 'admin' | 'cashier'
  /** Required permission key. Admin always passes. */
  permission?: Permission
  /** If access is denied and redirectTo is set, the router will push there. */
  redirectTo?: string
  /** Rendered when access is denied (and no redirect). Default: null. */
  fallback?: ReactNode
  children: ReactNode
}

export function Guard({ role, permission, redirectTo, fallback = null, children }: GuardProps) {
  const { currentUser, can, isRole } = useUserContext()
  const router = useRouter()

  // Check access
  let allowed = true
  if (role && !isRole(role)) allowed = false
  if (permission && !can(permission)) allowed = false
  // Admin override: if no currentUser yet, deny by default
  if (!currentUser) allowed = false

  useEffect(() => {
    if (!allowed && redirectTo) {
      router.replace(redirectTo)
    }
  }, [allowed, redirectTo, router])

  if (!allowed) return <>{fallback}</>
  return <>{children}</>
}
