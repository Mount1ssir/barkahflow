import { dbSelect } from '@/src/lib/db'

export interface ChartDataPoint {
  date: string        // format affichage : "Lun 15"
  fullDate: string    // format ISO pour tri : "2026-06-15"
  ventes: number      // en MAD (pas centimes)
  depenses: number    // en MAD
  solde: number       // ventes - depenses
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
 * Récupère les données des `days` derniers jours, avec un décalage optionnel.
 * @param offset Nombre de jours à décaler vers le passé (0 = aujourd'hui)
 * @param days Nombre de jours à inclure (défaut 7)
 */
export async function getRevenueChartData(
  offset: number = 0,
  days: number = 7
): Promise<ChartDataPoint[]> {
  const today = new Date()
  // On décale la période de `offset` jours
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() - offset)

  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - (days - 1)) // on inclut `days` jours

  // Format ISO pour la requête SQL (début de journée)
  const startISO = startDate.toISOString().split('T')[0]
  const endISO = endDate.toISOString().split('T')[0]

  // Récupère toutes les transactions de la période
  const transactions = await dbSelect<TransactionRow>(
    `SELECT transaction_date, type, amount FROM transactions
     WHERE transaction_date >= ? AND transaction_date <= ?
     ORDER BY transaction_date ASC`,
    [startISO, endISO]
  )

  // Initialise le dictionnaire des jours (vide au départ)
  const dayMap = new Map<string, { ventes: number; depenses: number }>()
  for (let i = 0; i < days; i++) {
    const day = new Date(startDate)
    day.setDate(day.getDate() + i)
    const isoDate = toISODate(day)
    dayMap.set(isoDate, { ventes: 0, depenses: 0 })
  }

  // Agrège les transactions par jour
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

  // Construit le tableau final (dans l'ordre chronologique)
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
}