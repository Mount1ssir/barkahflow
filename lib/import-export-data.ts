import { dbSelect, dbExecute } from '@/src/lib/db'
import { parse } from 'csv-parse/sync'

export interface ExportableProduct {
  sku: string
  barcode: string | null
  nameAr: string
  nameFr: string | null
  categoryName: string | null
  unit: string
  costPrice: number
  retailPrice: number
  stockQty: number
  alertThreshold: number
  taxRate: number
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export async function exportProducts(): Promise<ExportableProduct[]> {
  const rows = await dbSelect<any>(
    `SELECT p.sku, p.barcode, p.name_ar, p.name_fr, c.name_fr as categoryName,
            p.unit, p.cost_price, p.retail_price, p.stock_qty,
            p.alert_threshold, p.tax_rate
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ORDER BY p.sku`
  )
  return rows.map((row: any) => ({
    sku: row.sku,
    barcode: row.barcode,
    nameAr: row.name_ar,
    nameFr: row.name_fr,
    categoryName: row.categoryName,
    unit: row.unit,
    costPrice: row.cost_price,
    retailPrice: row.retail_price,
    stockQty: row.stock_qty,
    alertThreshold: row.alert_threshold,
    taxRate: row.tax_rate,
  }))
}

export async function exportInvoices(startDate?: string, endDate?: string): Promise<any[]> {
  let query = `
    SELECT i.invoice_number, i.created_at, c.full_name as client_name,
           i.subtotal, i.tax, i.discount, i.total, i.status
    FROM invoices i
    LEFT JOIN clients c ON c.id = i.client_id
  `
  const params: any[] = []
  if (startDate && endDate) {
    query += ` WHERE i.created_at BETWEEN ? AND ?`
    params.push(startDate, endDate)
  }
  query += ` ORDER BY i.created_at DESC`
  return await dbSelect<any>(query, params)
}

export async function importProductsFromCSV(file: File): Promise<ImportResult> {
  const text = await file.text()
  // ✅ Cast explicite : on précise que le résultat est un tableau d'objets
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as any[]

  const errors: string[] = []
  let imported = 0
  let skipped = 0

  for (let i = 0; i < records.length; i++) {
    const row = records[i]
    try {
      if (!row.sku || !row.nameAr || !row.retailPrice) {
        errors.push(`Ligne ${i+1}: SKU, nom arabe et prix de vente sont obligatoires`)
        skipped++
        continue
      }
      const existing = await dbSelect<any>(`SELECT id FROM products WHERE sku = ?`, [row.sku])
      if (existing.length > 0) {
        errors.push(`Ligne ${i+1}: SKU ${row.sku} existe déjà`)
        skipped++
        continue
      }
      const id = `prod_${Date.now()}_${Math.random().toString(36).slice(2,7)}`
      const now = new Date().toISOString()
      await dbExecute(
        `INSERT INTO products (
          id, sku, barcode, name_ar, name_fr, unit, cost_price, retail_price,
          stock_qty, alert_threshold, tax_rate, is_active, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          id,
          row.sku,
          row.barcode || null,
          row.nameAr,
          row.nameFr || null,
          row.unit || 'piece',
          Math.round(parseFloat(row.costPrice) * 100) || 0,
          Math.round(parseFloat(row.retailPrice) * 100),
          parseInt(row.stockQty) || 0,
          parseInt(row.alertThreshold) || 5,
          parseFloat(row.taxRate) || 0,
          now
        ]
      )
      imported++
    } catch (e: any) {
      errors.push(`Ligne ${i+1}: ${e.message}`)
      skipped++
    }
  }
  return { imported, skipped, errors }
}