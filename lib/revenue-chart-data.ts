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

const MONTH_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

const MONTH_SHORT = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'
]

function formatDayLabel(date: Date): string {
  const dayName = DAY_LABELS[date.getDay()]
  const dayNumber = date.getDate()
  return `${dayName} ${dayNumber}`
}

// Format semaine : "Sem 1 - Avr" ou "14 Avr"
function formatWeekLabel(date: Date): string {
  const day = date.getDate()
  const month = MONTH_SHORT[date.getMonth()]
  return `${day} ${month}`
}

// Format mois : "Avril 2024"
function formatMonthLabel(date: Date): string {
  return `${MONTH_LABELS[date.getMonth()]}`
}

function toLocalISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

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
  days: number = 7,
  groupBy: 'day' | 'week' | 'month' = 'day'
): Promise<ChartDataPoint[]> {
  try {
    const exists = await tableExists('transactions')
    if (!exists) {
      console.warn('⚠️ Table transactions inexistante, retour de données vides.')
      return generateEmptyData(offset, days, groupBy)
    }

    const today = new Date()
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() - offset)

    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - (days - 1))

    const startISO = toLocalISODate(startDate)
    const endNextDay = new Date(endDate)
    endNextDay.setDate(endNextDay.getDate() + 1)
    const endNextISO = toLocalISODate(endNextDay)

    const transactions = await dbSelectWithRetry<TransactionRow>(
      `SELECT transaction_date, type, amount FROM transactions
       WHERE date(transaction_date, 'localtime') >= date(?)
         AND date(transaction_date, 'localtime') < date(?)
       ORDER BY transaction_date ASC`,
      [startISO, endNextISO],
      3,
      500
    )

    if (groupBy === 'day') {
      // ── Groupement par jour (existant) ─────────────────────────
      const dayMap = new Map<string, { ventes: number; depenses: number }>()
      for (let i = 0; i < days; i++) {
        const day = new Date(startDate)
        day.setDate(day.getDate() + i)
        dayMap.set(toLocalISODate(day), { ventes: 0, depenses: 0 })
      }

      for (const tx of transactions) {
        const isoDate = toLocalISODate(new Date(tx.transaction_date))
        const entry = dayMap.get(isoDate)
        if (entry) {
          if (tx.type === 'INCOME') entry.ventes += tx.amount / 100
          else entry.depenses += tx.amount / 100
        }
      }

      const result: ChartDataPoint[] = []
      for (let i = 0; i < days; i++) {
        const day = new Date(startDate)
        day.setDate(day.getDate() + i)
        const isoDate = toLocalISODate(day)
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

    } else if (groupBy === 'week') {
      // ── Groupement par semaine (4 semaines) ────────────────────
      // On groupe par semaine — chaque point = début de semaine
      const weekMap = new Map<string, { date: Date; ventes: number; depenses: number }>()

      // Créer 4 semaines
      for (let w = 3; w >= 0; w--) {
        const weekStart = new Date(endDate)
        weekStart.setDate(weekStart.getDate() - (w * 7) - 6)
        const key = toLocalISODate(weekStart)
        weekMap.set(key, { date: weekStart, ventes: 0, depenses: 0 })
      }

      const weekKeys = Array.from(weekMap.keys()).sort()

      for (const tx of transactions) {
        const txDate = new Date(tx.transaction_date)
        const txISO = toLocalISODate(txDate)

        // Trouver la semaine à laquelle appartient cette transaction
        let assignedKey = weekKeys[0]
        for (const key of weekKeys) {
          if (txISO >= key) assignedKey = key
          else break
        }

        const entry = weekMap.get(assignedKey)
        if (entry) {
          if (tx.type === 'INCOME') entry.ventes += tx.amount / 100
          else entry.depenses += tx.amount / 100
        }
      }

      return weekKeys.map(key => {
        const entry = weekMap.get(key)!
        return {
          date: formatWeekLabel(entry.date),
          fullDate: key,
          ventes: Math.round(entry.ventes * 100) / 100,
          depenses: Math.round(entry.depenses * 100) / 100,
          solde: Math.round((entry.ventes - entry.depenses) * 100) / 100,
        }
      })

    } else {
      // ── Groupement par mois (3 mois) ───────────────────────────
      const monthMap = new Map<string, { date: Date; ventes: number; depenses: number }>()

      // Créer 3 derniers mois
      for (let m = 2; m >= 0; m--) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() - m, 1)
        const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
        monthMap.set(key, { date: monthDate, ventes: 0, depenses: 0 })
      }

      for (const tx of transactions) {
        const txDate = new Date(tx.transaction_date)
        const key = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`
        const entry = monthMap.get(key)
        if (entry) {
          if (tx.type === 'INCOME') entry.ventes += tx.amount / 100
          else entry.depenses += tx.amount / 100
        }
      }

      return Array.from(monthMap.values()).map(entry => ({
        date: formatMonthLabel(entry.date),
        fullDate: toLocalISODate(entry.date),
        ventes: Math.round(entry.ventes * 100) / 100,
        depenses: Math.round(entry.depenses * 100) / 100,
        solde: Math.round((entry.ventes - entry.depenses) * 100) / 100,
      }))
    }

  } catch (error: any) {
    console.warn('⚠️ Erreur récupération données revenus:', error?.message)
    return generateEmptyData(offset, days, groupBy)
  }
}

function generateEmptyData(offset: number, days: number, groupBy: 'day' | 'week' | 'month'): ChartDataPoint[] {
  const today = new Date()

  if (groupBy === 'month') {
    return [0, 1, 2].map(m => {
      const d = new Date(today.getFullYear(), today.getMonth() - (2 - m), 1)
      return {
        date: formatMonthLabel(d),
        fullDate: toLocalISODate(d),
        ventes: 0, depenses: 0, solde: 0,
      }
    })
  }

  if (groupBy === 'week') {
    return [3, 2, 1, 0].map(w => {
      const d = new Date(today)
      d.setDate(d.getDate() - w * 7)
      return {
        date: formatWeekLabel(d),
        fullDate: toLocalISODate(d),
        ventes: 0, depenses: 0, solde: 0,
      }
    })
  }

  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() - offset)
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - (days - 1))

  return Array.from({ length: days }, (_, i) => {
    const day = new Date(startDate)
    day.setDate(day.getDate() + i)
    return {
      date: formatDayLabel(day),
      fullDate: toLocalISODate(day),
      ventes: 0, depenses: 0, solde: 0,
    }
  })
}