import { dbSelectWithRetry } from '@/src/lib/db'

export interface StockOverview {
  totalProducts: number
  okStock: number
  lowStock: number
  outOfStock: number
  totalCategories: number
  totalStockValue: number
}

export async function getStockOverview(): Promise<StockOverview> {
  // Répartition du stock
  const stockRows = await dbSelectWithRetry<any>(
    `SELECT
       COUNT(*) as total,
       CASE
         WHEN stock_qty = 0 THEN 'outOfStock'
         WHEN stock_qty <= alert_threshold THEN 'lowStock'
         ELSE 'okStock'
       END as status
     FROM products
     WHERE is_active = 1
     GROUP BY status`
  )

  const result = { totalProducts: 0, okStock: 0, lowStock: 0, outOfStock: 0 }
  for (const row of stockRows) {
    result.totalProducts += row.total
    if (row.status === 'okStock') result.okStock = row.total
    else if (row.status === 'lowStock') result.lowStock = row.total
    else if (row.status === 'outOfStock') result.outOfStock = row.total
  }

  // Nombre de catégories
  const catRows = await dbSelectWithRetry<{ count: number }>(
    `SELECT COUNT(DISTINCT category_id) as count
     FROM products
     WHERE is_active = 1 AND category_id IS NOT NULL`
  )
  const totalCategories = catRows[0]?.count || 0

  // Valeur du stock
  const valueRows = await dbSelectWithRetry<{ total: number }>(
    `SELECT COALESCE(SUM(stock_qty * cost_price), 0) as total
     FROM products
     WHERE is_active = 1`
  )
  const totalStockValue = valueRows[0]?.total || 0

  return { ...result, totalCategories, totalStockValue }
}