import { dbSelect } from '@/src/lib/db'

export interface StockAlert {
  id: string
  nameAr: string
  nameEn: string | null
  stockQty: number
  alertThreshold: number
  severity: 'critical' | 'low'
}

interface ProductRow {
  id: string
  name_ar: string
  name_en: string | null
  stock_qty: number
  alert_threshold: number
}

export async function getStockAlerts(limit: number = 4): Promise<StockAlert[]> {
  const rows = await dbSelect<ProductRow>(
    `SELECT id, name_ar, name_en, stock_qty, alert_threshold
     FROM products
     WHERE stock_qty <= alert_threshold
     ORDER BY stock_qty ASC
     LIMIT ?`,
    [limit]
  )

  return rows.map((row) => ({
    id: row.id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    stockQty: row.stock_qty,
    alertThreshold: row.alert_threshold,
    severity: row.stock_qty === 0 ? 'critical' : row.stock_qty <= row.alert_threshold / 2 ? 'critical' : 'low',
  }))
}