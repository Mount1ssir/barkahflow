'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/src/lib/supabase'
import { Sidebar } from '@/components/dashboard/sidebar'
import { TopBar } from '@/components/dashboard/topbar'
import { PinProvider, usePin } from '@/components/pin/pin-context'
import { PinLockScreen } from '@/components/pin/PinLockScreen'
import { CashierLockScreen } from '@/components/pin/CashierLockScreen'
import UserSwitchScreen from '@/components/pin/UserSwitchScreen'
import { isPinEnabled } from '@/lib/pin-storage'
import { NotificationProvider } from '@/context/NotificationContext'
import { UserProvider, useUserContext } from '@/context/UserContext'
import { upsertAdminFromSupabase, getUserById } from '@/lib/user-data'
import type { AppUserRow } from '@/lib/user-data'
import type { AppUser } from '@/context/UserContext'

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { setCurrentUser, setIsLoading, currentUser } = useUserContext()
  const [checking, setChecking] = useState(true)
  const { isLocked, unlockApp, pauseInactivity, resumeInactivity } = usePin()
  const searchParams = useSearchParams()

  // Vérifier si on doit afficher le switch (paramètre URL ou localStorage)
  const showSwitchParam = searchParams.get('showSwitch') === 'true'
  const [showSwitch, setShowSwitch] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('barkahflow_show_switch') === 'true'
    }
    return false
  })

  // ─── PAUSER L'INACTIVITÉ QUAND showSwitch EST ACTIF ───
  useEffect(() => {
    if (showSwitch) {
      console.log('🔒 [layout] Inactivité PAUSÉE (écran de switch)')
      pauseInactivity()
    } else {
      console.log('🔒 [layout] Inactivité REPRISE')
      resumeInactivity()
    }
  }, [showSwitch, pauseInactivity, resumeInactivity])

  useEffect(() => {
    if (showSwitchParam) {
      localStorage.setItem('barkahflow_show_switch', 'true')
      setShowSwitch(true)
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [showSwitchParam])

  useEffect(() => {
    async function initSession() {
      try {
        const isPlaceholder =
          !process.env.NEXT_PUBLIC_SUPABASE_URL ||
          process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')

        // ─── 🔴 PRIORITÉ 1 : Le flag showSwitch est-il actif ? ───
        if (showSwitch) {
          sessionStorage.removeItem('barkahflow_active_user_role')
          sessionStorage.removeItem('barkahflow_active_user_id')
          sessionStorage.removeItem('barkahflow_active_session')
          
          setIsLoading(false)
          setChecking(false)
          return
        }

        // ─── 2. Un caissier est-il déjà actif ? ───
        const activeRole = sessionStorage.getItem('barkahflow_active_user_role')
        const activeId = sessionStorage.getItem('barkahflow_active_user_id')
        const activeSession = sessionStorage.getItem('barkahflow_active_session')

        if (activeRole === 'cashier' && activeId && activeSession === 'active') {
          try {
            const cashier = await getUserById(activeId)
            if (cashier && cashier.active) {
              setCurrentUser({
                id: cashier.id,
                name: cashier.name,
                email: cashier.email,
                phone: cashier.phone,
                avatarUrl: cashier.avatarUrl,
                role: 'cashier',
                permissions: cashier.permissions || [],
                active: cashier.active,
              })
              setIsLoading(false)
              setChecking(false)
              return
            } else {
              sessionStorage.removeItem('barkahflow_active_user_role')
              sessionStorage.removeItem('barkahflow_active_user_id')
              sessionStorage.removeItem('barkahflow_active_session')
            }
          } catch (error) {
            console.error('Erreur chargement caissier:', error)
            sessionStorage.removeItem('barkahflow_active_user_role')
            sessionStorage.removeItem('barkahflow_active_user_id')
            sessionStorage.removeItem('barkahflow_active_session')
          }
        }

        // ─── 3. Vérifier la vraie session Supabase ───
        const { data } = await supabase.auth.getSession()
        const supabaseUser = data.session?.user || (isPlaceholder
          ? { id: 'dev-admin', email: 'dev@barkahflow.com', user_metadata: { full_name: 'Developer' } }
          : null)

        if (supabaseUser) {
          localStorage.removeItem('barkahflow_show_switch')
          sessionStorage.removeItem('barkahflow_active_user_role')
          sessionStorage.removeItem('barkahflow_active_user_id')
          sessionStorage.removeItem('barkahflow_active_session')
          if (showSwitch) setShowSwitch(false)

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
              active: true,
            })
          } catch (error) {
            console.error('Erreur upsert admin:', error)
            setCurrentUser({
              id: supabaseUser.id,
              name: (supabaseUser as any).user_metadata?.full_name || (supabaseUser as any).email || 'Admin',
              email: (supabaseUser as any).email || null,
              phone: null,
              avatarUrl: (supabaseUser as any).user_metadata?.avatar_url || null,
              role: 'admin',
              permissions: [],
              supabaseUser: supabaseUser,
              active: true,
            })
          }

          setIsLoading(false)
          setChecking(false)
          return
        }

        // ─── 4. Ni session, ni switch, ni caissier actif → retour au login ───
        if (!isPlaceholder) {
          sessionStorage.clear()
          localStorage.removeItem('barkahflow_show_switch')
          window.location.href = '/'
          return
        }
      } catch (error) {
        console.error('Erreur initialisation session:', error)
        if (!sessionStorage.getItem('barkahflow_active_user_role') && !showSwitch) {
          window.location.href = '/'
        }
      } finally {
        setIsLoading(false)
        setChecking(false)
      }
    }

    initSession()
  }, [setCurrentUser, setIsLoading, showSwitch])

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

  // ─── 🔴 PRIORITÉ ABSOLUE : ÉCRAN DE SWITCH ───
  // Si showSwitch est actif, on retourne UNIQUEMENT UserSwitchScreen
  if (showSwitch) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <UserSwitchScreen
          open={true}
          onOpenChange={() => {}}
          onSuccess={(user: AppUser) => {
            setCurrentUser(user)
            localStorage.removeItem('barkahflow_show_switch')
            setShowSwitch(false)
            if (user.role === 'cashier') {
              sessionStorage.setItem('barkahflow_active_user_role', 'cashier')
              sessionStorage.setItem('barkahflow_active_user_id', user.id)
              sessionStorage.setItem('barkahflow_active_session', 'active')
            }
            window.history.replaceState({}, '', '/dashboard')
          }}
        />
      </div>
    )
  }

  // ─── Si pas de currentUser, on affiche aussi le switch ───
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <UserSwitchScreen
          open={true}
          onOpenChange={() => {}}
          onSuccess={(user: AppUser) => {
            setCurrentUser(user)
            localStorage.removeItem('barkahflow_show_switch')
            setShowSwitch(false)
            if (user.role === 'cashier') {
              sessionStorage.setItem('barkahflow_active_user_role', 'cashier')
              sessionStorage.setItem('barkahflow_active_user_id', user.id)
              sessionStorage.setItem('barkahflow_active_session', 'active')
            }
            window.history.replaceState({}, '', '/dashboard')
          }}
        />
      </div>
    )
  }

  // ─── MAINTENANT SEULEMENT, on est dans le dashboard ───
  // On est sûr que showSwitch = false et currentUser existe
  const showLockScreen = isPinEnabled() && isLocked

  if (showLockScreen && currentUser?.role === 'admin') {
    return <PinLockScreen onSuccess={unlockApp} />
  }

  if (showLockScreen && currentUser?.role === 'cashier') {
    return (
      <CashierLockScreen
        onSuccess={(user: AppUser) => {
          setCurrentUser(user)
          unlockApp()
        }}
        preselectedCashier={currentUser as AppUserRow}
      />
    )
  }

  // ─── Écran normal (non verrouillé) ──────────────────────────────────
  return (
    <div className="flex min-h-screen bg-muted/30 dark:bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar user={currentUser} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
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