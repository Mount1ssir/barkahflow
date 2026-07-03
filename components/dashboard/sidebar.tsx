'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, ShoppingCart, Package, Receipt, Users,
  Wallet, CreditCard, BadgeAlert, BarChart3, Settings, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/lib/sidebar-store'
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '@/components/ui/tooltip'
import { supabase } from '@/src/lib/supabase'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useEffect, useState } from 'react'

// ─── Couleurs très douces ──────────────────────────────────────────
const BLUE = '#38BDF8'              // Accent bleu ciel
const BLUE_ACTIVE = '#0EA5E9'      // Bleu légèrement plus soutenu pour actif
const BG_SIDEBAR = '#F9FAFB'       // Très léger gris (slate-50) – presque blanc
const BORDER_LIGHT = '#E5E7EB'     // Gris clair pour délimiter
const TEXT_DARK = '#1E293B'        // Gris foncé pour le texte principal
const TEXT_MUTED = '#64748B'       // Gris moyen pour les liens inactifs
const HOVER_BG = 'rgba(0,0,0,0.04)' // Très léger fond au survol

export function Sidebar() {
  const pathname = usePathname()
  const expanded = useSidebarStore((s) => s.expanded)
  const { t } = useTranslation()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const fullName  = user?.user_metadata?.full_name || ''
  const email     = user?.email || ''
  const avatarUrl = user?.user_metadata?.avatar_url
  const initials  = fullName
    ? fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase() || 'A'
  const displayName = fullName || email.split('@')[0] || 'Commerçant'

  const navGroups = [
    {
      label: t('dashboard.nav.vente'),
      items: [
        { label: t('dashboard.nav.dashboard'), href: '/dashboard',          icon: LayoutDashboard },
        { label: t('dashboard.nav.pos'),       href: '/dashboard/caisse',   icon: ShoppingCart },
        { label: t('dashboard.nav.products'),  href: '/dashboard/produits', icon: Package },
        { label: t('dashboard.nav.invoices'),  href: '/dashboard/factures', icon: Receipt },
        { label: t('dashboard.nav.clients'),   href: '/dashboard/clients',  icon: Users },
      ],
    },
    {
      label: t('dashboard.nav.finances'),
      items: [
        { label: t('dashboard.nav.revenue'),  href: '/dashboard/revenus',  icon: Wallet },
        { label: t('dashboard.nav.expenses'), href: '/dashboard/depenses', icon: CreditCard },
        { label: t('dashboard.nav.debts'),    href: '/dashboard/dettes',   icon: BadgeAlert },
        { label: t('dashboard.nav.reports'),  href: '/dashboard/rapports', icon: BarChart3 },
      ],
    },
  ]

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className={cn(
          'h-screen sticky top-0 shrink-0 flex flex-col transition-all duration-200 ease-in-out z-20 border-r',
          expanded ? 'w-[220px]' : 'w-[64px]',
        )}
        style={{
          backgroundColor: BG_SIDEBAR,
          borderColor: BORDER_LIGHT,
        }}
      >
        {/* ── Logo ── */}
        <div
          className={cn('h-16 flex items-center shrink-0 gap-3', expanded ? 'px-5' : 'justify-center')}
          style={{ borderBottom: `1px solid ${BORDER_LIGHT}` }}
        >
          <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden bg-white flex items-center justify-center shadow-sm">
            <img src="/slides/logo.png" alt="BarkahFlow" className="w-full h-full object-cover" />
          </div>
          {expanded && (
            <span className="text-[15px] font-bold tracking-tight whitespace-nowrap text-gray-800">
              Barkah<span style={{ color: BLUE }}>Flow</span>
            </span>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-3">
          {navGroups.map((group, gi) => (
            <div key={group.label} className={cn('flex flex-col gap-0.5', gi > 0 && 'mt-4')}>
              {expanded && (
                <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                const linkContent = (
                  <Link
                    href={item.href}
                    className={cn(
                      'relative flex items-center rounded-xl text-[13px] font-medium transition-all duration-150',
                      expanded ? 'gap-3 px-3 py-2.5' : 'justify-center py-2.5 w-10 mx-auto',
                    )}
                    style={{
                      color: isActive ? BLUE_ACTIVE : TEXT_MUTED,
                      backgroundColor: isActive ? 'rgba(56,189,248,0.10)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = HOVER_BG
                        e.currentTarget.style.color = TEXT_DARK
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = TEXT_MUTED
                      }
                    }}
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full"
                        style={{ backgroundColor: BLUE_ACTIVE }}
                      />
                    )}
                    <Icon size={17} className="shrink-0" />
                    {expanded && <span className="whitespace-nowrap">{item.label}</span>}
                  </Link>
                )

                if (!expanded) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right" className="bg-gray-800 text-white border-gray-700">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  )
                }
                return <div key={item.href}>{linkContent}</div>
              })}
            </div>
          ))}

          {/* Paramètres */}
          <div className="mt-4">
            {(() => {
              const isActive = pathname === '/dashboard/settings'
              const content = (
                <Link
                  href="/dashboard/settings"
                  className={cn(
                    'relative flex items-center rounded-xl text-[13px] font-medium transition-all duration-150',
                    expanded ? 'gap-3 px-3 py-2.5' : 'justify-center py-2.5 w-10 mx-auto',
                  )}
                  style={{
                    color: isActive ? BLUE_ACTIVE : TEXT_MUTED,
                    backgroundColor: isActive ? 'rgba(56,189,248,0.10)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = HOVER_BG
                      e.currentTarget.style.color = TEXT_DARK
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = TEXT_MUTED
                    }
                  }}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full"
                      style={{ backgroundColor: BLUE_ACTIVE }}
                    />
                  )}
                  <Settings size={17} className="shrink-0" />
                  {expanded && <span>{t('dashboard.nav.settings', 'Paramètres')}</span>}
                </Link>
              )
              if (!expanded) return (
                <Tooltip>
                  <TooltipTrigger asChild>{content}</TooltipTrigger>
                  <TooltipContent side="right" className="bg-gray-800 text-white border-gray-700">
                    {t('dashboard.nav.settings', 'Paramètres')}
                  </TooltipContent>
                </Tooltip>
              )
              return content
            })()}
          </div>
        </nav>

        {/* ── Profil ── */}
        <div
          className={cn('shrink-0 p-3', !expanded && 'flex justify-center')}
          style={{ borderTop: `1px solid ${BORDER_LIGHT}` }}
        >
          {expanded ? (
            <div
              className="flex items-center gap-3 px-2 py-2 rounded-xl cursor-pointer group transition-colors"
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = HOVER_BG }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={avatarUrl} referrerPolicy="no-referrer" />
                <AvatarFallback className="text-[11px] font-bold text-white"
                                style={{ background: `linear-gradient(135deg, ${BLUE}, ${BLUE_ACTIVE})` }}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-gray-800 truncate">{displayName}</p>
              </div>
              <button
                onClick={handleLogout}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-50"
                title={t('dashboard.menu.logout', 'Déconnexion')}
              >
                <LogOut size={14} className="text-red-500" />
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
                    <AvatarFallback className="text-[11px] font-bold text-white"
                                    style={{ background: `linear-gradient(135deg, ${BLUE}, ${BLUE_ACTIVE})` }}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-gray-800 text-white border-gray-700">
                {displayName}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}