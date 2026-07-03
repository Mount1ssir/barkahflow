// lib/stock-movements.ts
import { dbExecute, dbSelect } from '@/src/lib/db'
import { updateStock, getProductById } from './products-data'

export interface StockMovement {
  id: string
  productId: string
  type: 'in' | 'out'
  quantity: number
  unitPrice: number | null
  reason: string | null
  createdAt: string
}

interface MovementRow {
  id: string
  product_id: string
  type: 'in' | 'out'
  quantity: number
  unit_price: number | null
  reason: string | null
  created_at: string
}

function mapMovement(row: MovementRow): StockMovement {
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

export async function getProductMovements(productId: string): Promise<StockMovement[]> {
  const rows = await dbSelect<MovementRow>(
    `SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC`,
    [productId]
  )
  return rows.map(mapMovement)
}

export async function addStockMovement(
  productId: string,
  type: 'in' | 'out',
  quantity: number,
  unitPrice: number | null = null,
  reason: string | null = null
): Promise<void> {
  const id = `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const now = new Date().toISOString()
  await dbExecute(
    `INSERT INTO stock_movements (id, product_id, type, quantity, unit_price, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, productId, type, quantity, unitPrice, reason, now]
  )
}

export async function replenishStock(
  productId: string,
  quantity: number,
  unitPrice?: number,
  reason?: string
): Promise<void> {
  const product = await getProductById(productId)
  if (!product) throw new Error('Produit introuvable')
  const newQty = product.stockQty + quantity
  await updateStock(productId, newQty)
  await addStockMovement(productId, 'in', quantity, unitPrice || null, reason || null)
}

export async function deductStock(
  productId: string,
  quantity: number,
  reason?: string
): Promise<void> {
  const product = await getProductById(productId)
  if (!product) throw new Error('Produit introuvable')
  const newQty = product.stockQty - quantity
  if (newQty < 0) throw new Error('Stock insuffisant')
  await updateStock(productId, newQty)
  await addStockMovement(productId, 'out', quantity, null, reason || null)
}