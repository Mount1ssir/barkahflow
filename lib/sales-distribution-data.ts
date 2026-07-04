import { dbSelect } from '@/src/lib/db'

export interface SalesSlice {
  name: string
  value: number
  amount: number
  color: string
}

type Period = 'today' | 'week' | 'month'

// Couleurs par défaut pour les catégories connues
const categoryColors: Record<string, string> = {
  'Épicerie': '#38BDF8',
  'Produits laitiers': '#F59E0B',
  'Boulangerie': '#10B981',
  'Boissons': '#8B5CF6',
  'Fruits & Légumes': '#EC4899',
  'Viandes': '#EF4444',
  'Poissons': '#3B82F6',
  'Sans catégorie': '#6B7280',
  'Autre': '#6B7280',
}

// Couleurs de secours pour les catégories non répertoriées
const fallbackColors = [
  '#8B5CF6', // violet
  '#EC4899', // rose
  '#14B8A6', // turquoise
  '#F97316', // orange
  '#84CC16', // vert clair
  '#06B6D4', // cyan
  '#D946EF', // magenta
  '#6366F1', // indigo
  '#8B5CF6',
  '#14B8A6',
]

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

export async function getSalesDistribution(
  period: Period = 'month'
): Promise<SalesSlice[]> {
  const { start, end } = getDateRange(period)

  console.log('📊 getSalesDistribution - Période:', { start, end })

  // 1️⃣ Vérifier s'il y a des lignes dans la période
  const countLines = await dbSelect<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM line_items li
     JOIN invoices i ON i.id = li.invoice_id
     WHERE i.status != 'CANCELLED'
       AND i.created_at >= ? AND i.created_at <= ?`,
    [start, end]
  )
  const nbLines = countLines[0]?.total || 0
  console.log(`📊 Lignes de factures dans la période : ${nbLines}`)

  // Requête sans LIMIT (toutes les catégories)
  const sql = `
    SELECT
      COALESCE(c.name_fr, 'Sans catégorie') as category_name,
      COALESCE(c.color, '#6B7280') as color,
      SUM(li.subtotal) as total_amount
    FROM line_items li
    JOIN invoices i ON i.id = li.invoice_id
    JOIN products p ON p.id = li.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE i.status != 'CANCELLED'
      AND i.created_at >= ? AND i.created_at <= ?
    GROUP BY COALESCE(c.name_fr, 'Sans catégorie')
    ORDER BY total_amount DESC
  `

  const fallbackSql = `
    SELECT
      COALESCE(c.name_fr, 'Sans catégorie') as category_name,
      COALESCE(c.color, '#6B7280') as color,
      SUM(li.subtotal) as total_amount
    FROM line_items li
    JOIN invoices i ON i.id = li.invoice_id
    JOIN products p ON p.id = li.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE i.status != 'CANCELLED'
    GROUP BY COALESCE(c.name_fr, 'Sans catégorie')
    ORDER BY total_amount DESC
  `

  try {
    let rows: any[]
    if (nbLines === 0) {
      console.warn('⚠️ Aucune ligne dans la période. Utilisation du fallback (toutes dates).')
      rows = await dbSelect<any>(fallbackSql)
    } else {
      rows = await dbSelect<any>(sql, [start, end])
    }

    console.log('📦 Résultats distribution (sans limite) :', rows)

    if (!rows || rows.length === 0) {
      return []
    }

    const total = rows.reduce((sum, r) => sum + Number(r.total_amount), 0)
    if (total === 0) return []

    // Assigner une couleur pour chaque catégorie
    let colorIndex = 0
    return rows.map((row: any) => {
      let name = row.category_name || 'Sans catégorie'
      let color = row.color || categoryColors[name] || fallbackColors[colorIndex % fallbackColors.length]
      colorIndex++
      return {
        name,
        color,
        value: Math.round((Number(row.total_amount) / total) * 100),
        amount: Number(row.total_amount),
      }
    })
  } catch (error) {
    console.error('❌ Erreur getSalesDistribution:', error)
    return []
  }
}