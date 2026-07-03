import { dbSelect } from '@/src/lib/db'

export interface DashboardStats {
  todayRevenue: number
  todayRevenueChange: number
  totalSales: number        // Ajouté pour le nombre de ventes
  lowStockCount: number
  totalProducts: number
  totalClients: number
}

export function formatMAD(centimes: number): string {
  return (centimes / 100).toFixed(2) + ' MAD'
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  // CA d'aujourd'hui (factures PAID)
  const todayRows = await dbSelect<{ total: number }>(
    `SELECT COALESCE(SUM(total), 0) as total
     FROM invoices
     WHERE status = 'PAID'
       AND created_at >= ?`,
    [today.toISOString()]
  )

  // CA d'hier
  const yesterdayRows = await dbSelect<{ total: number }>(
    `SELECT COALESCE(SUM(total), 0) as total
     FROM invoices
     WHERE status = 'PAID'
       AND created_at >= ? AND created_at < ?`,
    [yesterday.toISOString(), today.toISOString()]
  )

  const todayRevenue = todayRows[0]?.total || 0
  const yesterdayRevenue = yesterdayRows[0]?.total || 0
  const todayRevenueChange = yesterdayRevenue === 0 ? 0 : ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100

  // Nombre total de factures payées (ventes)
  const totalSalesRows = await dbSelect<{ count: number }>(
    `SELECT COUNT(*) as count FROM invoices WHERE status = 'PAID'`
  )

  // Produits en stock faible
  const lowStockRows = await dbSelect<{ count: number }>(
    `SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND stock_qty <= alert_threshold`
  )

  // Total produits actifs
  const totalProductsRows = await dbSelect<{ count: number }>(
    `SELECT COUNT(*) as count FROM products WHERE is_active = 1`
  )

  // Total clients
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