import { dbSelectWithRetry } from '@/src/lib/db'

export interface ChartDataPoint {
  date: string
  fullDate: string
  ventes: number
  depenses: number
  solde: number
}

interface TransactionRow {
  transaction_date: string
  type: 'INCOME' | 'EXPENSE'
  amount: number
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

function formatDayLabel(date: Date): string {
  const dayName = DAY_LABELS[date.getDay()]
  const dayNumber = date.getDate()
  return `${dayName} ${dayNumber}`
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Vérifie si la table existe (avec retry)
 */
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const rows = await dbSelectWithRetry<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
      [tableName],
      3,
      500
    )
    return rows.length > 0
  } catch {
    return false
  }
}

export async function getRevenueChartData(
  offset: number = 0,
  days: number = 7
): Promise<ChartDataPoint[]> {
  try {
    const exists = await tableExists('transactions')
    if (!exists) {
      console.warn('⚠️ Table transactions inexistante, retour de données vides.')
      return generateEmptyData(offset, days)
    }

    const today = new Date()
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() - offset)

    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - (days - 1))

    const startISO = startDate.toISOString().split('T')[0]
    const endNextDay = new Date(endDate)
    endNextDay.setDate(endNextDay.getDate() + 1)
    const endNextISO = endNextDay.toISOString().split('T')[0]

    const transactions = await dbSelectWithRetry<TransactionRow>(
      `SELECT transaction_date, type, amount FROM transactions
       WHERE transaction_date >= ? AND transaction_date < ?
       ORDER BY transaction_date ASC`,
      [startISO, endNextISO],
      3,
      500
    )

    const dayMap = new Map<string, { ventes: number; depenses: number }>()
    for (let i = 0; i < days; i++) {
      const day = new Date(startDate)
      day.setDate(day.getDate() + i)
      const isoDate = toISODate(day)
      dayMap.set(isoDate, { ventes: 0, depenses: 0 })
    }

    for (const tx of transactions) {
      const isoDate = tx.transaction_date.split('T')[0]
      const entry = dayMap.get(isoDate)
      if (entry) {
        if (tx.type === 'INCOME') {
          entry.ventes += tx.amount / 100
        } else {
          entry.depenses += tx.amount / 100
        }
      }
    }

    const result: ChartDataPoint[] = []
    for (let i = 0; i < days; i++) {
      const day = new Date(startDate)
      day.setDate(day.getDate() + i)
      const isoDate = toISODate(day)
      const entry = dayMap.get(isoDate)!

      result.push({
        date: formatDayLabel(day),
        fullDate: isoDate,
        ventes: Math.round(entry.ventes * 100) / 100,
        depenses: Math.round(entry.depenses * 100) / 100,
        solde: Math.round((entry.ventes - entry.depenses) * 100) / 100,
      })
    }

    return result
  } catch (error: any) {
    console.warn('⚠️ Erreur récupération données revenus:', error?.message)
    return generateEmptyData(offset, days)
  }
}

function generateEmptyData(offset: number, days: number): ChartDataPoint[] {
  const today = new Date()
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() - offset)
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - (days - 1))

  const result: ChartDataPoint[] = []
  for (let i = 0; i < days; i++) {
    const day = new Date(startDate)
    day.setDate(day.getDate() + i)
    result.push({
      date: formatDayLabel(day),
      fullDate: toISODate(day),
      ventes: 0,
      depenses: 0,
      solde: 0,
    })
  }
  return result
}