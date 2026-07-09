'use client'

import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { 
  ChevronRight, 
  TrendingUp, 
  Package, 
  Briefcase, 
  FileText, 
  Users,
  DollarSign
} from 'lucide-react'

export default function ReportsPage() {
  const { t } = useTranslation()

  const reportCategories = [
    {
      id: 'sales',
      title: t('reports.categories.sales', 'Rapports de ventes'),
      desc: t('reports.desc.sales', 'Suivez les revenus, la valeur moyenne des commandes et la performance des produits.'),
      icon: TrendingUp,
      badge: t('reports.badges.popular', 'Populaire'),
      href: '/dashboard/rapports/sales'
    },
    {
      id: 'inventory',
      title: t('reports.categories.inventory', 'Rapports d\'inventaire'),
      desc: t('reports.desc.inventory', 'Surveillez les niveaux de stock, la valeur des marchandises et les alertes de réapprovisionnement.'),
      icon: Package,
      badge: null,
      href: '/dashboard/rapports/inventory'
    },
    {
      id: 'business',
      title: t('reports.categories.business', 'Rapports d\'activité'),
      desc: t('reports.desc.business', 'Aperçu des marges bénéficiaires, des dépenses et du grand livre des flux de trésorerie.'),
      icon: Briefcase,
      badge: null,
      href: '/dashboard/rapports/business'
    },
    {
      id: 'tax',
      title: t('reports.categories.tax', 'Rapports de taxes & factures'),
      desc: t('reports.desc.tax', 'Exportez les résumés des taxes collectées et l\'historique de facturation des clients.'),
      icon: FileText,
      badge: null,
      href: '/dashboard/rapports/tax-invoice'
    },
    {
      id: 'customers',
      title: t('reports.categories.customers', 'Rapports clients'),
      desc: t('reports.desc.customers', 'Analysez les niveaux de crédit des clients, les dettes impayées et les meilleurs clients.'),
      icon: Users,
      badge: null,
      href: '/dashboard/rapports/customer'
    },
    {
      id: 'revenue',
      title: t('reports.categories.revenue', 'Rapports de revenus'),
      desc: t('reports.desc.revenue', 'Consultez les rapports sur les ventes régulières et les revenus des événements externes.'),
      icon: DollarSign,
      badge: null,
      href: '/dashboard/rapports/revenue'
    },
  ]

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full p-1 bg-slate-50/50 dark:bg-transparent min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {t('reports.title', 'Rapports')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {t('reports.subtitle', 'Accédez aux résumés, statistiques de vente et indicateurs d\'activité de la boutique')}
          </p>
        </div>
      </div>

      {/* Grid of Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportCategories.map((report) => {
          const Icon = report.icon
          return (
            <Link
              key={report.id}
              href={report.href}
              className="group flex flex-col justify-between p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-left transition-all duration-200 hover:border-blue-600/30 hover:shadow-md dark:hover:shadow-zinc-950 hover:bg-slate-50/30 dark:hover:bg-zinc-800/30 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <div className="w-full">
                {/* Icon & Badge */}
                <div className="flex items-center justify-between mb-4 w-full">
                  <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-450 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 group-hover:text-blue-700 dark:group-hover:text-blue-350 transition-colors duration-200">
                    <Icon size={20} className="shrink-0" />
                  </div>
                  {report.badge && (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                      {report.badge}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-base font-semibold text-slate-800 dark:text-zinc-100 mb-2 group-hover:text-blue-900 dark:group-hover:text-blue-400 transition-colors duration-200">
                  {report.title}
                </h3>

                {/* Description */}
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                  {report.desc}
                </p>
              </div>

              {/* Action Indicator (Chevron) */}
              <div className="flex items-center justify-end w-full mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800/50 text-slate-400 dark:text-zinc-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 me-1">
                  {t('reports.view', 'Voir le rapport')}
                </span>
                <ChevronRight size={16} className="rtl:rotate-180" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}