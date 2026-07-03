'use client'

import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import { Plus, Package, UserPlus, FileText } from 'lucide-react'

export function QuickActions() {
  const { t } = useTranslation()
  const router = useRouter()

  const actions = [
    {
      key: 'add_sale',
      icon: Plus,
      href: '/dashboard/caisse',
      color: '#10b981',
      bg: 'rgba(16,185,129,0.08)',
      border: '#10b981',
    },
    {
      key: 'add_product',
      icon: Package,
      href: '/dashboard/produits/nouveau',
      color: '#2563EB',
      bg: 'rgba(37,99,235,0.08)',
      border: '#2563EB',
    },
    {
      key: 'add_client',
      icon: UserPlus,
      href: '/dashboard/clients/nouveau',
      color: '#D4A017',
      bg: 'rgba(212,160,23,0.08)',
      border: '#D4A017',
    },
    {
      key: 'invoice',
      icon: FileText,
      href: '/dashboard/factures/nouveau',
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.08)',
      border: '#ef4444',
    },
  ]

  return (
    <div className="rounded-2xl bg-[#faf9f6] dark:bg-zinc-900 border border-[#EAECEF] dark:border-zinc-800 shadow-sm px-6 py-5">
      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* Illustration */}
        <div className="shrink-0">
          <img
            src="/slides/analytics-person.png"
            alt={t('dashboard.quick_actions.image_alt', 'Analytics illustration')}
            className="w-[130px] h-auto object-contain pointer-events-none select-none"
          />
        </div>

        {/* Titre + description */}
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-gray-900 dark:text-white">
            {t('dashboard.quick_actions.promo_title', 'Gérez votre activité facilement')}
          </p>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1 max-w-xs">
            {t(
              'dashboard.quick_actions.promo_desc',
              'Ajoutez vos ventes, gérez vos produits, suivez vos stocks et vos clients en toute simplicité.'
            )}
          </p>
        </div>

        {/* Grille 2x2 de boutons */}
        <div className="grid grid-cols-2 gap-3 shrink-0">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.href}
                onClick={() => router.push(action.href)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[13px] font-semibold transition-all duration-150 hover:shadow-md hover:-translate-y-px whitespace-nowrap"
                style={{
                  borderColor: action.border,
                  backgroundColor: action.bg,
                  color: action.color,
                }}
              >
                <Icon size={14} />
                {t(`dashboard.quick_actions.${action.key}`)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}