import { dbSelect } from '@/src/lib/db'

export interface DashboardStats {
  todayRevenue: number
  todayRevenueChange: number
  totalSales: number
  lowStockCount: number
  totalProducts: number
  totalClients: number
}

export function formatMAD(centimes: number): string {
  return (centimes / 100).toFixed(2) + ' MAD'
}

export async function getDashboardStats(): Promise<DashboardStats> {
  // ── UTC explicite ──────────────────────────────────────────────
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const todayStart = `${todayStr}T00:00:00.000Z`

  const yesterdayDate = new Date(now)
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1)
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0]
  const yesterdayStart = `${yesterdayStr}T00:00:00.000Z`

  // ── CA encaissé d'aujourd'hui (PAID) ──────────────────────────
  const todayRows = await dbSelect<{ total: number }>(
    `SELECT COALESCE(SUM(total), 0) as total
     FROM invoices
     WHERE status = 'PAID'
       AND created_at >= ?`,
    [todayStart]
  )

  // ── CA encaissé d'hier ─────────────────────────────────────────
  const yesterdayRows = await dbSelect<{ total: number }>(
    `SELECT COALESCE(SUM(total), 0) as total
     FROM invoices
     WHERE status = 'PAID'
       AND created_at >= ? AND created_at < ?`,
    [yesterdayStart, todayStart]
  )

  const todayRevenue = todayRows[0]?.total || 0
  const yesterdayRevenue = yesterdayRows[0]?.total || 0

  // ✅ Si aujourd'hui = 0, on affiche 0% (pas -100%)
  let todayRevenueChange = 0
  if (todayRevenue > 0 && yesterdayRevenue > 0) {
    todayRevenueChange = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
  } else if (todayRevenue > 0 && yesterdayRevenue === 0) {
    todayRevenueChange = 100 // Premier encaissement, progression infinie
  }
  // Sinon (todayRevenue === 0) → 0%

  // ── Nombre total de ventes (toutes les factures) ──────────────
  const totalSalesRows = await dbSelect<{ count: number }>(
    `SELECT COUNT(*) as count FROM invoices`
  )

  // ── Produits en stock faible ────────────────────────────────────
  const lowStockRows = await dbSelect<{ count: number }>(
    `SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND stock_qty <= alert_threshold`
  )

  // ── Total produits actifs ──────────────────────────────────────
  const totalProductsRows = await dbSelect<{ count: number }>(
    `SELECT COUNT(*) as count FROM products WHERE is_active = 1`
  )

  // ── Total clients ──────────────────────────────────────────────
  const totalClientsRows = await dbSelect<{ count: number }>(
    `SELECT COUNT(*) as count FROM clients`
  )

  return {
    todayRevenue,
    todayRevenueChange: Math.round(todayRevenueChange * 100) / 100,
    totalSales: totalSalesRows[0]?.count || 0,
    lowStockCount: lowStockRows[0]?.count || 0,
    totalProducts: totalProductsRows[0]?.count || 0,
    totalClients: totalClientsRows[0]?.count || 0,
  }
}