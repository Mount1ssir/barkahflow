import { dbExecute, dbSelect } from '@/src/lib/db'

export interface Product {
  id: string
  sku: string
  barcode: string | null
  nameAr: string
  nameFr: string | null
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null   // ✅ Ajouté
  unit: string
  costPrice: number
  retailPrice: number
  margin: number
  marginPercent: number
  stockQty: number
  alertThreshold: number
  taxRate: number
  imagePath: string | null
  supplierName: string | null
  description: string | null
  isActive: boolean
  updatedAt: string
}

interface ProductRow {
  id: string
  sku: string
  barcode: string | null
  name_ar: string
  name_fr: string | null
  category_id: string | null
  category_name: string | null
  category_color: string | null   // ✅ Ajouté
  unit: string
  cost_price: number
  retail_price: number
  stock_qty: number
  alert_threshold: number
  tax_rate: number
  image_path: string | null
  supplier_name: string | null
  description: string | null
  is_active: number
  updated_at: string
}

function mapRow(row: ProductRow): Product {
  const margin = row.retail_price - row.cost_price
  const marginPercent = row.cost_price > 0
    ? Math.round((margin / row.cost_price) * 100)
    : 0

  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    nameAr: row.name_ar,
    nameFr: row.name_fr,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryColor: row.category_color,   // ✅ Ajouté
    unit: row.unit,
    costPrice: row.cost_price,
    retailPrice: row.retail_price,
    margin,
    marginPercent,
    stockQty: row.stock_qty,
    alertThreshold: row.alert_threshold,
    taxRate: row.tax_rate,
    imagePath: row.image_path,
    supplierName: row.supplier_name,
    description: row.description,
    isActive: row.is_active === 1,
    updatedAt: row.updated_at,
  }
}

export async function generateNextSku(): Promise<string> {
  try {
    const rows = await dbSelect<{ sku: string }>(
      `SELECT sku FROM products WHERE sku LIKE 'PRD-%' ORDER BY sku DESC LIMIT 1`
    )
    if (rows.length === 0) return 'PRD-000001'
    const last = rows[0].sku
    const num = parseInt(last.replace('PRD-', ''), 10)
    return `PRD-${String(num + 1).padStart(6, '0')}`
  } catch (error) {
    console.error('Erreur generateNextSku:', error)
    return `PRD-${Date.now().toString().slice(-6)}`
  }
}

export async function isSkuTaken(sku: string, excludeId?: string): Promise<boolean> {
  try {
    const rows = await dbSelect<{ id: string }>(
      `SELECT id FROM products WHERE sku = ? ${excludeId ? 'AND id != ?' : ''}`,
      excludeId ? [sku, excludeId] : [sku]
    )
    return rows.length > 0
  } catch (error) {
    console.error('Erreur isSkuTaken:', error)
    return false
  }
}

export async function isBarcodeTaken(barcode: string, excludeId?: string): Promise<boolean> {
  if (!barcode) return false
  try {
    const rows = await dbSelect<{ id: string }>(
      `SELECT id FROM products WHERE barcode = ? ${excludeId ? 'AND id != ?' : ''}`,
      excludeId ? [barcode, excludeId] : [barcode]
    )
    return rows.length > 0
  } catch (error) {
    console.error('Erreur isBarcodeTaken:', error)
    return false
  }
}

export async function findBySkuOrBarcode(value: string): Promise<Product | null> {
  try {
    const rows = await dbSelect<ProductRow>(
      `SELECT p.*, c.name_fr as category_name, c.color as category_color
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.sku = ? OR p.barcode = ?
       LIMIT 1`,
      [value, value]
    )
    return rows.length > 0 ? mapRow(rows[0]) : null
  } catch (error) {
    console.error('Erreur findBySkuOrBarcode:', error)
    return null
  }
}

export async function getAllProducts(activeOnly = false): Promise<Product[]> {
  try {
    const rows = await dbSelect<ProductRow>(
      `SELECT p.*, c.name_fr as category_name, c.color as category_color
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${activeOnly ? 'WHERE p.is_active = 1' : ''}
       ORDER BY p.updated_at DESC`
    )
    return rows.map(mapRow)
  } catch (error) {
    console.error('Erreur getAllProducts:', error)
    return []
  }
}

export async function searchProducts(query: string): Promise<Product[]> {
  if (!query.trim()) return getAllProducts()
  try {
    const q = `%${query.trim()}%`
    const rows = await dbSelect<ProductRow>(
      `SELECT p.*, c.name_fr as category_name, c.color as category_color
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.name_ar LIKE ? OR p.name_fr LIKE ?
          OR p.sku LIKE ? OR p.barcode LIKE ?
       ORDER BY p.name_fr ASC
       LIMIT 20`,
      [q, q, q, q]
    )
    return rows.map(mapRow)
  } catch (error) {
    console.error('Erreur searchProducts:', error)
    return []
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const rows = await dbSelect<ProductRow>(
      `SELECT p.*, c.name_fr as category_name, c.color as category_color
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`,
      [id]
    )
    return rows.length > 0 ? mapRow(rows[0]) : null
  } catch (error) {
    console.error('Erreur getProductById:', error)
    return null
  }
}

export interface ProductInput {
  sku: string
  barcode?: string | null
  nameAr: string
  nameFr?: string | null
  categoryId?: string | null
  unit: string
  costPrice: number
  retailPrice: number
  stockQty: number
  alertThreshold: number
  taxRate: number
  imagePath?: string | null
  supplierName?: string | null
  description?: string | null
  isActive?: boolean
}

function generateId(): string {
  return `prod_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export async function createProduct(input: ProductInput): Promise<string> {
  const id = generateId()
  const now = new Date().toISOString()
  const categoryId = input.categoryId && input.categoryId.trim() !== '' ? input.categoryId : null

  console.log('createProduct - categoryId:', categoryId)
  console.log('createProduct - costPrice:', input.costPrice)
  console.log('createProduct - retailPrice:', input.retailPrice)

  try {
    await dbExecute(
      `INSERT INTO products
       (id, sku, barcode, name_ar, name_fr, category_id, unit,
        cost_price, retail_price, stock_qty, alert_threshold, tax_rate,
        image_path, supplier_name, description, is_active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.sku,
        input.barcode || null,
        input.nameAr || '',
        input.nameFr || null,
        categoryId,
        input.unit,
        input.costPrice,
        input.retailPrice,
        input.stockQty,
        input.alertThreshold,
        input.taxRate,
        input.imagePath || null,
        input.supplierName || null,
        input.description || null,
        input.isActive !== false ? 1 : 0,
        now,
      ]
    )
    console.log('Produit cree avec succes, ID:', id)
    return id
  } catch (error: any) {
    console.error('SQL Error dans createProduct:', error)
    const message = error?.message || error?.toString() || 'Erreur SQL inconnue'
    throw new Error(`Erreur base de donnees: ${message}`)
  }
}

export async function updateProduct(id: string, input: ProductInput): Promise<void> {
  const now = new Date().toISOString()
  const categoryId = input.categoryId && input.categoryId.trim() !== '' ? input.categoryId : null

  try {
    await dbExecute(
      `UPDATE products SET
         sku = ?, barcode = ?, name_ar = ?, name_fr = ?, category_id = ?,
         unit = ?, cost_price = ?, retail_price = ?, stock_qty = ?,
         alert_threshold = ?, tax_rate = ?, image_path = ?,
         supplier_name = ?, description = ?, is_active = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.sku,
        input.barcode || null,
        input.nameAr || '',
        input.nameFr || null,
        categoryId,
        input.unit,
        input.costPrice,
        input.retailPrice,
        input.stockQty,
        input.alertThreshold,
        input.taxRate,
        input.imagePath || null,
        input.supplierName || null,
        input.description || null,
        input.isActive !== false ? 1 : 0,
        now,
        id,
      ]
    )
  } catch (error: any) {
    console.error('SQL Error dans updateProduct:', error)
    const message = error?.message || error?.toString() || 'Erreur SQL inconnue'
    throw new Error(`Erreur base de donnees: ${message}`)
  }
}

export async function deleteProduct(id: string): Promise<void> {
  try {
    await dbExecute(`DELETE FROM products WHERE id = ?`, [id])
  } catch (error: any) {
    console.error('Erreur deleteProduct:', error)
    throw new Error(`Erreur lors de la suppression: ${error?.message || 'inconnue'}`)
  }
}

export async function toggleProductStatus(id: string, isActive: boolean): Promise<void> {
  const now = new Date().toISOString()
  try {
    await dbExecute(
      `UPDATE products SET is_active = ?, updated_at = ? WHERE id = ?`,
      [isActive ? 1 : 0, now, id]
    )
  } catch (error: any) {
    console.error('Erreur toggleProductStatus:', error)
    throw new Error(`Erreur lors du changement de statut: ${error?.message || 'inconnue'}`)
  }
}

export async function updateStock(id: string, newQty: number): Promise<void> {
  const now = new Date().toISOString()
  try {
    await dbExecute(
      `UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?`,
      [newQty, now, id]
    )
  } catch (error: any) {
    console.error('Erreur updateStock:', error)
    throw new Error(`Erreur lors de la mise a jour du stock: ${error?.message || 'inconnue'}`)
  }
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

// Validation sans obliger le nom arabe
export function validateProductInput(input: ProductInput): ValidationResult {
  const errors: string[] = []

  if (!input.sku.trim()) {
    errors.push('Le SKU est obligatoire')
  }

  if (input.costPrice < 0) {
    errors.push('Le prix d\'achat ne peut pas etre negatif')
  }

  if (input.retailPrice <= 0) {
    errors.push('Le prix de vente doit etre superieur a 0')
  }

  if (input.costPrice > 0 && input.retailPrice <= input.costPrice) {
    errors.push('Le prix de vente doit etre superieur au prix d\'achat')
  }

  if (input.stockQty < 0) {
    errors.push('Le stock ne peut pas etre negatif')
  }

  if (input.alertThreshold < 0) {
    errors.push('Le seuil d\'alerte ne peut pas etre negatif')
  }

  if (input.taxRate < 0 || input.taxRate > 100) {
    errors.push('La TVA doit etre entre 0 et 100')
  }

  if (!input.unit) {
    errors.push('L\'unite est obligatoire')
  }

  return { valid: errors.length === 0, errors }
}