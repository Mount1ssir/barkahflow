import { dbExecute, dbSelect } from '@/src/lib/db'

export interface Product {
  id: string
  sku: string
  nameAr: string
  nameEn: string | null
  costPrice: number
  retailPrice: number
  stockQty: number
  alertThreshold: number
  taxRate: number
  imagePath: string | null
  updatedAt: string
}

interface ProductRow {
  id: string
  sku: string
  name_ar: string
  name_en: string | null
  cost_price: number
  retail_price: number
  stock_qty: number
  alert_threshold: number
  tax_rate: number
  image_path: string | null
  updated_at: string
}

function mapRow(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    costPrice: row.cost_price,
    retailPrice: row.retail_price,
    stockQty: row.stock_qty,
    alertThreshold: row.alert_threshold,
    taxRate: row.tax_rate,
    imagePath: row.image_path,
    updatedAt: row.updated_at,
  }
}

export async function getAllProducts(): Promise<Product[]> {
  const rows = await dbSelect<ProductRow>(
    `SELECT * FROM products ORDER BY updated_at DESC`
  )
  return rows.map(mapRow)
}

export async function getProductById(id: string): Promise<Product | null> {
  const rows = await dbSelect<ProductRow>(
    `SELECT * FROM products WHERE id = ?`,
    [id]
  )
  return rows.length > 0 ? mapRow(rows[0]) : null
}

export interface ProductInput {
  sku: string
  nameAr: string
  nameEn?: string
  costPrice: number
  retailPrice: number
  stockQty: number
  alertThreshold: number
  taxRate: number
  imagePath?: string | null
}

function generateId(): string {
  return `prod_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export async function createProduct(input: ProductInput): Promise<string> {
  const id = generateId()
  const now = new Date().toISOString()

  await dbExecute(
    `INSERT INTO products
     (id, sku, name_ar, name_en, cost_price, retail_price, stock_qty, alert_threshold, tax_rate, image_path, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.sku,
      input.nameAr,
      input.nameEn || null,
      input.costPrice,
      input.retailPrice,
      input.stockQty,
      input.alertThreshold,
      input.taxRate,
      input.imagePath || null,
      now,
    ]
  )

  return id
}

export async function updateProduct(id: string, input: ProductInput): Promise<void> {
  const now = new Date().toISOString()

  await dbExecute(
    `UPDATE products SET
       sku = ?, name_ar = ?, name_en = ?, cost_price = ?, retail_price = ?,
       stock_qty = ?, alert_threshold = ?, tax_rate = ?, image_path = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.sku,
      input.nameAr,
      input.nameEn || null,
      input.costPrice,
      input.retailPrice,
      input.stockQty,
      input.alertThreshold,
      input.taxRate,
      input.imagePath || null,
      now,
      id,
    ]
  )
}

export async function deleteProduct(id: string): Promise<void> {
  await dbExecute(`DELETE FROM products WHERE id = ?`, [id])
}

export async function isSkuTaken(sku: string, excludeId?: string): Promise<boolean> {
  const rows = await dbSelect<{ id: string }>(
    `SELECT id FROM products WHERE sku = ? ${excludeId ? 'AND id != ?' : ''}`,
    excludeId ? [sku, excludeId] : [sku]
  )
  return rows.length > 0
}