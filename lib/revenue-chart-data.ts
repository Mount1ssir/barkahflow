import { dbSelect } from '@/src/lib/db'

export interface ChartDataPoint {
  date: string        // format affichage : "Lun 15"
  fullDate: string     // format ISO pour tri : "2026-06-15"
  ventes: number        // en MAD (pas centimes, pour affichage direct)
  depenses: number      // en MAD
  solde: number          // ventes - depenses
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
  return date.toISOString().split('T')[0] // "2026-06-15"
}

// Récupère les données des 7 derniers jours pour le graphique
export async function getRevenueChartData(): Promise<ChartDataPoint[]> {
  const today = new Date()
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6) // 7 jours incluant aujourd'hui

  const startDate = new Date(
    sevenDaysAgo.getFullYear(),
    sevenDaysAgo.getMonth(),
    sevenDaysAgo.getDate()
  ).toISOString()

  // Récupère toutes les transactions des 7 derniers jours
  const transactions = await dbSelect<TransactionRow>(
    `SELECT transaction_date, type, amount FROM transactions
     WHERE transaction_date >= ?
     ORDER BY transaction_date ASC`,
    [startDate]
  )

  // Initialise les 7 jours avec des valeurs à zéro
  const dayMap = new Map<string, { ventes: number; depenses: number }>()

  for (let i = 0; i < 7; i++) {
    const day = new Date(sevenDaysAgo)
    day.setDate(day.getDate() + i)
    const isoDate = toISODate(day)
    dayMap.set(isoDate, { ventes: 0, depenses: 0 })
  }

  // Additionne les transactions réelles dans le bon jour
  for (const tx of transactions) {
    const isoDate = tx.transaction_date.split('T')[0]
    const entry = dayMap.get(isoDate)
    if (entry) {
      if (tx.type === 'INCOME') {
        entry.ventes += tx.amount / 100 // centimes → MAD
      } else {
        entry.depenses += tx.amount / 100
      }
    }
  }

  // Transforme en tableau final pour le graphique
  const result: ChartDataPoint[] = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(sevenDaysAgo)
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
}