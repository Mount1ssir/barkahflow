'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useUserContext } from '@/context/UserContext'
import { type Permission } from '@/lib/rbac'

interface GuardProps {
  children: React.ReactNode
  permission?: Permission
  role?: 'admin' | 'cashier'
  redirectTo?: string
}

export function Guard({ children, permission, role, redirectTo = '/dashboard' }: GuardProps) {
  const router = useRouter()
  const { currentUser, isLoading, can, isRole } = useUserContext()

  useEffect(() => {
    if (isLoading) return

    if (!currentUser) {
      router.push('/')
      return
    }

    // Vérifier le rôle
    if (role && !isRole(role)) {
      router.push(redirectTo)
      return
    }

    // Vérifier la permission
    if (permission && !can(permission)) {
      router.push(redirectTo)
      return
    }
  }, [currentUser, isLoading, can, isRole, role, permission, redirectTo, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: '#c9a84c', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (!currentUser) {
    return null
  }

  if (role && !isRole(role)) {
    return null
  }

  if (permission && !can(permission)) {
    return null
  }

  return <>{children}</>
}