import { dbSelect } from '@/src/lib/db'

export interface StockAlert {
  productId: string
  nameAr: string
  nameFr: string | null
  sku: string
  stockQty: number
  alertThreshold: number
  severity: 'critical' | 'low'
}

export async function getStockAlerts(limit: number = 10): Promise<StockAlert[]> {
  const rows = await dbSelect<any>(
    `SELECT 
       p.id as productId,
       CASE
         WHEN p.name_ar IS NOT NULL AND p.name_ar != '' THEN p.name_ar
         WHEN p.name_fr IS NOT NULL AND p.name_fr != '' THEN p.name_fr
         WHEN p.sku IS NOT NULL AND p.sku != '' THEN p.sku
         ELSE 'Produit sans nom'
       END as nameAr,
       p.name_fr as nameFr,
       p.sku,
       p.stock_qty as stockQty,
       p.alert_threshold as alertThreshold,
       CASE 
         WHEN p.stock_qty <= 0 THEN 'critical'
         WHEN p.stock_qty <= p.alert_threshold THEN 'low'
       END as severity
     FROM products p
     WHERE p.is_active = 1
       AND p.stock_qty <= p.alert_threshold
     ORDER BY 
       CASE 
         WHEN p.stock_qty <= 0 THEN 1
         ELSE 2
       END,
       p.stock_qty ASC
     LIMIT ?`,
    [limit]
  )

  return rows.map((row: any) => ({
    productId: row.productId,
    nameAr: row.nameAr,
    nameFr: row.nameFr,
    sku: row.sku,
    stockQty: Number(row.stockQty),
    alertThreshold: Number(row.alertThreshold),
    severity: row.severity || 'low',
  }))
}

export async function countStockAlerts(): Promise<number> {
  const rows = await dbSelect<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM products p
     WHERE p.is_active = 1
       AND p.stock_qty <= p.alert_threshold`
  )
  return rows[0]?.count || 0
}