import { dbSelect, dbExecute } from '@/src/lib/db'

// ─── Interfaces ──────────────────────────────────────────────────
export interface Invoice {
  id: string
  invoiceNumber: string
  clientId: string | null
  clientName: string | null
  clientPhone: string | null
  clientEmail: string | null
  clientAddress: string | null
  subtotal: number
  tax: number
  discount: number
  total: number
  status: string
  paymentMethod: string
  dueDate: string | null      // ajout : date limite de paiement
  poNumber: string | null     // ajout : référence commande client
  createdAt: string
  updatedAt: string
}

export interface InvoiceLine {
  id: string
  invoiceId: string
  productId: string
  qty: number
  unitPrice: number
  discount: number
  subtotal: number
  productName?: string
}

export interface Client {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  address: string | null
}

// Nouvelle interface pour le statut de paiement d'une facture
export interface InvoicePaymentInfo {
  paidAmount: number
  remainingAmount: number
}

// ─── Map invoice ──────────────────────────────────────────────────
function mapInvoice(row: any): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    clientId: row.client_id,
    clientName: row.client_name || null,
    clientPhone: row.client_phone || null,
    clientEmail: row.client_email || null,
    clientAddress: row.client_address || null,
    subtotal: row.subtotal,
    tax: row.tax,
    discount: row.discount,
    total: row.total,
    status: row.status,
    paymentMethod: row.payment_method || 'cash',
    dueDate: row.due_date || null,
    poNumber: row.po_number || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── Factures ─────────────────────────────────────────────────────
export async function getAllInvoices(limit?: number): Promise<Invoice[]> {
  const rows = await dbSelect<any>(
    `SELECT i.*, c.full_name as client_name, c.phone as client_phone, c.email as client_email, c.address as client_address
     FROM invoices i
     LEFT JOIN clients c ON c.id = i.client_id
     ORDER BY i.created_at DESC
     ${limit ? `LIMIT ${limit}` : ''}`
  )
  return rows.map(mapInvoice)
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const rows = await dbSelect<any>(
    `SELECT i.*, c.full_name as client_name, c.phone as client_phone, c.email as client_email, c.address as client_address
     FROM invoices i
     LEFT JOIN clients c ON c.id = i.client_id
     WHERE i.id = ?`,
    [id]
  )
  return rows.length > 0 ? mapInvoice(rows[0]) : null
}

export async function getInvoiceLines(invoiceId: string): Promise<InvoiceLine[]> {
  const rows = await dbSelect<any>(
    `SELECT l.*, p.name_ar as product_name
     FROM line_items l
     LEFT JOIN products p ON p.id = l.product_id
     WHERE l.invoice_id = ?
     ORDER BY l.id ASC`,
    [invoiceId]
  )
  return rows.map((row: any) => ({
    id: row.id,
    invoiceId: row.invoice_id,
    productId: row.product_id,
    qty: row.qty,
    unitPrice: row.unit_price,
    discount: row.discount,
    subtotal: row.subtotal,
    productName: row.product_name,
  }))
}

export async function getInvoicesByClient(clientId: string): Promise<Invoice[]> {
  const rows = await dbSelect<any>(
    `SELECT i.*, c.full_name as client_name, c.phone as client_phone, c.email as client_email, c.address as client_address
     FROM invoices i
     LEFT JOIN clients c ON c.id = i.client_id
     WHERE i.client_id = ?
     ORDER BY i.created_at DESC`,
    [clientId]
  )
  return rows.map(mapInvoice)
}

export async function deleteInvoice(invoiceId: string): Promise<void> {
  await dbExecute('DELETE FROM line_items WHERE invoice_id = ?', [invoiceId])
  await dbExecute('DELETE FROM invoices WHERE id = ?', [invoiceId])
}

export async function getPendingDebtTotal(): Promise<number> {
  const rows = await dbSelect<{ total: number }>(
    `SELECT COALESCE(SUM(remaining_debt), 0) as total
     FROM debt_ledger
     WHERE status IN ('ACTIVE', 'PARTIAL')`
  )
  return rows[0]?.total ?? 0
}

// ─── Info de paiement d'une facture (partiel/impayée) ────────────
export async function getInvoicePaymentInfo(
  invoiceId: string,
  invoiceTotal: number
): Promise<InvoicePaymentInfo> {
  const rows = await dbSelect<{ total_debt: number; remaining_debt: number }>(
    `SELECT total_debt, remaining_debt
     FROM debt_ledger
     WHERE invoice_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [invoiceId]
  )

  if (rows.length === 0) {
    return { paidAmount: invoiceTotal, remainingAmount: 0 }
  }

  const remainingAmount = rows[0].remaining_debt
  const paidAmount = invoiceTotal - remainingAmount

  return { paidAmount, remainingAmount }
}

// ─── Clients ────────────────────────────────────────────────────
export async function getAllClients(): Promise<Client[]> {
  const rows = await dbSelect<any>(
    `SELECT id, full_name, phone, email, address
     FROM clients
     ORDER BY full_name`
  )
  return rows.map((row: any) => ({
    id: row.id,
    full_name: row.full_name,
    phone: row.phone || null,
    email: row.email || null,
    address: row.address || null,
  }))
}

// ─── Mise à jour facture ──────────────────────────────────────────
export async function updateInvoice(
  id: string,
  data: { clientId?: string | null; status?: string; date?: string; dueDate?: string | null; poNumber?: string | null }
): Promise<void> {
  const updates: string[] = []
  const values: any[] = []

  if (data.clientId !== undefined) {
    updates.push('client_id = ?')
    values.push(data.clientId)
  }
  if (data.status !== undefined) {
    updates.push('status = ?')
    values.push(data.status)
  }
  if (data.date !== undefined) {
    updates.push('created_at = ?')
    values.push(data.date)
  }
  if (data.dueDate !== undefined) {
    updates.push('due_date = ?')
    values.push(data.dueDate)
  }
  if (data.poNumber !== undefined) {
    updates.push('po_number = ?')
    values.push(data.poNumber)
  }

  if (updates.length === 0) return

  updates.push('updated_at = datetime("now")')
  const sql = `UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`
  values.push(id)
  await dbExecute(sql, values)
}

// ─── Calcul automatique de l'échéance ────────────────────────────
// À utiliser à la création d'une facture : renvoie la date ISO
// obtenue en ajoutant `days` jours à la date de création.
export function calculateDueDate(createdAtIso: string, days: number): string {
  const date = new Date(createdAtIso)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

// ─── Montant en toutes lettres (français, dirhams) ───────────────
const UNITES = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf']
const DIX_A_DIX_NEUF = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt']

function convertGroupUnder1000(n: number): string {
  if (n === 0) return ''
  let result = ''

  const centaines = Math.floor(n / 100)
  const reste = n % 100

  if (centaines > 0) {
    result += (centaines > 1 ? UNITES[centaines] + ' cent' : 'cent') + (centaines > 1 && reste === 0 ? 's' : '')
    if (reste > 0) result += ' '
  }

  if (reste > 0) {
    if (reste < 10) {
      result += UNITES[reste]
    } else if (reste < 20) {
      result += DIX_A_DIX_NEUF[reste - 10]
    } else {
      const dizaine = Math.floor(reste / 10)
      const unite = reste % 10
      if (dizaine === 7 || dizaine === 9) {
        // soixante-dix, quatre-vingt-dix
        result += DIZAINES[dizaine] + '-' + DIX_A_DIX_NEUF[unite]
      } else {
        result += DIZAINES[dizaine] + (unite > 0 ? '-' + UNITES[unite] : (dizaine === 8 ? 's' : ''))
      }
    }
  }

  return result
}

/**
 * Convertit un montant en centimes vers son écriture en toutes lettres,
 * en dirhams marocains. Ex: 3600 (= 36.00 MAD) -> "trente-six dirhams"
 */
export function amountToFrenchWords(amountInCentimes: number): string {
  const dirhams = Math.floor(amountInCentimes / 100)
  const centimes = amountInCentimes % 100

  if (dirhams === 0 && centimes === 0) return 'zéro dirham'

  let result = ''

  if (dirhams === 0) {
    result = ''
  } else if (dirhams === 1) {
    result = 'un dirham'
  } else {
    const millions = Math.floor(dirhams / 1000000)
    const milliers = Math.floor((dirhams % 1000000) / 1000)
    const unites = dirhams % 1000

    const parts: string[] = []
    if (millions > 0) {
      parts.push((millions > 1 ? convertGroupUnder1000(millions) + ' millions' : 'un million'))
    }
    if (milliers > 0) {
      parts.push((milliers > 1 ? convertGroupUnder1000(milliers) + ' mille' : 'mille'))
    }
    if (unites > 0) {
      parts.push(convertGroupUnder1000(unites))
    }
    result = parts.join(' ') + ' dirhams'
  }

  if (centimes > 0) {
    const centimesWords = convertGroupUnder1000(centimes)
    result += (result ? ' et ' : '') + centimesWords + ' centime' + (centimes > 1 ? 's' : '')
  }

  return result.trim()
}