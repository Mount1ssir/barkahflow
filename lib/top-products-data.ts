import { dbSelect } from '@/src/lib/db'

export interface TopProduct {
  id: string
  nameAr: string
  unitsSold: number
  totalAmount: number
  color: string
}

type Period = 'today' | 'week' | 'month'

// Bornes en dates locales simples (YYYY-MM-DD), calculées avec les getters
// locaux — pas toISOString() qui convertit en UTC et peut décaler le jour.
function getLocalDateRange(period: Period): { start: string; end: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const formatLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  const end = formatLocal(now)

  let startDate: Date
  switch (period) {
    case 'today':
      startDate = new Date(now)
      break
    case 'week':
      startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 6)
      break
    case 'month':
      startDate = new Date(now)
      startDate.setMonth(startDate.getMonth() - 1)
      break
  }

  return { start: formatLocal(startDate), end }
}

export async function getTopProducts(
  limit: number = 4,
  period: Period = 'week'
): Promise<TopProduct[]> {
  const { start, end } = getLocalDateRange(period)
  console.log('🔍 Période sélectionnée:', { start, end })

  // 1. Compter les factures (hors annulées) dans la période
  const countInvoicesSql = `
    SELECT COUNT(*) as total
    FROM invoices
    WHERE status != 'CANCELLED'
      AND date(created_at, 'localtime') BETWEEN date(?) AND date(?)
  `
  const countInvoices = await dbSelect<{ total: number }>(countInvoicesSql, [start, end])
  console.log(`📊 Nombre de factures (hors annulées) dans la période :`, countInvoices[0]?.total || 0)

  // 2. Compter les lignes de factures dans la période
  const countLinesSql = `
    SELECT COUNT(*) as total
    FROM line_items li
    JOIN invoices i ON i.id = li.invoice_id
    WHERE i.status != 'CANCELLED'
      AND date(i.created_at, 'localtime') BETWEEN date(?) AND date(?)
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
      AND date(i.created_at, 'localtime') BETWEEN date(?) AND date(?)
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

    // Aucun résultat dans la période demandée : on retourne un tableau vide.
    // (Plus de fallback silencieux vers "toutes les dates" qui faussait
    // l'affichage en faisant passer l'historique complet pour la période choisie.)
    console.warn('⚠️ Aucune vente de produit dans cette période.')
    return []
  } catch (error) {
    console.error('❌ Erreur dans getTopProducts:', error)
    return []
  }
}