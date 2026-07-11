import { dbSelect } from '@/src/lib/db'

export interface DashboardStats {
  todayRevenue: number
  todayRevenueChange: number
  todaySales: number
  todaySalesChange: number
  lowStockCount: number
  totalProducts: number
  totalClients: number
}

export function formatMAD(centimes: number): string {
  return (centimes / 100).toFixed(2) + ' MAD'
}

function computeChangePct(today: number, yesterday: number): number {
  if (today > 0 && yesterday > 0) {
    return Math.round(((today - yesterday) / yesterday) * 10000) / 100
  }
  if (today > 0 && yesterday === 0) return 100
  return 0
}

export async function getDashboardStats(): Promise<DashboardStats> {
  // ── Encaissé d'aujourd'hui (heure LOCALE) ──────────────────────
  // ✅ Inclut : factures + paiements de dette + revenus externes
  const todayRevenueRows = await dbSelect<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM transactions
     WHERE type = 'INCOME'
       AND (
         source_type = 'invoice'
         OR (source_type = 'manual' AND category IN ('debt_payment', 'external_revenue'))
       )
       AND date(transaction_date) = date('now', 'localtime')`
  )

  const yesterdayRevenueRows = await dbSelect<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM transactions
     WHERE type = 'INCOME'
       AND (
         source_type = 'invoice'
         OR (source_type = 'manual' AND category IN ('debt_payment', 'external_revenue'))
       )
       AND date(transaction_date) = date('now', '-1 day', 'localtime')`
  )

  const todayRevenue = todayRevenueRows[0]?.total || 0
  const yesterdayRevenue = yesterdayRevenueRows[0]?.total || 0
  const todayRevenueChange = computeChangePct(todayRevenue, yesterdayRevenue)

  // ── Ventes du jour (nombre de factures créées aujourd'hui) ─────
  const todaySalesRows = await dbSelect<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM invoices
     WHERE status != 'CANCELLED'
       AND date(created_at) = date('now', 'localtime')`
  )

  const yesterdaySalesRows = await dbSelect<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM invoices
     WHERE status != 'CANCELLED'
       AND date(created_at) = date('now', '-1 day', 'localtime')`
  )

  const todaySales = todaySalesRows[0]?.count || 0
  const yesterdaySales = yesterdaySalesRows[0]?.count || 0
  const todaySalesChange = computeChangePct(todaySales, yesterdaySales)

  // ─── Produits en stock faible ────────────────────────────────────
  const lowStockRows = await dbSelect<{ count: number }>(
    `SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND stock_qty <= alert_threshold`
  )

  // ─── Total produits actifs ──────────────────────────────────────
  const totalProductsRows = await dbSelect<{ count: number }>(
    `SELECT COUNT(*) as count FROM products WHERE is_active = 1`
  )

  // ─── Total clients ────────────────────────────────────────────
  const totalClientsRows = await dbSelect<{ count: number }>(
    `SELECT COUNT(*) as count FROM clients WHERE id != 'client_walkin'`
  )

  return {
    todayRevenue,
    todayRevenueChange,
    todaySales,
    todaySalesChange,
    lowStockCount: lowStockRows[0]?.count || 0,
    totalProducts: totalProductsRows[0]?.count || 0,
    totalClients: totalClientsRows[0]?.count || 0,
  }
}