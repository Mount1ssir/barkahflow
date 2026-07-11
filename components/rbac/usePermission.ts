'use client'

/**
 * components/rbac/usePermission.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Convenience hook wrapping useUserContext().can().
 *
 * Usage:
 *   const canDiscount = usePermission('can_apply_discount')
 *   if (!canDiscount) { ... }
 */

import { useUserContext } from '@/context/UserContext'
import type { Permission } from '@/lib/rbac'

export function usePermission(permission: Permission): boolean {
  const { can } = useUserContext()
  return can(permission)
}
