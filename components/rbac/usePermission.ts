'use client'

import { useUserContext } from '@/context/UserContext'
import { type Permission } from '@/lib/rbac'

export function usePermission(permission: Permission): boolean {
  const { currentUser, can } = useUserContext()
  
  if (!currentUser) return false
  return can(permission)
}

export function usePermissions(permissions: Permission[]): boolean[] {
  const { currentUser, can } = useUserContext()
  
  if (!currentUser) return permissions.map(() => false)
  return permissions.map((p) => can(p))
}