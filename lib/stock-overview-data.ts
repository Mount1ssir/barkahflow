// lib/stock-overview-data.ts
import { dbSelect } from '@/src/lib/db'

export interface StockOverview {
  totalProducts: number
  okStock: number
  lowStock: number
  outOfStock: number
}

interface ProductRow {
  stock_qty: number
  alert_threshold: number
}

export async function getStockOverview(): Promise<StockOverview> {
  const products = await dbSelect<ProductRow>(
    `SELECT stock_qty, alert_threshold FROM products`
  )

  let okStock = 0
  let lowStock = 0
  let outOfStock = 0

  for (const p of products) {
    if (p.stock_qty === 0) outOfStock++
    else if (p.stock_qty <= p.alert_threshold) lowStock++
    else okStock++
  }

  return {
    totalProducts: products.length,
    okStock,
    lowStock,
    outOfStock,
  }
}