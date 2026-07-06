import { dbSelect, dbExecute } from '@/src/lib/db'

export interface DebtSummary {
  totalDebt: number
  debtorsCount: number
  averageDebt: number
  oldestDebtDays: number
  recoveredThisMonth: number
}

export interface AgingBucket {
  range: string
  amount: number
  color: string
  percentage: number
}

export interface ClientDebt {
  clientId: string
  clientName: string
  phone: string | null
  email: string | null
  totalDebt: number
  unpaidInvoicesCount: number
  oldestDebtDays: number
  oldestDebtDate: string | null
  daysRange: '0-7' | '8-30' | '31-60' | '60+'
  urgencyColor: string
  creditLimit: number | null
  overLimit: boolean
}

export interface RecentPayment {
  id: string
  clientName: string
  amount: number
  paymentMethod: string
  date: string
  debtId: string
}

export interface DebtTrendPoint {
  date: string
  totalDebt: number
}

export async function getDebtSummary(): Promise<DebtSummary> {
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const firstDayStr = firstDayOfMonth.toISOString().split('T')[0]

  const totalDebtRow = await dbSelect<{ total: number }>(
    `SELECT COALESCE(SUM(remaining_debt), 0) as total
     FROM debt_ledger
     WHERE status IN ('ACTIVE', 'PARTIAL')`
  )
  const totalDebt = totalDebtRow[0]?.total || 0

  const debtorsRow = await dbSelect<{ count: number }>(
    `SELECT COUNT(DISTINCT contact_id) as count
     FROM debt_ledger
     WHERE status IN ('ACTIVE', 'PARTIAL')`
  )
  const debtorsCount = debtorsRow[0]?.count || 0

  const averageDebt = debtorsCount > 0 ? Math.round(totalDebt / debtorsCount) : 0

  // Note : "dette la plus ancienne" reste basée sur la date de création
  // de la dette (created_at), pas sur l'échéance — il s'agit ici de
  // l'ancienneté de la créance, pas de son retard.
  const oldestRow = await dbSelect<{ oldest_date: string | null }>(
    `SELECT MIN(created_at) as oldest_date
     FROM debt_ledger
     WHERE status IN ('ACTIVE', 'PARTIAL')`
  )
  let oldestDebtDays = 0
  if (oldestRow[0]?.oldest_date) {
    const oldestDate = new Date(oldestRow[0].oldest_date)
    const diffTime = now.getTime() - oldestDate.getTime()
    oldestDebtDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  }

  const recoveredRow = await dbSelect<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM transactions
     WHERE source_type = 'manual'
       AND category = 'debt_payment'
       AND transaction_date >= ? AND transaction_date <= ?`,
    [firstDayStr, now.toISOString().split('T')[0]]
  )
  const recoveredThisMonth = recoveredRow[0]?.total || 0

  return { totalDebt, debtorsCount, averageDebt, oldestDebtDays, recoveredThisMonth }
}

// ─── Balance âgée : maintenant basée sur l'échéance (due_date) ────
// Avant : les tranches (0-30j, 31-60j...) étaient calculées depuis
// created_at (date de facturation), ce qui classait une facture à
// 30 jours créée hier comme "urgente" alors qu'elle n'est même pas
// encore due. Maintenant on utilise due_date, avec repli sur
// created_at pour les dettes créées avant l'ajout de ce champ.
export async function getAgingBuckets(): Promise<AgingBucket[]> {
  const rows = await dbSelect<any>(
    `SELECT
       CASE
         WHEN julianday('now') - julianday(COALESCE(i.due_date, dl.created_at)) < 0 THEN 'Non échue'
         WHEN julianday('now') - julianday(COALESCE(i.due_date, dl.created_at)) <= 30 THEN '0-30 jours'
         WHEN julianday('now') - julianday(COALESCE(i.due_date, dl.created_at)) <= 60 THEN '31-60 jours'
         WHEN julianday('now') - julianday(COALESCE(i.due_date, dl.created_at)) <= 90 THEN '61-90 jours'
         ELSE '90+ jours'
       END as range,
       COALESCE(SUM(dl.remaining_debt), 0) as amount
     FROM debt_ledger dl
     LEFT JOIN invoices i ON i.id = dl.invoice_id
     WHERE dl.status IN ('ACTIVE', 'PARTIAL')
     GROUP BY range
     ORDER BY range`
  )

  const colors: Record<string, string> = {
    'Non échue': '#3B82F6',
    '0-30 jours': '#22C55E',
    '31-60 jours': '#F59E0B',
    '61-90 jours': '#EA580C',
    '90+ jours': '#DC2626',
  }

  const total = rows.reduce((sum: number, r: any) => sum + Number(r.amount), 0) || 1
  return rows.map((row: any) => ({
    range: row.range,
    amount: Number(row.amount),
    color: colors[row.range] || '#6B7280',
    percentage: Math.round((Number(row.amount) / total) * 100),
  }))
}

export async function getDebtTrend(days: number = 30): Promise<DebtTrendPoint[]> {
  const rows = await dbSelect<any>(
    `WITH RECURSIVE dates AS (
       SELECT date('now', '-' || ? || ' days') as date
       UNION ALL
       SELECT date(date, '+1 day') FROM dates WHERE date < date('now')
     )
     SELECT
       dates.date,
       COALESCE(SUM(dl.remaining_debt), 0) as total_debt
     FROM dates
     LEFT JOIN debt_ledger dl ON date(dl.created_at) <= dates.date
       AND dl.status IN ('ACTIVE', 'PARTIAL')
     GROUP BY dates.date
     ORDER BY dates.date ASC`,
    [days]
  )

  return rows.map((row: any) => ({
    date: row.date,
    totalDebt: Number(row.total_debt),
  }))
}

// ─── Clients endettés : urgence basée sur l'échéance (due_date) ──
export async function getClientsWithDebt(): Promise<ClientDebt[]> {
  const rows = await dbSelect<any>(
    `SELECT
       c.id as client_id,
       c.full_name as client_name,
       c.phone,
       c.email,
       c.credit_limit,
       COALESCE((
         SELECT SUM(remaining_debt)
         FROM debt_ledger dl
         WHERE dl.contact_id = c.id
           AND dl.status IN ('ACTIVE', 'PARTIAL')
       ), 0) as total_debt,
       MIN(COALESCE(i.due_date, dl.created_at)) as oldest_debt_date,
       COUNT(DISTINCT i2.id) as unpaid_invoices_count
     FROM clients c
     LEFT JOIN debt_ledger dl ON dl.contact_id = c.id AND dl.status IN ('ACTIVE', 'PARTIAL')
     LEFT JOIN invoices i ON i.id = dl.invoice_id
     LEFT JOIN invoices i2 ON i2.client_id = c.id AND i2.status = 'UNPAID'
     WHERE c.id != 'client_walkin'
     GROUP BY c.id
     HAVING total_debt > 0
     ORDER BY total_debt DESC`
  )

  const now = new Date()
  return rows.map((row: any) => {
    const oldestDate = row.oldest_debt_date ? new Date(row.oldest_debt_date) : null
    let days = 0
    if (oldestDate) {
      const diff = now.getTime() - oldestDate.getTime()
      // Une échéance future donne un diff négatif (pas encore due) :
      // on le ramène à 0 plutôt que d'afficher un nombre de jours négatif.
      days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
    }

    let daysRange: '0-7' | '8-30' | '31-60' | '60+'
    let urgencyColor: string
    if (days <= 7) {
      daysRange = '0-7'
      urgencyColor = '#22C55E'
    } else if (days <= 30) {
      daysRange = '8-30'
      urgencyColor = '#F59E0B'
    } else if (days <= 60) {
      daysRange = '31-60'
      urgencyColor = '#EA580C'
    } else {
      daysRange = '60+'
      urgencyColor = '#DC2626'
    }

    const totalDebt = Number(row.total_debt)
    const creditLimit = row.credit_limit ? Number(row.credit_limit) : null
    const overLimit = creditLimit !== null && totalDebt > creditLimit

    return {
      clientId: row.client_id,
      clientName: row.client_name,
      phone: row.phone || null,
      email: row.email || null,
      totalDebt,
      unpaidInvoicesCount: Number(row.unpaid_invoices_count),
      oldestDebtDays: days,
      oldestDebtDate: row.oldest_debt_date,
      daysRange,
      urgencyColor,
      creditLimit,
      overLimit,
    }
  })
}

export async function getRecentDebtPayments(limit: number = 5): Promise<RecentPayment[]> {
  const rows = await dbSelect<any>(
    `SELECT
       t.id,
       c.full_name as client_name,
       t.amount,
       t.payment_method,
       t.transaction_date as date,
       t.source_id as debt_id
     FROM transactions t
     JOIN debt_ledger dl ON dl.id = t.source_id
     JOIN clients c ON c.id = dl.contact_id
     WHERE t.source_type = 'manual'
       AND t.category = 'debt_payment'
     ORDER BY t.transaction_date DESC
     LIMIT ?`,
    [limit]
  )

  return rows.map((row: any) => ({
    id: row.id,
    clientName: row.client_name,
    amount: Number(row.amount),
    paymentMethod: row.payment_method || 'Espèces',
    date: row.date,
    debtId: row.debt_id,
  }))
}

export async function saveReminder(
  clientId: string,
  debtAmount: number,
  message: string,
  channel: 'whatsapp' | 'sms'
): Promise<string> {
  const id = `rem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const now = new Date().toISOString()
  await dbExecute(
    `INSERT INTO reminders_queue (id, client_id, debt_amount, message, channel, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [id, clientId, debtAmount, message, channel, now, now]
  )
  return id
}

export async function updateReminderStatus(id: string, status: string): Promise<void> {
  const now = new Date().toISOString()
  await dbExecute(
    `UPDATE reminders_queue SET status = ?, updated_at = ? WHERE id = ?`,
    [status, now, id]
  )
}