// lib/stock-history.ts
import { dbSelect } from '@/src/lib/db'

export interface StockMovement {
  id: string
  productId: string
  productName: string
  type: 'IN' | 'OUT' | 'ADJUSTMENT'
  quantity: number
  previousQty: number
  newQty: number
  reason: string | null
  createdAt: string
}

export async function getStockHistory(
  productId: string,
  limit: number = 50
): Promise<{ movements: StockMovement[]; trackStock: boolean; productName: string }> {
  // 1. Récupérer le produit pour connaître track_stock
  const product = await dbSelect<{ name_ar: string; track_stock: number }>(
    `SELECT name_ar, track_stock FROM products WHERE id = ?`,
    [productId]
  )

  if (product.length === 0) {
    return { movements: [], trackStock: false, productName: 'Produit inconnu' }
  }

  const trackStock = product[0].track_stock === 1
  const productName = product[0].name_ar

  // 2. Si track_stock est désactivé, retourner un tableau vide
  if (!trackStock) {
    return { movements: [], trackStock: false, productName }
  }

  // 3. Sinon, récupérer l'historique
  // ✅ CORRECTION : utilisation de l'alias correct pour previous_qty
  const rows = await dbSelect<any>(
    `SELECT 
       sm.id,
       sm.product_id as productId,
       sm.type,
       sm.quantity,
       sm.previous_qty as previousQty,
       sm.new_qty as newQty,
       sm.reason,
       sm.created_at as createdAt,
       p.name_ar as productName
     FROM stock_movements sm
     JOIN products p ON p.id = sm.product_id
     WHERE sm.product_id = ?
     ORDER BY sm.created_at DESC
     LIMIT ?`,
    [productId, limit]
  )

  return {
    movements: rows.map((row: any) => ({
      id: row.id,
      productId: row.productId,
      productName: row.productName,
      type: row.type,
      quantity: row.quantity,
      previousQty: row.previousQty,
      newQty: row.newQty,
      reason: row.reason,
      createdAt: row.createdAt,
    })),
    trackStock,
    productName,
  }
}

export async function getProductStockHistory(productId: string): Promise<StockMovement[]> {
  const result = await getStockHistory(productId, 1000)
  return result.movements
}