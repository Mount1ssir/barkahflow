'use client'

import { useUserContext } from '@/context/UserContext'
import { usePermission } from '@/components/rbac/usePermission'
import { PERMISSIONS } from '@/lib/rbac'
import { WelcomeHeader } from '@/components/dashboard/welcome-header'
import { Stats } from '@/components/dashboard/stats'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { StockStatusChart } from '@/components/dashboard/stock-status-chart'
import { TopProducts } from '@/components/dashboard/top-products'
import { SalesDistribution } from '@/components/dashboard/sales-distribution'
import { RecentInvoices } from '@/components/dashboard/recent-invoices'
import { InsightToast } from '@/components/dashboard/insight-toast'

export default function DashboardPage() {
  const { currentUser } = useUserContext()
  const canViewFullDashboard = usePermission(PERMISSIONS.VIEW_FULL_DASHBOARD)

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full relative">
      <InsightToast />
      <WelcomeHeader user={currentUser?.supabaseUser || null} />
      <Stats />
      <QuickActions />

      {/* Revenue charts — only for users with VIEW_FULL_DASHBOARD */}
      {canViewFullDashboard && (
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

      {/* Cashier without VIEW_FULL_DASHBOARD — show only a minimal view */}
      {!canViewFullDashboard && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StockStatusChart />
          <RecentInvoices />
        </div>
      )}
    </div>
  )
}