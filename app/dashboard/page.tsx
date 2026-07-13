'use client'

import { useUserContext } from '@/context/UserContext'
import { PERMISSIONS } from '@/lib/rbac'
import { usePermission } from '@/components/rbac/usePermission'
import { Guard } from '@/components/rbac/Guard'
import { WelcomeHeader } from '@/components/dashboard/welcome-header'
import { Stats } from '@/components/dashboard/stats'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { StockStatusChart } from '@/components/dashboard/stock-status-chart'
import { TopProducts } from '@/components/dashboard/top-products'
import { SalesDistribution } from '@/components/dashboard/sales-distribution'
import { RecentInvoices } from '@/components/dashboard/recent-invoices'
import { InsightToast } from '@/components/dashboard/insight-toast'
import { LayoutDashboard } from 'lucide-react'
import { useRouter } from 'next/navigation'

function DashboardContent() {
  const { currentUser } = useUserContext()
  const router = useRouter()
  
  const canViewStats = usePermission(PERMISSIONS.DASHBOARD_VIEW_STATS)
  const canViewCharts = usePermission(PERMISSIONS.DASHBOARD_VIEW_CHARTS)

  if (!canViewStats && !canViewCharts) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-7xl mx-auto">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
          <LayoutDashboard className="w-8 h-8 text-gray-300 dark:text-zinc-600" />
        </div>
        <p className="font-semibold text-gray-700 dark:text-gray-300">
          Accès limité au tableau de bord
        </p>
        <p className="text-sm text-gray-400 mt-1 max-w-md">
          Vous n'avez pas les permissions nécessaires pour voir le tableau de bord.
        </p>
      </div>
    )
  }

  // 🔥 Gestionnaire pour l'action "Nouvelle facture"
  const handleInvoiceClick = () => {
    // Redirection directe vers les factures sans message
    router.push('/dashboard/factures')
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full relative">
      <InsightToast />
      <WelcomeHeader user={currentUser?.supabaseUser || null} />

      {/* ─── STATISTIQUES + ACTIONS RAPIDES ─────────────────────── */}
      {canViewStats && (
        <>
          <Stats />
          <QuickActions onInvoiceClick={handleInvoiceClick} />
        </>
      )}

      {/* ─── GRAPHIQUES ───────────────────────────────────────────── */}
      {canViewCharts && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RevenueChart />
            </div>
            <div className="lg:col-span-1">
              <StockStatusChart />
            </div>
          </div>

          <TopProducts />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SalesDistribution />
            <RecentInvoices />
          </div>
        </>
      )}

      {/* ─── MESSAGE SI SEULEMENT STATS SANS GRAPHIQUES ──────────── */}
      {canViewStats && !canViewCharts && (
        <div className="text-center py-8 px-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800">
          <p className="text-sm text-blue-600 dark:text-blue-400">
            💡 Pour voir les graphiques, demandez la permission "Voir les graphiques" à l'administrateur.
          </p>
        </div>
      )}

      {/* ─── MESSAGE SI SEULEMENT GRAPHIQUES SANS STATS ──────────── */}
      {!canViewStats && canViewCharts && (
        <div className="text-center py-8 px-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800">
          <p className="text-sm text-blue-600 dark:text-blue-400">
            💡 Pour voir les statistiques, demandez la permission "Voir les statistiques" à l'administrateur.
          </p>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Guard permission={PERMISSIONS.DASHBOARD_ACCESS} redirectTo="/dashboard/caisse">
      <DashboardContent />
    </Guard>
  )
}