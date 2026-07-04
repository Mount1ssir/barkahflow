import { dbSelect } from '@/src/lib/db'

export interface TopProduct {
  id: string
  nameAr: string
  unitsSold: number
  totalAmount: number
  color: string
}

type Period = 'today' | 'week' | 'month'

function getDateRange(period: Period): { start: string; end: string } {
  const now = new Date()
  const end = now.toISOString().split('T')[0]

  let start: Date
  switch (period) {
    case 'today':
      start = new Date(now)
      break
    case 'week':
      start = new Date(now)
      start.setDate(start.getDate() - 6)
      break
    case 'month':
      start = new Date(now)
      start.setMonth(start.getMonth() - 1)
      break
  }

  return { start: start.toISOString().split('T')[0], end }
}

export async function getTopProducts(
  limit: number = 4,
  period: Period = 'week'
): Promise<TopProduct[]> {
  const { start, end } = getDateRange(period)
  console.log('🔍 Période sélectionnée:', { start, end })

  // 1. Compter les factures (hors annulées) dans la période
  const countInvoicesSql = `
    SELECT COUNT(*) as total
    FROM invoices
    WHERE status != 'CANCELLED'
      AND created_at >= ? AND created_at <= ?
  `
  const countInvoices = await dbSelect<{ total: number }>(countInvoicesSql, [start, end])
  console.log(`📊 Nombre de factures (hors annulées) dans la période :`, countInvoices[0]?.total || 0)

  // 2. Compter les lignes de factures dans la période
  const countLinesSql = `
    SELECT COUNT(*) as total
    FROM line_items li
    JOIN invoices i ON i.id = li.invoice_id
    WHERE i.status != 'CANCELLED'
      AND i.created_at >= ? AND i.created_at <= ?
  `
  const countLines = await dbSelect<{ total: number }>(countLinesSql, [start, end])
  console.log(`📊 Nombre de lignes de factures dans la période :`, countLines[0]?.total || 0)

  // 3. Requête principale
  const sql = `
    SELECT
      li.product_id,
      COALESCE(p.name_fr, p.name_ar, p.sku, 'Produit sans nom') as display_name,
      COALESCE(c.color, '#6B7280') as color,
      SUM(li.qty) as units_sold,
      SUM(li.subtotal) as total_amount
    FROM line_items li
    JOIN products p ON p.id = li.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    JOIN invoices i ON i.id = li.invoice_id
    WHERE i.status != 'CANCELLED'
      AND i.created_at >= ? AND i.created_at <= ?
    GROUP BY li.product_id
    ORDER BY units_sold DESC
    LIMIT ?
  `

  console.log('🔍 SQL exécutée:', sql)
  console.log('📅 Paramètres:', [start, end, limit])

  try {
    const rows = await dbSelect<any>(sql, [start, end, limit])
    console.log('📦 Résultats bruts de la requête principale:', rows)

    if (rows && rows.length > 0) {
      return rows.map((row: any) => ({
        id: row.product_id,
        nameAr: row.display_name,
        unitsSold: Number(row.units_sold),
        totalAmount: Number(row.total_amount),
        color: row.color,
      }))
    }

    // 🔥 Si aucun résultat, on essaie sans filtre de date pour voir si des produits existent
    console.warn('⚠️ Aucun résultat avec la période. Tentative sans filtre de date...')
    const fallbackSql = `
      SELECT
        li.product_id,
        COALESCE(p.name_fr, p.name_ar, p.sku, 'Produit sans nom') as display_name,
        COALESCE(c.color, '#6B7280') as color,
        SUM(li.qty) as units_sold,
        SUM(li.subtotal) as total_amount
      FROM line_items li
      JOIN products p ON p.id = li.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      JOIN invoices i ON i.id = li.invoice_id
      WHERE i.status != 'CANCELLED'
      GROUP BY li.product_id
      ORDER BY units_sold DESC
      LIMIT ?
    `
    const fallbackRows = await dbSelect<any>(fallbackSql, [limit])
    console.log('📦 Résultats sans filtre de date:', fallbackRows)

    if (fallbackRows && fallbackRows.length > 0) {
      console.warn('✅ Des produits existent mais en dehors de la période sélectionnée.')
      return fallbackRows.map((row: any) => ({
        id: row.product_id,
        nameAr: row.display_name,
        unitsSold: Number(row.units_sold),
        totalAmount: Number(row.total_amount),
        color: row.color,
      }))
    }

    // 🔥 Dernier test : vérifier s'il y a des lignes tout court (même avec statut CANCELLED)
    const totalLinesSql = `SELECT COUNT(*) as total FROM line_items`
    const totalLines = await dbSelect<{ total: number }>(totalLinesSql)
    console.log(`📊 Nombre total de lignes dans line_items (tous statuts) :`, totalLines[0]?.total || 0)

    if (totalLines[0]?.total === 0) {
      console.warn('❌ La table line_items est complètement vide.')
    }

    return []
  } catch (error) {
    console.error('❌ Erreur dans getTopProducts:', error)
    return []
  }
}