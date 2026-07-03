import { dbSelect } from '@/src/lib/db'

export interface SalesSlice {
  name: string
  value: number
  amount: number
  color: string
}

type Period = 'today' | 'week' | 'month'

const categoryColors: Record<string, string> = {
  'Épicerie': '#38BDF8',
  'Produits laitiers': '#F59E0B',
  'Boulangerie': '#10B981',
  'Boissons': '#8B5CF6',
  'Fruits & Légumes': '#EC4899',
  'Viandes': '#EF4444',
  'Poissons': '#3B82F6',
  'Autre': '#6B7280',
}

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
  period: Period = 'week'
): Promise<SalesSlice[]> {
  const { start, end } = getDateRange(period)

  try {
    const rows = await dbSelect<any>(
      `SELECT
         c.name_fr as name,
         c.color as color,
         SUM(li.subtotal) as total_amount
       FROM line_items li
       JOIN products p ON p.id = li.product_id
       JOIN categories c ON c.id = p.category_id
       JOIN invoices i ON i.id = li.invoice_id
       WHERE i.status IN ('PAID', 'PARTIAL', 'CONFIRMED')
         AND i.created_at >= ? AND i.created_at <= ?
         AND c.name_fr IS NOT NULL
         AND c.name_fr != ''
       GROUP BY p.category_id
       ORDER BY total_amount DESC
       LIMIT 5`,
      [start, end]
    )

    const total = rows.reduce((sum, r) => sum + Number(r.total_amount), 0)
    if (total === 0) return []

    return rows.map((row: any) => {
      const name = row.name || 'Autre'
      return {
        name,
        color: row.color || categoryColors[name] || '#6B7280',
        value: Math.round((Number(row.total_amount) / total) * 100),
        amount: Number(row.total_amount),
      }
    })
  } catch (error) {
    console.error('Erreur getSalesDistribution:', error)
    return []
  }
}