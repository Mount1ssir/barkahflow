import { dbSelect } from '@/src/lib/db'

export interface DashboardStats {
  todayRevenue: number          // Chiffre du jour (en centimes)
  todayRevenueChange: number    // % vs hier
  unpaidInvoicesCount: number   // Nombre de factures impayées
  unpaidInvoicesAmount: number  // Montant total impayé (centimes)
  lowStockCount: number         // Nombre de produits en stock bas
  activeDebtsAmount: number     // Total des dettes actives (centimes)
}

interface RevenueRow {
  total: number | null
}

interface CountRow {
  count: number
}

interface AmountRow {
  total: number | null
}

function getTodayDateRange() {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfDay)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)

  return {
    todayStart: startOfDay.toISOString(),
    yesterdayStart: startOfYesterday.toISOString(),
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { todayStart, yesterdayStart } = getTodayDateRange()

  // 1. Chiffre du jour (transactions INCOME créées aujourd'hui)
  const todayResult = await dbSelect<RevenueRow>(
    `SELECT SUM(amount) as total FROM transactions
     WHERE type = 'INCOME' AND transaction_date >= ?`,
    [todayStart]
  )
  const todayRevenue = todayResult[0]?.total || 0

  // 2. Chiffre d'hier (pour calculer le pourcentage de variation)
  const yesterdayResult = await dbSelect<RevenueRow>(
    `SELECT SUM(amount) as total FROM transactions
     WHERE type = 'INCOME' AND transaction_date >= ? AND transaction_date < ?`,
    [yesterdayStart, todayStart]
  )
  const yesterdayRevenue = yesterdayResult[0]?.total || 0

  let todayRevenueChange = 0
  if (yesterdayRevenue > 0) {
    todayRevenueChange = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
  } else if (todayRevenue > 0) {
    todayRevenueChange = 100
  }

  // 3. Factures impayées (UNPAID + PARTIAL)
  const unpaidCountResult = await dbSelect<CountRow>(
    `SELECT COUNT(*) as count FROM invoices
     WHERE status IN ('UNPAID', 'PARTIAL')`
  )
  const unpaidInvoicesCount = unpaidCountResult[0]?.count || 0

  const unpaidAmountResult = await dbSelect<AmountRow>(
    `SELECT SUM(total) as total FROM invoices
     WHERE status IN ('UNPAID', 'PARTIAL')`
  )
  const unpaidInvoicesAmount = unpaidAmountResult[0]?.total || 0

  // 4. Produits en stock bas
  const lowStockResult = await dbSelect<CountRow>(
    `SELECT COUNT(*) as count FROM products
     WHERE stock_qty <= alert_threshold`
  )
  const lowStockCount = lowStockResult[0]?.count || 0

  // 5. Dettes actives (RECEIVABLE non soldées)
  const debtsResult = await dbSelect<AmountRow>(
    `SELECT SUM(remaining_debt) as total FROM debt_ledger
     WHERE type = 'RECEIVABLE' AND status != 'SETTLED'`
  )
  const activeDebtsAmount = debtsResult[0]?.total || 0

  return {
    todayRevenue,
    todayRevenueChange,
    unpaidInvoicesCount,
    unpaidInvoicesAmount,
    lowStockCount,
    activeDebtsAmount,
  }
}

// Formate un montant en centimes vers un affichage MAD
export function formatMAD(centimes: number): string {
  return (centimes / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' MAD'
}