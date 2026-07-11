'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/src/lib/supabase'
import { Sidebar } from '@/components/dashboard/sidebar'
import { TopBar } from '@/components/dashboard/topbar'
import { PinProvider, usePin } from '@/components/pin/pin-context'
import { PinLockScreen } from '@/components/pin/PinLockScreen'
import { isPinEnabled } from '@/lib/pin-storage'
import { NotificationProvider } from '@/context/NotificationContext'
import { UserProvider, useUserContext } from '@/context/UserContext'
import { upsertAdminFromSupabase } from '@/lib/user-data'

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { setCurrentUser, setIsLoading, currentUser } = useUserContext()
  const [checking, setChecking] = useState(true)
  const { isLocked, unlockApp } = usePin()

  useEffect(() => {
    async function initSession() {
      try {
        const isPlaceholder =
          !process.env.NEXT_PUBLIC_SUPABASE_URL ||
          process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')

        const { data } = await supabase.auth.getSession()

        if (!data.session && !isPlaceholder) {
          window.location.href = '/'
          return
        }

        // If a cashier is already active (e.g. after a page refresh), restore from sessionStorage
        const activeRole = sessionStorage.getItem('barkahflow_active_user_role')
        const activeId = sessionStorage.getItem('barkahflow_active_user_id')

        if (activeRole === 'cashier' && activeId) {
          // Restore cashier session from DB
          const { getUserById } = await import('@/lib/user-data')
          const cashier = await getUserById(activeId)
          if (cashier && cashier.active) {
            setCurrentUser({
              id: cashier.id,
              name: cashier.name,
              email: cashier.email,
              phone: cashier.phone,
              avatarUrl: cashier.avatarUrl,
              role: 'cashier',
              permissions: cashier.permissions,
            })
            setIsLoading(false)
            setChecking(false)
            return
          }
        }

        // Default: resolve the admin from Supabase session
        const supabaseUser = data.session?.user || (isPlaceholder
          ? { id: 'dev-admin', email: 'dev@barkahflow.com', user_metadata: { full_name: 'Developer' } }
          : null)

        if (supabaseUser) {
          try {
            const adminRow = await upsertAdminFromSupabase(supabaseUser as any)
            setCurrentUser({
              id: adminRow.id,
              name: adminRow.name,
              email: adminRow.email,
              phone: adminRow.phone,
              avatarUrl: adminRow.avatarUrl,
              role: 'admin',
              permissions: [],
              supabaseUser: supabaseUser,
            })
          } catch {
            // Fallback if DB not ready yet (web mock mode)
            setCurrentUser({
              id: supabaseUser.id,
              name: (supabaseUser as any).user_metadata?.full_name || (supabaseUser as any).email || 'Admin',
              email: (supabaseUser as any).email || null,
              phone: null,
              avatarUrl: (supabaseUser as any).user_metadata?.avatar_url || null,
              role: 'admin',
              permissions: [],
              supabaseUser: supabaseUser,
            })
          }
        }
      } finally {
        setIsLoading(false)
        setChecking(false)
      }
    }

    initSession()
  }, [setCurrentUser, setIsLoading])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: '#c9a84c', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  return (
    <>
      <div className="flex min-h-screen bg-muted/30 dark:bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar user={currentUser} />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>

      {isPinEnabled() && isLocked && (
        <PinLockScreen onSuccess={unlockApp} />
      )}
    </>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UserProvider>
      <PinProvider>
        <NotificationProvider>
          <DashboardContent>{children}</DashboardContent>
        </NotificationProvider>
      </PinProvider>
    </UserProvider>
  )
}