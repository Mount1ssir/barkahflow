import { dbSelect, dbExecute } from '@/src/lib/db'

export interface DebtWithInvoice {
  debtId: string
  contactId: string
  invoiceId: string
  invoiceNumber: string
  totalDebt: number
  remainingDebt: number
  status: string
  createdAt: string
}

/**
 * Récupère toutes les dettes actives (ACTIVE ou PARTIAL) d'un client
 * ✅ Ne retourne que les dettes avec un solde restant > 0
 */
export async function getActiveDebtsByClient(clientId: string): Promise<DebtWithInvoice[]> {
  const rows = await dbSelect<any>(
    `SELECT 
       dl.id as debtId,
       dl.contact_id as contactId,
       dl.invoice_id as invoiceId,
       i.invoice_number as invoiceNumber,
       dl.total_debt as totalDebt,
       dl.remaining_debt as remainingDebt,
       dl.status,
       dl.created_at as createdAt
     FROM debt_ledger dl
     JOIN invoices i ON dl.invoice_id = i.id
     WHERE dl.contact_id = ?
       AND dl.status IN ('ACTIVE', 'PARTIAL')
       AND dl.remaining_debt > 0
     ORDER BY dl.created_at ASC`,
    [clientId]
  )
  return rows.map((row: any) => ({
    debtId: row.debtId,
    contactId: row.contactId,
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoiceNumber,
    totalDebt: row.totalDebt,
    remainingDebt: row.remainingDebt,
    status: row.status,
    createdAt: row.createdAt,
  }))
}

/**
 * Récupère l'historique complet des dettes d'un client
 */
export async function getDebtHistoryByClient(clientId: string): Promise<DebtWithInvoice[]> {
  const rows = await dbSelect<any>(
    `SELECT 
       dl.id as debtId,
       dl.contact_id as contactId,
       dl.invoice_id as invoiceId,
       i.invoice_number as invoiceNumber,
       dl.total_debt as totalDebt,
       dl.remaining_debt as remainingDebt,
       dl.status,
       dl.created_at as createdAt
     FROM debt_ledger dl
     JOIN invoices i ON dl.invoice_id = i.id
     WHERE dl.contact_id = ?
     ORDER BY dl.created_at DESC`,
    [clientId]
  )
  return rows.map((row: any) => ({
    debtId: row.debtId,
    contactId: row.contactId,
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoiceNumber,
    totalDebt: row.totalDebt,
    remainingDebt: row.remainingDebt,
    status: row.status,
    createdAt: row.createdAt,
  }))
}

/**
 * Enregistre un paiement sur une dette (partiel ou total)
 */
export async function recordDebtPayment(
  debtId: string,
  amount: number,
  paymentMethod: string,
  userId?: string | null,
  ipAddress?: string,
  userAgent?: string
): Promise<{ newRemaining: number; status: 'ACTIVE' | 'SETTLED' | 'PARTIAL' }> {
  const debtRows = await dbSelect<any>(
    `SELECT * FROM debt_ledger WHERE id = ?`,
    [debtId]
  )
  if (debtRows.length === 0) throw new Error('Dette introuvable')

  const debt = debtRows[0]
  const currentRemaining = debt.remaining_debt
  const invoiceId = debt.invoice_id

  if (currentRemaining === 0) {
    throw new Error('Cette dette est déjà entièrement réglée')
  }

  if (amount <= 0) {
    throw new Error('Le montant doit être supérieur à 0')
  }

  if (amount > currentRemaining) {
    throw new Error('Le montant payé dépasse le solde restant')
  }

  const newRemaining = currentRemaining - amount
  let newStatus: 'ACTIVE' | 'SETTLED' | 'PARTIAL'
  if (newRemaining === 0) {
    newStatus = 'SETTLED'
  } else if (newRemaining === currentRemaining) {
    newStatus = 'ACTIVE'
  } else {
    newStatus = 'PARTIAL'
  }

  const now = new Date().toISOString()

  await dbExecute(
    `UPDATE debt_ledger 
     SET remaining_debt = ?, status = ?, updated_at = ?
     WHERE id = ?`,
    [newRemaining, newStatus, now, debtId]
  )

  if (newStatus === 'SETTLED' && invoiceId) {
    await dbExecute(
      `UPDATE invoices SET status = 'PAID', updated_at = ? WHERE id = ?`,
      [now, invoiceId]
    )
    await dbExecute(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, after_state, ip_address, user_agent, created_at)
       VALUES (?, ?, 'invoice_paid', 'invoice', ?, ?, ?, ?, ?)`,
      [
        `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId || null,
        invoiceId,
        JSON.stringify({ status: 'PAID' }),
        ipAddress || '0.0.0.0',
        userAgent || '',
        now,
      ]
    )
  }

  await dbExecute(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, after_state, ip_address, user_agent, created_at)
     VALUES (?, ?, 'debt_payment', 'debt_ledger', ?, ?, ?, ?, ?)`,
    [
      `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId || null,
      debtId,
      JSON.stringify({ amount, newRemaining, newStatus }),
      ipAddress || '0.0.0.0',
      userAgent || '',
      now,
    ]
  )

  return { newRemaining, status: newStatus }
}