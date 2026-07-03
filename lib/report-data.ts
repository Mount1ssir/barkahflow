import { dbSelect } from '@/src/lib/db'

export interface SalesStats {
  total: number
  count: number
  average: number
}

export interface TopProduct {
  id: string
  name: string
  sku: string
  quantity: number
  total: number
}

export interface CategoryStat {
  name: string
  value: number
}

function getDateRange(period: 'daily' | 'weekly' | 'monthly'): { start: string; end: string } {
  const now = new Date()
  let start = new Date(now)
  let end = new Date(now)

  if (period === 'daily') {
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
  } else if (period === 'weekly') {
    const day = now.getDay() || 7
    start.setDate(now.getDate() - day + 1)
    start.setHours(0, 0, 0, 0)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
  } else {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    end.setMonth(now.getMonth() + 1, 0)
    end.setHours(23, 59, 59, 999)
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

export async function getDailySales(): Promise<SalesStats> {
  const { start, end } = getDateRange('daily')
  const rows = await dbSelect<any>(
    `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
     FROM invoices
     WHERE status = 'PAID' AND created_at BETWEEN ? AND ?`,
    [start, end]
  )
  const row = rows[0] || { count: 0, total: 0 }
  return {
    total: row.total,
    count: row.count,
    average: row.count > 0 ? row.total / row.count : 0,
  }
}

export async function getWeeklySales(): Promise<SalesStats> {
  const { start, end } = getDateRange('weekly')
  const rows = await dbSelect<any>(
    `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
     FROM invoices
     WHERE status = 'PAID' AND created_at BETWEEN ? AND ?`,
    [start, end]
  )
  const row = rows[0] || { count: 0, total: 0 }
  return {
    total: row.total,
    count: row.count,
    average: row.count > 0 ? row.total / row.count : 0,
  }
}

export async function getMonthlySales(): Promise<SalesStats> {
  const { start, end } = getDateRange('monthly')
  const rows = await dbSelect<any>(
    `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
     FROM invoices
     WHERE status = 'PAID' AND created_at BETWEEN ? AND ?`,
    [start, end]
  )
  const row = rows[0] || { count: 0, total: 0 }
  return {
    total: row.total,
    count: row.count,
    average: row.count > 0 ? row.total / row.count : 0,
  }
}

export async function getTopProducts(limit = 5): Promise<TopProduct[]> {
  const { start, end } = getDateRange('daily')
  const rows = await dbSelect<any>(
    `SELECT p.id, p.name_ar as name, p.sku, SUM(l.qty) as quantity, SUM(l.subtotal) as total
     FROM line_items l
     JOIN products p ON p.id = l.product_id
     JOIN invoices i ON i.id = l.invoice_id
     WHERE i.status = 'PAID' AND i.created_at BETWEEN ? AND ?
     GROUP BY p.id
     ORDER BY quantity DESC
     LIMIT ?`,
    [start, end, limit]
  )
  return rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    sku: row.sku,
    quantity: row.quantity,
    total: row.total,
  }))
}

export async function getSalesByCategory(): Promise<CategoryStat[]> {
  const { start, end } = getDateRange('daily')
  const rows = await dbSelect<any>(
    `SELECT COALESCE(c.name_fr, 'Sans catégorie') as name, COALESCE(SUM(l.subtotal), 0) as total
     FROM line_items l
     JOIN products p ON p.id = l.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     JOIN invoices i ON i.id = l.invoice_id
     WHERE i.status = 'PAID' AND i.created_at BETWEEN ? AND ?
     GROUP BY c.id
     ORDER BY total DESC`,
    [start, end]
  )
  const total = rows.reduce((sum, r) => sum + r.total, 0) || 1
  return rows.map((row: any) => ({
    name: row.name,
    value: Math.round((row.total / total) * 100),
  }))
}