'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, ShoppingCart, Package, Receipt, Users,
  Wallet, CreditCard, BadgeAlert, BarChart3, Settings, LogOut,
  UserCog,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/lib/sidebar-store'
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '@/components/ui/tooltip'
import { supabase } from '@/src/lib/supabase'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useUserContext } from '@/context/UserContext'
import { PERMISSIONS } from '@/lib/rbac'

export function Sidebar() {
  const pathname = usePathname()
  const expanded = useSidebarStore((s) => s.expanded)
  const { t } = useTranslation()
  const { currentUser, can, isRole } = useUserContext()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    sessionStorage.clear()
    window.location.href = '/'
  }

  const fullName = currentUser?.name || ''
  const email = currentUser?.email || ''
  const avatarUrl = currentUser?.avatarUrl || currentUser?.supabaseUser?.user_metadata?.avatar_url
  const initials = fullName
    ? fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase() || 'A'
  const displayName = fullName || email.split('@')[0] || 'Commerçant'

  // ─── Nav groups ─────────────────────────────────────────────────────────────
  // Vente group is always visible; financial group is gated by permissions
  const venteItems = [
    { label: t('dashboard.nav.dashboard'), href: '/dashboard', icon: LayoutDashboard },
    { label: t('dashboard.nav.pos'), href: '/dashboard/caisse', icon: ShoppingCart },
    { label: t('dashboard.nav.products'), href: '/dashboard/produits', icon: Package },
    { label: t('dashboard.nav.invoices'), href: '/dashboard/factures', icon: Receipt },
    { label: t('dashboard.nav.clients'), href: '/dashboard/clients', icon: Users },
  ]

  const financeItems = [
    can(PERMISSIONS.VIEW_REVENUE) && { label: t('dashboard.nav.revenue'), href: '/dashboard/revenus', icon: Wallet },
    can(PERMISSIONS.VIEW_REVENUE) && { label: t('dashboard.nav.expenses'), href: '/dashboard/depenses', icon: CreditCard },
    can(PERMISSIONS.VIEW_DEBTS) && { label: t('dashboard.nav.debts'), href: '/dashboard/dettes', icon: BadgeAlert },
    can(PERMISSIONS.VIEW_REPORTS) && { label: t('dashboard.nav.reports'), href: '/dashboard/rapports', icon: BarChart3 },
  ].filter(Boolean) as { label: string; href: string; icon: any }[]

  const navGroups = [
    { label: t('dashboard.nav.vente'), items: venteItems },
    ...(financeItems.length > 0
      ? [{ label: t('dashboard.nav.finances'), items: financeItems }]
      : []),
  ]

  const renderLink = (item: { label: string; href: string; icon: any }, key: string) => {
    const Icon = item.icon
    const isActive = pathname === item.href

    const linkContent = (
      <Link
        href={item.href}
        className={cn(
          'relative flex items-center rounded-xl text-[13px] font-medium transition-all duration-150',
          expanded ? 'gap-3 px-3 py-2.5' : 'justify-center py-2.5 w-10 mx-auto',
          isActive
            ? 'text-[#0EA5E9] dark:text-[#38BDF8] bg-[rgba(56,189,248,0.12)] dark:bg-[rgba(56,189,248,0.15)] shadow-[0_0_0_1px_rgba(56,189,248,0.2)] dark:shadow-none'
            : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#1E293B] dark:hover:text-[#E2E8F0] hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)]'
        )}
      >
        {isActive && (
          <>
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full bg-[#0EA5E9] dark:bg-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.5)] dark:shadow-[0_0_8px_rgba(56,189,248,0.3)]" />
            <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-[rgba(56,189,248,0.05)] to-transparent pointer-events-none" />
          </>
        )}
        <Icon
          size={17}
          className="shrink-0"
          style={{
            color: isActive ? '#0EA5E9' : undefined,
            filter: isActive ? 'drop-shadow(0 0 4px rgba(56,189,248,0.3))' : undefined,
          }}
        />
        {expanded && <span className="whitespace-nowrap">{item.label}</span>}
      </Link>
    )

    if (!expanded) {
      return (
        <Tooltip key={key}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" className="bg-gray-800 dark:bg-[#1E293B] text-white border-gray-700 dark:border-[#334155]">
            {item.label}
          </TooltipContent>
        </Tooltip>
      )
    }
    return <div key={key}>{linkContent}</div>
  }

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className={cn(
          'h-screen sticky top-0 shrink-0 flex flex-col transition-all duration-200 ease-in-out z-20 border-r',
          expanded ? 'w-[220px]' : 'w-[64px]',
          'bg-[#F9FAFB] dark:bg-[#1E293B]',
          'border-[#E5E7EB] dark:border-[#334155]'
        )}
      >
        {/* ── Logo ── */}
        <div
          className={cn(
            'h-16 flex items-center shrink-0 gap-3',
            expanded ? 'px-5' : 'justify-center',
            'border-b border-[#E5E7EB] dark:border-[#334155]'
          )}
        >
          <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden bg-white dark:bg-[#0F172A] flex items-center justify-center shadow-sm">
            <img src="/slides/logo.png" alt="BarkahFlow" className="w-full h-full object-cover" />
          </div>
          {expanded && (
            <span className="text-[15px] font-bold tracking-tight whitespace-nowrap text-gray-800 dark:text-gray-200">
              Barkah<span className="text-[#38BDF8] dark:text-[#38BDF8]">Flow</span>
            </span>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-3">
          {navGroups.map((group, gi) => (
            <div key={group.label} className={cn('flex flex-col gap-0.5', gi > 0 && 'mt-4')}>
              {expanded && (
                <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => renderLink(item, item.href))}
            </div>
          ))}

          {/* Paramètres */}
          <div className="mt-4">
            {renderLink(
              { label: t('dashboard.nav.settings', 'Paramètres'), href: '/dashboard/settings', icon: Settings },
              'settings'
            )}
          </div>

          {/* Gestion des utilisateurs — admin only */}
          {isRole('admin') && (
            <div className="mt-1">
              {renderLink(
                { label: 'Utilisateurs', href: '/dashboard/utilisateurs', icon: UserCog },
                'utilisateurs'
              )}
            </div>
          )}
        </nav>

        {/* ── Profil ── */}
        <div
          className={cn(
            'shrink-0 p-3',
            !expanded && 'flex justify-center',
            'border-t border-[#E5E7EB] dark:border-[#334155]'
          )}
        >
          {/* Role badge */}
          {expanded && currentUser && (
            <div className="px-2 mb-2">
              <span
                className={cn(
                  'text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full',
                  currentUser.role === 'admin'
                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400'
                )}
              >
                {currentUser.role === 'admin' ? 'Administrateur' : 'Caissier'}
              </span>
            </div>
          )}

          {expanded ? (
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl cursor-pointer group transition-colors hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)]">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={avatarUrl} referrerPolicy="no-referrer" />
                <AvatarFallback
                  className="text-[11px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #38BDF8, #0EA5E9)' }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-200 truncate">
                  {displayName}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                title={t('dashboard.menu.logout', 'Déconnexion')}
              >
                <LogOut size={14} className="text-red-500 dark:text-red-400" />
              </button>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={avatarUrl} referrerPolicy="no-referrer" />
                    <AvatarFallback
                      className="text-[11px] font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #38BDF8, #0EA5E9)' }}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-gray-800 dark:bg-[#1E293B] text-white border-gray-700 dark:border-[#334155]">
                {displayName}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}