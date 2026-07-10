// lib/revenue-data.ts
import { dbSelect, dbExecute } from '@/src/lib/db'

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
  isExternal?: boolean
}

export interface AgedReceivable {
  range: string
  amount: number
  color: string
}

// ─── Couleurs pour les modes de paiement ─────────────────────────
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

// ─── Bornes de période en dates locales (YYYY-MM-DD) ─────────────
function getLocalDateRange(period: string): { start: string; end: string } {
  const now = new Date()
  const todayStr = formatLocalDate(now)

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
    case 'quarter':
      startDate = new Date(now)
      startDate.setMonth(startDate.getMonth() - 3)
      break
    case 'year':
      startDate = new Date(now)
      startDate.setFullYear(startDate.getFullYear() - 1)
      break
    default:
      startDate = new Date(now)
      startDate.setMonth(startDate.getMonth() - 1)
  }

  return { start: formatLocalDate(startDate), end: todayStr }
}

function formatLocalDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ─── 1. Résumé des revenus ──────────────────────────────────────
export async function getRevenueSummary(period: string = 'month'): Promise<RevenueSummary> {
  const { start, end } = getLocalDateRange(period)

  // ─── CA HT et TTC (facturé, toutes factures) ──────────────────
  const totals = await dbSelect<{ caHT: number; caTTC: number; nb: number }>(
    `SELECT
       COALESCE(SUM(subtotal), 0) as caHT,
       COALESCE(SUM(total), 0) as caTTC,
       COUNT(*) as nb
     FROM invoices
     WHERE date(created_at) BETWEEN date(?) AND date(?)`,
    [start, end]
  )
  const caHT = totals[0]?.caHT || 0
  const caTTC = totals[0]?.caTTC || 0
  const nbTransactions = totals[0]?.nb || 0

  // ─── Encaissé (transactions INCOME réelles : factures + paiements de dette + revenus externes) ──
  const encaisseResult = await dbSelect<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM transactions
     WHERE type = 'INCOME'
       AND (
         source_type = 'invoice'
         OR (source_type = 'manual' AND category IN ('debt_payment', 'external_revenue'))
       )
       AND date(transaction_date) BETWEEN date(?) AND date(?)`,
    [start, end]
  )
  const encaisse = encaisseResult[0]?.total || 0

  // ─── Créances : solde restant des dettes (via debt_ledger) ──
  const creancesResult = await dbSelect<{ total: number }>(
    `SELECT COALESCE(SUM(remaining_debt), 0) as total
     FROM debt_ledger
     WHERE status IN ('ACTIVE', 'PARTIAL')
       AND date(created_at) BETWEEN date(?) AND date(?)`,
    [start, end]
  )
  const creances = creancesResult[0]?.total || 0

  // ─── Coût d'achat (marge brute) ───────────────────────────────
  const costResult = await dbSelect<{ cost: number }>(
    `SELECT COALESCE(SUM(li.qty * p.cost_price), 0) as cost
     FROM line_items li
     JOIN products p ON li.product_id = p.id
     JOIN invoices i ON li.invoice_id = i.id
     WHERE date(i.created_at) BETWEEN date(?) AND date(?)`,
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
export async function getPaymentMethodDistribution(period: string = 'month'): Promise<PaymentMethodDistribution[]> {
  const { start, end } = getLocalDateRange(period)

  const rows = await dbSelect<{ payment_method: string; total: number }>(
    `SELECT
       COALESCE(i.payment_method, 'cash') as payment_method,
       COALESCE(SUM(t.amount), 0) as total
     FROM transactions t
     JOIN invoices i ON t.source_id = i.id AND t.source_type = 'invoice'
     WHERE t.type = 'INCOME'
       AND date(t.transaction_date) BETWEEN date(?) AND date(?)
     GROUP BY i.payment_method
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

// ─── 3. Top produits par CA ──────────────────────────────────────
export async function getTopProductsByRevenue(period: string = 'month', limit: number = 5): Promise<TopProductRevenue[]> {
  const { start, end } = getLocalDateRange(period)

  const rows = await dbSelect<{ product_name: string; revenue: number; units: number }>(
    `SELECT
       COALESCE(p.name_fr, p.name_ar, p.sku, 'Produit') as product_name,
       COALESCE(SUM(li.subtotal), 0) as revenue,
       COALESCE(SUM(li.qty), 0) as units
     FROM line_items li
     JOIN products p ON li.product_id = p.id
     JOIN invoices i ON li.invoice_id = i.id
     WHERE date(i.created_at) BETWEEN date(?) AND date(?)
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

// ─── 4. Transactions détaillées (factures + revenus externes) ───
export async function getTransactions(
  period: string = 'month',
  filters?: { status?: string; paymentMethod?: string }
): Promise<Transaction[]> {
  const { start, end } = getLocalDateRange(period)

  // ─── 4a. Transactions liées aux factures ───────────────────────
  let invoiceWhere = `date(t.transaction_date) BETWEEN date(?) AND date(?) AND t.type = 'INCOME' AND t.source_type = 'invoice'`
  const invoiceParams: any[] = [start, end]

  if (filters?.status && filters.status !== 'all') {
    invoiceWhere += ` AND i.status = ?`
    invoiceParams.push(filters.status)
  }
  if (filters?.paymentMethod && filters.paymentMethod !== 'all') {
    invoiceWhere += ` AND i.payment_method = ?`
    invoiceParams.push(filters.paymentMethod)
  }

  const invoiceRows = await dbSelect<{
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
       t.transaction_date as date,
       i.invoice_number,
       COALESCE(c.full_name, 'Client de passage') as client_name,
       COALESCE(i.payment_method, 'cash') as payment_method,
       i.status,
       t.amount as amount
     FROM transactions t
     JOIN invoices i ON t.source_id = i.id AND t.source_type = 'invoice'
     LEFT JOIN clients c ON i.client_id = c.id
     WHERE ${invoiceWhere}
     ORDER BY t.transaction_date DESC
     LIMIT 100`,
    invoiceParams
  )

  const invoiceTransactions: Transaction[] = invoiceRows.map((row) => ({
    id: row.id,
    date: row.date.split('T')[0],
    invoiceNumber: row.invoice_number,
    client: row.client_name,
    paymentMethod: row.payment_method,
    status: row.status,
    amount: row.amount,
    isExternal: false,
  }))

  // Le filtre "statut" ne concerne que les factures : un revenu externe
  // est toujours considéré comme encaissé (PAID). Si on filtre sur un
  // autre statut que "all" ou "PAID", on n'affiche pas de revenus externes.
  if (filters?.status && filters.status !== 'all' && filters.status !== 'PAID') {
    return invoiceTransactions
  }

  // ─── 4b. Revenus externes (manuels) ────────────────────────────
  let externalWhere = `date(t.transaction_date) BETWEEN date(?) AND date(?) AND t.type = 'INCOME' AND t.source_type = 'manual' AND t.category = 'external_revenue'`
  const externalParams: any[] = [start, end]

  if (filters?.paymentMethod && filters.paymentMethod !== 'all') {
    externalWhere += ` AND t.payment_method = ?`
    externalParams.push(filters.paymentMethod)
  }

  const externalRows = await dbSelect<{
    id: string
    date: string
    notes: string | null
    payment_method: string
    amount: number
  }>(
    `SELECT t.id, t.transaction_date as date, t.notes, COALESCE(t.payment_method, 'cash') as payment_method, t.amount as amount
     FROM transactions t
     WHERE ${externalWhere}
     ORDER BY t.transaction_date DESC
     LIMIT 100`,
    externalParams
  )

  const externalTransactions: Transaction[] = externalRows.map((row) => ({
    id: row.id,
    date: row.date.split('T')[0],
    invoiceNumber: 'Externe',
    client: row.notes || 'Revenu externe',
    paymentMethod: row.payment_method,
    status: 'PAID',
    amount: row.amount,
    isExternal: true,
  }))

  return [...invoiceTransactions, ...externalTransactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}

// ─── 5. Balance âgée des créances : basée sur l'échéance ────────
const AGED_RANGES = [
  { label: 'Non échue', min: -Infinity, max: -1, color: '#3B82F6' },
  { label: '0-7 jours', min: 0, max: 7, color: '#22C55E' },
  { label: '8-30 jours', min: 8, max: 30, color: '#F59E0B' },
  { label: '31-60 jours', min: 31, max: 60, color: '#F97316' },
  { label: '+60 jours', min: 61, max: Infinity, color: '#EF4444' },
]

export async function getAgedReceivables(period: string = 'month'): Promise<AgedReceivable[]> {
  const { start, end } = getLocalDateRange(period)

  const rows = await dbSelect<{ due_date: string | null; created_at: string; remaining_debt: number }>(
    `SELECT dl.created_at, i.due_date, dl.remaining_debt
     FROM debt_ledger dl
     LEFT JOIN invoices i ON i.id = dl.invoice_id
     WHERE dl.status IN ('ACTIVE', 'PARTIAL')
       AND date(dl.created_at) BETWEEN date(?) AND date(?)`,
    [start, end]
  )

  const now = new Date()
  const result: AgedReceivable[] = AGED_RANGES.map((range) => ({
    range: range.label,
    amount: 0,
    color: range.color,
  }))

  for (const row of rows) {
    const referenceDateStr = row.due_date || row.created_at
    const referenceDate = new Date(referenceDateStr)
    const diffDays = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24))

    for (const range of AGED_RANGES) {
      if (diffDays >= range.min && diffDays <= range.max) {
        const index = AGED_RANGES.indexOf(range)
        result[index].amount += row.remaining_debt
        break
      }
    }
  }

  return result
}

// ─── 6. Ajouter un revenu externe (manuel) ───────────────────────
export interface AddExternalRevenueParams {
  amount: number // en centimes
  paymentMethod: string
  description?: string
  date?: string // ISO string, par défaut maintenant
}

export async function addExternalRevenue(params: AddExternalRevenueParams): Promise<void> {
  const id = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const now = new Date().toISOString()

  // ✅ Utilisation de datetime('now', 'localtime') pour la date locale
  await dbExecute(
    `INSERT INTO transactions (id, type, amount, source_type, source_id, category, notes, payment_method, transaction_date, created_at)
     VALUES (?, 'INCOME', ?, 'manual', NULL, 'external_revenue', ?, ?, datetime('now', 'localtime'), ?)`,
    [id, params.amount, params.description || null, params.paymentMethod, now]
  )
}