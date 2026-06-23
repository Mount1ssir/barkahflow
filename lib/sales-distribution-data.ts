// lib/sales-distribution-data.ts
import { dbSelect } from '@/src/lib/db'

export interface SalesSlice {
  name: string
  value: number
  amount: number
}

interface DistributionRow {
  name_ar: string
  total_amount: number
}

export async function getSalesDistribution(): Promise<SalesSlice[]> {
  const rows = await dbSelect<DistributionRow>(
    `SELECT products.name_ar, SUM(line_items.subtotal) as total_amount
     FROM line_items
     JOIN products ON products.id = line_items.product_id
     GROUP BY line_items.product_id
     ORDER BY total_amount DESC
     LIMIT 5`
  )

  const total = rows.reduce((sum, r) => sum + r.total_amount, 0)
  if (total === 0) return []

  return rows.map((row) => ({
    name: row.name_ar,
    value: Math.round((row.total_amount / total) * 100),
    amount: row.total_amount,
  }))
}