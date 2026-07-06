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
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#84CC16',
  '#06B6D4', '#D946EF', '#6366F1', '#8B5CF6', '#14B8A6',
]

// Bornes en dates locales simples (YYYY-MM-DD) — cohérent avec les autres
// fichiers déjà corrigés. Le filtrage SQL utilise 'localtime' pour convertir
// les timestamps UTC stockés en base vers l'heure locale avant comparaison.
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

export async function getSalesDistribution(
  period: Period = 'month'
): Promise<SalesSlice[]> {
  const { start, end } = getLocalDateRange(period)

  console.log('📊 getSalesDistribution - Période:', { start, end })

  // 1️⃣ Vérifier s'il y a des lignes dans la période
  const countLines = await dbSelect<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM line_items li
     JOIN invoices i ON i.id = li.invoice_id
     WHERE i.status != 'CANCELLED'
       AND date(i.created_at, 'localtime') BETWEEN date(?) AND date(?)`,
    [start, end]
  )
  const nbLines = countLines[0]?.total || 0
  console.log(`📊 Lignes de factures dans la période : ${nbLines}`)

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
      AND date(i.created_at, 'localtime') BETWEEN date(?) AND date(?)
    GROUP BY COALESCE(c.name_fr, 'Sans catégorie')
    ORDER BY total_amount DESC
  `

  try {
    if (nbLines === 0) {
      console.warn('⚠️ Aucune vente dans cette période.')
      return []
    }

    const rows = await dbSelect<any>(sql, [start, end])

    console.log('📦 Résultats distribution :', rows)

    if (!rows || rows.length === 0) {
      return []
    }

    const total = rows.reduce((sum, r) => sum + Number(r.total_amount), 0)
    if (total === 0) return []

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