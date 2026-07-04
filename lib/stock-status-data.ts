import { dbSelect } from '@/src/lib/db'

export interface StockStatusData {
  totalProducts: number
  enStock: number
  stockBas: number
  rupture: number
  totalCategories: number
  totalStockValue: number // en centimes
}

export async function getStockStatus(): Promise<StockStatusData> {
  // Catégorisation des produits
  const rows = await dbSelect<{
    status: string
    count: number
  }>(
    `SELECT
       CASE
         WHEN p.stock_qty <= 0 THEN 'rupture'
         WHEN p.stock_qty <= p.alert_threshold THEN 'stock_bas'
         ELSE 'en_stock'
       END as status,
       COUNT(*) as count
     FROM products p
     WHERE p.is_active = 1
     GROUP BY status`
  )

  let enStock = 0
  let stockBas = 0
  let rupture = 0

  for (const row of rows) {
    if (row.status === 'en_stock') enStock = Number(row.count)
    else if (row.status === 'stock_bas') stockBas = Number(row.count)
    else if (row.status === 'rupture') rupture = Number(row.count)
  }

  const totalProducts = enStock + stockBas + rupture

  // Nombre de catégories distinctes
  const catResult = await dbSelect<{ count: number }>(
    `SELECT COUNT(DISTINCT category_id) as count FROM products WHERE is_active = 1 AND category_id IS NOT NULL`
  )
  const totalCategories = catResult[0]?.count || 0

  // Valeur totale du stock (stock_qty * retail_price)
  const valueResult = await dbSelect<{ total: number }>(
    `SELECT SUM(stock_qty * retail_price) as total FROM products WHERE is_active = 1`
  )
  const totalStockValue = valueResult[0]?.total || 0

  return {
    totalProducts,
    enStock,
    stockBas,
    rupture,
    totalCategories,
    totalStockValue,
  }
}