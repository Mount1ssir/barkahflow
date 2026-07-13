// lib/stock-data.ts
import { dbExecute, dbSelect } from '@/src/lib/db'

export interface StockMovement {
  id: string
  productId: string
  type: 'in' | 'out'
  quantity: number
  unitPrice: number | null
  reason: string | null
  createdAt: string
  productName?: string
}

interface StockMovementRow {
  id: string
  product_id: string
  type: 'in' | 'out'
  quantity: number
  unit_price: number | null
  reason: string | null
  created_at: string
}

function mapRow(row: StockMovementRow): StockMovement {
  return {
    id: row.id,
    productId: row.product_id,
    type: row.type,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    reason: row.reason,
    createdAt: row.created_at,
  }
}

export async function getStockHistory(productId: string): Promise<StockMovement[]> {
  try {
    const rows = await dbSelect<StockMovementRow>(
      `SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC`,
      [productId]
    )
    return rows.map(mapRow)
  } catch (error) {
    console.error('Erreur getStockHistory:', error)
    return []
  }
}

export async function getAllStockMovements(limit = 50): Promise<StockMovement[]> {
  try {
    const rows = await dbSelect<StockMovementRow>(
      `SELECT sm.*, p.name_ar as product_name, p.sku as product_sku
       FROM stock_movements sm
       LEFT JOIN products p ON p.id = sm.product_id
       ORDER BY sm.created_at DESC
       LIMIT ?`,
      [limit]
    )
    return rows.map(mapRow)
  } catch (error) {
    console.error('Erreur getAllStockMovements:', error)
    return []
  }
}

export async function addStock(
  productId: string,
  quantity: number,
  reason?: string,
  unitPrice?: number
): Promise<void> {
  if (quantity <= 0) throw new Error('La quantité doit être positive')
  
  const id = `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const now = new Date().toISOString()
  
  try {
    // Récupérer le stock actuel du produit
    const product = await dbSelect<{ stock_qty: number }>(
      `SELECT stock_qty FROM products WHERE id = ?`,
      [productId]
    )
    
    if (product.length === 0) {
      throw new Error('Produit non trouvé')
    }
    
    const currentQty = product[0].stock_qty
    const newQty = currentQty + quantity
    
    // Insérer le mouvement de stock
    await dbExecute(
      `INSERT INTO stock_movements (
        id, product_id, type, quantity, unit_price, previous_qty, new_qty, reason, created_at
      ) VALUES (?, ?, 'IN', ?, ?, ?, ?, ?, ?)`,
      [id, productId, quantity, unitPrice || null, currentQty, newQty, reason || null, now]
    )
    
    // Mettre à jour le stock du produit
    await dbExecute(
      `UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?`,
      [newQty, now, productId]
    )
    
    // ✅ Déclencher l'événement pour rafraîchir les notifications
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('barkahflow:notifications-changed'))
      window.dispatchEvent(new Event('barkahflow:stock-updated'))
    }
    
  } catch (error) {
    console.error('Erreur addStock:', error)
    throw new Error('Erreur lors de l\'ajout de stock')
  }
}

export async function removeStock(
  productId: string,
  quantity: number,
  reason?: string,
  unitPrice?: number
): Promise<void> {
  if (quantity <= 0) throw new Error('La quantité doit être positive')
  
  const product = await dbSelect<{ stock_qty: number }>(
    `SELECT stock_qty FROM products WHERE id = ?`,
    [productId]
  )
  
  if (product.length === 0) throw new Error('Produit non trouvé')
  if (product[0].stock_qty < quantity) throw new Error('Stock insuffisant')
  
  const id = `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const now = new Date().toISOString()
  const currentQty = product[0].stock_qty
  const newQty = currentQty - quantity
  
  try {
    await dbExecute(
      `INSERT INTO stock_movements (
        id, product_id, type, quantity, unit_price, previous_qty, new_qty, reason, created_at
      ) VALUES (?, ?, 'OUT', ?, ?, ?, ?, ?, ?)`,
      [id, productId, quantity, unitPrice || null, currentQty, newQty, reason || null, now]
    )
    
    await dbExecute(
      `UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?`,
      [newQty, now, productId]
    )
    
    // ✅ Déclencher l'événement pour rafraîchir les notifications
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('barkahflow:notifications-changed'))
      window.dispatchEvent(new Event('barkahflow:stock-updated'))
    }
    
  } catch (error) {
    console.error('Erreur removeStock:', error)
    throw new Error('Erreur lors du retrait de stock')
  }
}

export async function getLowStockProducts(): Promise<any[]> {
  try {
    return await dbSelect(
      `SELECT id, name_ar, name_fr, sku, stock_qty, alert_threshold
       FROM products WHERE is_active = 1 AND stock_qty <= alert_threshold
       ORDER BY stock_qty ASC`
    )
  } catch { return [] }
}

export async function getTotalStockValue(): Promise<number> {
  try {
    const rows = await dbSelect<{ total: number }>(
      `SELECT SUM(stock_qty * cost_price) as total FROM products WHERE is_active = 1`
    )
    return rows.length > 0 ? rows[0].total || 0 : 0
  } catch { return 0 }
}