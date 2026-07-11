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
  const { isLocked, unlockApp } = usePin()
  const searchParams = useSearchParams()
  
  // Vérifier si on doit afficher le switch (paramètre URL ou localStorage)
  const showSwitchParam = searchParams.get('showSwitch') === 'true'
  const [showSwitch, setShowSwitch] = useState(() => {
    // Vérifier le localStorage au chargement initial
    if (typeof window !== 'undefined') {
      return localStorage.getItem('barkahflow_show_switch') === 'true'
    }
    return false
  })

  useEffect(() => {
    // Si le paramètre URL est présent, le sauvegarder dans localStorage
    if (showSwitchParam) {
      localStorage.setItem('barkahflow_show_switch', 'true')
      setShowSwitch(true)
      // Nettoyer l'URL
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [showSwitchParam])

  useEffect(() => {
    async function initSession() {
      try {
        const isPlaceholder =
          !process.env.NEXT_PUBLIC_SUPABASE_URL ||
          process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')

        // ─── SI LE MODE SWITCH EST ACTIF ───
        if (showSwitch) {
          setIsLoading(false)
          setChecking(false)
          // On reste sur l'écran de switch sans faire de redirection
          return
        }

        // ─── 1. Vérifier si un caissier est déjà actif ───
        const activeRole = sessionStorage.getItem('barkahflow_active_user_role')
        const activeId = sessionStorage.getItem('barkahflow_active_user_id')
        const activeSession = sessionStorage.getItem('barkahflow_active_session')

        // Si un caissier est actif et la session est valide
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

        // ─── 2. Récupérer la session Supabase ───
        const { data } = await supabase.auth.getSession()

        // ─── SI PAS DE SESSION → REDIRIGER VERS LOGIN ───
        if (!data.session && !isPlaceholder) {
          sessionStorage.clear()
          window.location.href = '/'
          return
        }

        // ─── 3. Récupérer l'utilisateur Supabase ───
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
              active: true,
            })
            
            if (sessionStorage.getItem('barkahflow_active_user_role') === 'cashier') {
              sessionStorage.removeItem('barkahflow_active_user_role')
              sessionStorage.removeItem('barkahflow_active_user_id')
              sessionStorage.removeItem('barkahflow_active_session')
            }
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

  // ─── 🔴 AFFICHER L'ÉCRAN DE SWITCH ───
  if (showSwitch || !currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <UserSwitchScreen
          open={true}
          onOpenChange={() => {}}
          onSuccess={(user: AppUser) => {
            setCurrentUser(user)
            // Désactiver le mode switch
            localStorage.removeItem('barkahflow_show_switch')
            setShowSwitch(false)
            window.history.replaceState({}, '', '/dashboard')
          }}
        />
      </div>
    )
  }

  // ─── Écran de verrouillage selon le rôle ───
  const showLockScreen = isPinEnabled() && isLocked && currentUser

  // ─── ADMIN → PinLockScreen (PIN local) ──────────────────────────────
  if (showLockScreen && currentUser?.role === 'admin') {
    return <PinLockScreen onSuccess={unlockApp} />
  }

  // ─── CAISSIER → CashierLockScreen (PIN en base de données) ──────────
  if (showLockScreen && currentUser?.role === 'cashier') {
    return (
      <CashierLockScreen
        onSuccess={() => {
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