import { dbSelect } from '@/src/lib/db'

export interface RevenueSummary {
  caHT: number
  caTTC: number
  encaisse: number
  creances: number
  margeBrute: number
  panierMoyen: number
  nbTransactions: number
}

export interface PaymentMethodDistribution {
  name: string
  value: number
  color: string
}

export interface TopProductRevenue {
  name: string
  revenue: number // HT
  units: number
}

export interface Transaction {
  id: string
  date: string
  invoiceNumber: string
  client: string
  paymentMethod: string
  status: string
  amount: number // TTC
}

export interface AgedReceivable {
  range: string // "0-7 jours", "8-30 jours", "31-60 jours", "+60 jours"
  amount: number
  color: string
}

// ─── Helpers UTC ──────────────────────────────────────────────────

function getDateRangeUTC(period: string): { start: string; end: string } {
  const now = new Date()
  // Aujourd'hui en UTC (date sans heure)
  const todayStr = now.toISOString().split('T')[0]
  const todayStart = `${todayStr}T00:00:00.000Z`
  const tomorrowStart = new Date(now)
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1)
  const tomorrowStr = tomorrowStart.toISOString().split('T')[0]
  const tomorrowStartStr = `${tomorrowStr}T00:00:00.000Z`

  let start: string
  let end: string

  switch (period) {
    case 'today':
      start = todayStart
      end = tomorrowStartStr
      break
    case 'week': {
      const weekAgo = new Date(now)
      weekAgo.setUTCDate(weekAgo.getUTCDate() - 6)
      const weekAgoStr = weekAgo.toISOString().split('T')[0]
      start = `${weekAgoStr}T00:00:00.000Z`
      end = tomorrowStartStr
      break
    }
    case 'month': {
      const monthAgo = new Date(now)
      monthAgo.setUTCMonth(monthAgo.getUTCMonth() - 1)
      const monthAgoStr = monthAgo.toISOString().split('T')[0]
      start = `${monthAgoStr}T00:00:00.000Z`
      end = tomorrowStartStr
      break
    }
    case 'quarter': {
      const quarterAgo = new Date(now)
      quarterAgo.setUTCMonth(quarterAgo.getUTCMonth() - 3)
      const quarterAgoStr = quarterAgo.toISOString().split('T')[0]
      start = `${quarterAgoStr}T00:00:00.000Z`
      end = tomorrowStartStr
      break
    }
    case 'year': {
      const yearAgo = new Date(now)
      yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1)
      const yearAgoStr = yearAgo.toISOString().split('T')[0]
      start = `${yearAgoStr}T00:00:00.000Z`
      end = tomorrowStartStr
      break
    }
    default: {
      // 'month' par défaut
      const monthAgo = new Date(now)
      monthAgo.setUTCMonth(monthAgo.getUTCMonth() - 1)
      const monthAgoStr = monthAgo.toISOString().split('T')[0]
      start = `${monthAgoStr}T00:00:00.000Z`
      end = tomorrowStartStr
    }
  }

  return { start, end }
}

// ─── 1. Résumé des revenus ──────────────────────────────────────

export async function getRevenueSummary(period: string = 'month'): Promise<RevenueSummary> {
  const { start, end } = getDateRangeUTC(period)

  // CA HT (subtotal) et TTC (total)
  const totals = await dbSelect<{ caHT: number; caTTC: number; nb: number }>(
    `SELECT
       COALESCE(SUM(subtotal), 0) as caHT,
       COALESCE(SUM(total), 0) as caTTC,
       COUNT(*) as nb
     FROM invoices
     WHERE created_at >= ? AND created_at < ?`,
    [start, end]
  )
  const caHT = totals[0]?.caHT || 0
  const caTTC = totals[0]?.caTTC || 0
  const nbTransactions = totals[0]?.nb || 0

  // Encaissé (PAID + PARTIAL)
  const encaisseResult = await dbSelect<{ total: number }>(
    `SELECT COALESCE(SUM(total), 0) as total
     FROM invoices
     WHERE status IN ('PAID', 'PARTIAL')
       AND created_at >= ? AND created_at < ?`,
    [start, end]
  )
  const encaisse = encaisseResult[0]?.total || 0

  // Créances (UNPAID)
  const creancesResult = await dbSelect<{ total: number }>(
    `SELECT COALESCE(SUM(total), 0) as total
     FROM invoices
     WHERE status = 'UNPAID'
       AND created_at >= ? AND created_at < ?`,
    [start, end]
  )
  const creances = creancesResult[0]?.total || 0

  // Coût d'achat
  const costResult = await dbSelect<{ cost: number }>(
    `SELECT COALESCE(SUM(li.qty * p.cost_price), 0) as cost
     FROM line_items li
     JOIN products p ON li.product_id = p.id
     JOIN invoices i ON li.invoice_id = i.id
     WHERE i.created_at >= ? AND i.created_at < ?`,
    [start, end]
  )
  const cost = costResult[0]?.cost || 0

  const margeBrute = caHT - cost
  const panierMoyen = nbTransactions > 0 ? caTTC / nbTransactions : 0

  return {
    caHT,
    caTTC,
    encaisse,
    creances,
    margeBrute,
    panierMoyen,
    nbTransactions,
  }
}

// ─── 2. Répartition par mode de paiement ─────────────────────────

const PAYMENT_COLORS: Record<string, string> = {
  cash: '#22C55E',
  card: '#3B82F6',
  mobile: '#8B5CF6',
  mixed: '#F59E0B',
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces',
  card: 'TPE',
  mobile: 'Mobile',
  mixed: 'Mixte',
}

export async function getPaymentMethodDistribution(period: string = 'month'): Promise<PaymentMethodDistribution[]> {
  const { start, end } = getDateRangeUTC(period)

  const rows = await dbSelect<{ payment_method: string; total: number }>(
    `SELECT
       COALESCE(payment_method, 'cash') as payment_method,
       COALESCE(SUM(total), 0) as total
     FROM invoices
     WHERE created_at >= ? AND created_at < ?
       AND status IN ('PAID', 'PARTIAL')
     GROUP BY payment_method
     ORDER BY total DESC`,
    [start, end]
  )

  if (rows.length === 0) {
    return Object.keys(PAYMENT_LABELS).map((key) => ({
      name: PAYMENT_LABELS[key],
      value: 0,
      color: PAYMENT_COLORS[key],
    }))
  }

  return rows.map((row) => ({
    name: PAYMENT_LABELS[row.payment_method] || row.payment_method,
    value: row.total,
    color: PAYMENT_COLORS[row.payment_method] || '#6B7280',
  }))
}

// ─── 3. Top produits par chiffre d'affaires (HT) ────────────────

export async function getTopProductsByRevenue(period: string = 'month', limit: number = 5): Promise<TopProductRevenue[]> {
  const { start, end } = getDateRangeUTC(period)

  const rows = await dbSelect<{ product_name: string; revenue: number; units: number }>(
    `SELECT
       COALESCE(p.name_fr, p.name_ar, p.sku, 'Produit') as product_name,
       COALESCE(SUM(li.subtotal), 0) as revenue,
       COALESCE(SUM(li.qty), 0) as units
     FROM line_items li
     JOIN products p ON li.product_id = p.id
     JOIN invoices i ON li.invoice_id = i.id
     WHERE i.created_at >= ? AND i.created_at < ?
       AND i.status IN ('PAID', 'PARTIAL', 'CONFIRMED')
     GROUP BY li.product_id
     ORDER BY revenue DESC
     LIMIT ?`,
    [start, end, limit]
  )

  return rows.map((row) => ({
    name: row.product_name,
    revenue: row.revenue,
    units: Number(row.units),
  }))
}

// ─── 4. Transactions détaillées ──────────────────────────────────

export async function getTransactions(
  period: string = 'month',
  filters?: { status?: string; paymentMethod?: string }
): Promise<Transaction[]> {
  const { start, end } = getDateRangeUTC(period)

  let whereClause = `i.created_at >= ? AND i.created_at < ?`
  const params: any[] = [start, end]

  if (filters?.status && filters.status !== 'all') {
    whereClause += ` AND i.status = ?`
    params.push(filters.status)
  }
  if (filters?.paymentMethod && filters.paymentMethod !== 'all') {
    whereClause += ` AND i.payment_method = ?`
    params.push(filters.paymentMethod)
  }

  const rows = await dbSelect<{
    id: string
    date: string
    invoice_number: string
    client_name: string
    payment_method: string
    status: string
    amount: number
  }>(
    `SELECT
       i.id,
       i.created_at as date,
       i.invoice_number,
       COALESCE(c.full_name, 'Client de passage') as client_name,
       COALESCE(i.payment_method, 'cash') as payment_method,
       i.status,
       i.total as amount
     FROM invoices i
     LEFT JOIN clients c ON i.client_id = c.id
     WHERE ${whereClause}
     ORDER BY i.created_at DESC
     LIMIT 100`,
    params
  )

  return rows.map((row) => ({
    id: row.id,
    date: row.date.split('T')[0],
    invoiceNumber: row.invoice_number,
    client: row.client_name,
    paymentMethod: row.payment_method,
    status: row.status,
    amount: row.amount,
  }))
}

// ─── 5. Balance âgée des créances ───────────────────────────────

const AGED_RANGES = [
  { label: '0-7 jours', min: 0, max: 7, color: '#22C55E' },
  { label: '8-30 jours', min: 8, max: 30, color: '#F59E0B' },
  { label: '31-60 jours', min: 31, max: 60, color: '#F97316' },
  { label: '+60 jours', min: 61, max: Infinity, color: '#EF4444' },
]

export async function getAgedReceivables(period: string = 'month'): Promise<AgedReceivable[]> {
  const { start, end } = getDateRangeUTC(period)

  // Récupérer les factures impayées de la période
  const rows = await dbSelect<{ created_at: string; total: number }>(
    `SELECT created_at, total
     FROM invoices
     WHERE status = 'UNPAID'
       AND created_at >= ? AND created_at < ?`,
    [start, end]
  )

  const now = new Date()
  const result: AgedReceivable[] = AGED_RANGES.map((range) => ({
    range: range.label,
    amount: 0,
    color: range.color,
  }))

  for (const row of rows) {
    const invoiceDate = new Date(row.created_at)
    const diffDays = Math.floor((now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24))

    for (const range of AGED_RANGES) {
      if (diffDays >= range.min && diffDays <= range.max) {
        const index = AGED_RANGES.indexOf(range)
        result[index].amount += row.total
        break
      }
    }
  }

  return result
}