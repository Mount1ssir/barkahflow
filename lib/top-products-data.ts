import { dbSelect } from '@/src/lib/db'

export interface TopProduct {
  id: string
  nameAr: string      // contient le nom affiché (priorité FR → AR → SKU → fallback)
  unitsSold: number
  totalAmount: number
  color: string
}

type Period = 'today' | 'week' | 'month'

function getDateRange(period: Period): { start: string; end: string } {
  const now = new Date()
  const end = now.toISOString().split('T')[0]

  let start: Date
  switch (period) {
    case 'today':
      start = new Date(now)
      break
    case 'week':
      start = new Date(now)
      start.setDate(start.getDate() - 6)
      break
    case 'month':
      start = new Date(now)
      start.setMonth(start.getMonth() - 1)
      break
  }

  return { start: start.toISOString().split('T')[0], end }
}

export async function getTopProducts(
  limit: number = 4,
  period: Period = 'week'
): Promise<TopProduct[]> {
  const { start, end } = getDateRange(period)

  const rows = await dbSelect<any>(
    `SELECT
       li.product_id,
       COALESCE(p.name_fr, p.name_ar, p.sku, 'Produit sans nom') as display_name,
       COALESCE(c.color, '#6B7280') as color,
       SUM(li.qty) as units_sold,
       SUM(li.subtotal) as total_amount
     FROM line_items li
     JOIN products p ON p.id = li.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     JOIN invoices i ON i.id = li.invoice_id
     WHERE i.status IN ('PAID', 'PARTIAL', 'CONFIRMED')
       AND i.created_at >= ? AND i.created_at <= ?
     GROUP BY li.product_id
     ORDER BY units_sold DESC
     LIMIT ?`,
    [start, end, limit]
  )

  return rows.map((row: any) => ({
    id: row.product_id,
    nameAr: row.display_name,
    unitsSold: Number(row.units_sold),
    totalAmount: Number(row.total_amount),
    color: row.color,
  }))
}