'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'  // ← AJOUTER CET IMPORT
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Receipt,
  Users,
  Wallet,
  CreditCard,
  BadgeAlert,
  BarChart3,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/lib/sidebar-store'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'

const GOLD = '#e0b86f'
const GOLD_SOFT_BG = 'rgba(224,184,111,0.12)'

export function Sidebar() {
  const pathname = usePathname()
  const expanded = useSidebarStore((s) => s.expanded)
  const { t } = useTranslation()

  const navGroups = [
    {
      label: t('dashboard.nav.vente'),
      items: [
        { label: t('dashboard.nav.dashboard'), href: '/dashboard', icon: LayoutDashboard },
        { label: t('dashboard.nav.pos'), href: '/dashboard/caisse', icon: ShoppingCart },
        { label: t('dashboard.nav.products'), href: '/dashboard/produits', icon: Package },
        { label: t('dashboard.nav.invoices'), href: '/dashboard/factures', icon: Receipt },
        { label: t('dashboard.nav.clients'), href: '/dashboard/clients', icon: Users },
      ],
    },
    {
      label: t('dashboard.nav.finances'),
      items: [
        { label: t('dashboard.nav.revenue'), href: '/dashboard/revenus', icon: Wallet },
        { label: t('dashboard.nav.expenses'), href: '/dashboard/depenses', icon: CreditCard },
        { label: t('dashboard.nav.debts'), href: '/dashboard/dettes', icon: BadgeAlert },
        { label: t('dashboard.nav.reports'), href: '/dashboard/rapports', icon: BarChart3 },
      ],
    },
  ]

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className={cn(
          'h-screen sticky top-0 shrink-0 border-r bg-background flex flex-col transition-all duration-200 ease-in-out z-20',
          expanded ? 'w-60' : 'w-16'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 shrink-0 border-b gap-2.5">
          <img
            src="/slides/logo.png"
            alt="BarkahFlow"
            className="w-8 h-8 rounded-full object-cover shrink-0"
            style={{ boxShadow: `0 0 0 2px rgba(224,184,111,0.35)` }}
          />
          {expanded && (
            <span
              className="text-base whitespace-nowrap"
              style={{
                fontWeight: 700,
                fontFamily: "'Poppins', 'Inter', sans-serif",
                letterSpacing: '-0.01em',
              }}
            >
              <span style={{ color: '#111827' }}>Barkah</span>
              <span style={{ color: GOLD, textShadow: '0 0 16px rgba(224,184,111,0.35)' }}>Flow</span>
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 flex flex-col gap-4">
          {navGroups.map((group) => (
            <div key={group.label} className="flex flex-col gap-0.5 px-2">
              {expanded && (
                <span className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </span>
              )}
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                // ✅ CORRECTION : Balise Link bien ouverte
                const linkContent = (
                  <Link
                    href={item.href}
                    className="relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors"
                    style={
                      isActive
                        ? { color: GOLD, backgroundColor: GOLD_SOFT_BG, fontWeight: 500 }
                        : undefined
                    }
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = GOLD_SOFT_BG
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full"
                        style={{ backgroundColor: GOLD }}
                      />
                    )}
                    <Icon
                      size={18}
                      className={cn('shrink-0', !isActive && 'text-muted-foreground')}
                      style={isActive ? { color: GOLD } : undefined}
                    />
                    {expanded && <span className="whitespace-nowrap">{item.label}</span>}
                  </Link>
                )

                if (!expanded) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  )
                }

                return <div key={item.href}>{linkContent}</div>
              })}
            </div>
          ))}
        </nav>

        {/* Paramètres en bas */}
        <div className="p-2 border-t">
          {(() => {
            const isActive = pathname === '/dashboard/settings'
            const content = (
              <Link
                href="/dashboard/settings"
                className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors"
                style={
                  isActive
                    ? { color: GOLD, backgroundColor: GOLD_SOFT_BG, fontWeight: 500 }
                    : undefined
                }
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = GOLD_SOFT_BG
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <Settings
                  size={18}
                  className={cn('shrink-0', !isActive && 'text-muted-foreground')}
                  style={isActive ? { color: GOLD } : undefined}
                />
                {expanded && <span className="whitespace-nowrap">{t('dashboard.nav.settings')}</span>}
              </Link>
            )

            if (!expanded) {
              return (
                <Tooltip>
                  <TooltipTrigger asChild>{content}</TooltipTrigger>
                  <TooltipContent side="right">{t('dashboard.nav.settings')}</TooltipContent>
                </Tooltip>
              )
            }
            return content
          })()}
        </div>
      </aside>
    </TooltipProvider>
  )
}