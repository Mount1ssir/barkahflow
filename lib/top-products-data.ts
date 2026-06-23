import { dbSelect } from '@/src/lib/db'

export interface TopProduct {
  id: string
  nameAr: string
  unitsSold: number
  totalAmount: number
}

interface TopProductRow {
  product_id: string
  name_ar: string
  units_sold: number
  total_amount: number
}

export async function getTopProducts(limit: number = 4): Promise<TopProduct[]> {
  const rows = await dbSelect<TopProductRow>(
    `SELECT
       line_items.product_id,
       products.name_ar,
       SUM(line_items.qty) as units_sold,
       SUM(line_items.subtotal) as total_amount
     FROM line_items
     JOIN products ON products.id = line_items.product_id
     GROUP BY line_items.product_id
     ORDER BY units_sold DESC
     LIMIT ?`,
    [limit]
  )

  return rows.map((row) => ({
    id: row.product_id,
    nameAr: row.name_ar,
    unitsSold: row.units_sold,
    totalAmount: row.total_amount,
  }))
}