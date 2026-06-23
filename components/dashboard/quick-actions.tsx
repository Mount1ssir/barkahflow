'use client'

import { useTranslation } from 'react-i18next'
import { Plus, Package, FileText, UserPlus, Archive, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function QuickActions() {
  const { t } = useTranslation()

  const actions = [
    { key: 'add_sale', icon: Plus, href: '/dashboard/caisse', color: '#10b981' },
    { key: 'add_product', icon: Package, href: '/dashboard/produits/nouveau', color: '#3b82f6' },
    { key: 'create_invoice', icon: FileText, href: '/dashboard/factures/nouvelle', color: '#8b5cf6' },
    { key: 'add_client', icon: UserPlus, href: '/dashboard/clients/nouveau', color: '#f59e0b' },
    { key: 'stock_entry', icon: Archive, href: '/dashboard/produits/stock', color: '#ef4444' },
  ]

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-3">
        {t('dashboard.quick_actions.title')}
      </h3>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <Button
              key={action.href}
              variant="outline"
              className="gap-2 rounded-xl"
              onClick={() => (window.location.href = action.href)}
            >
              <Icon size={15} style={{ color: action.color }} />
              {t(`dashboard.quick_actions.${action.key}`)}
            </Button>
          )
        })}
        <Button variant="ghost" className="gap-2 rounded-xl text-muted-foreground">
          <MoreHorizontal size={15} />
          {t('dashboard.quick_actions.more')}
        </Button>
      </div>
    </div>
  )
}