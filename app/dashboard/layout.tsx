'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/src/lib/supabase'
import { Sidebar } from '@/components/dashboard/sidebar'
import { TopBar } from '@/components/dashboard/topbar'
// ✅ Import depuis components/pin/pin-context (existant)
import { PinProvider, usePin } from '@/components/pin/pin-context'
import { PinLockScreen } from '@/components/pin/PinLockScreen'
import { isPinEnabled } from '@/lib/pin-storage'

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isLocked, unlockApp } = usePin()
  const [user, setUser] = useState<any>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        window.location.href = '/'
      } else {
        setUser(data.session.user)
        setChecking(false)
      }
    })
  }, [])

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
          <TopBar user={user} />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>

      {isPinEnabled() && isLocked && (
        <PinLockScreen onSuccess={unlockApp} />
      )}
    </>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PinProvider>
      <DashboardContent>{children}</DashboardContent>
    </PinProvider>
  )
}