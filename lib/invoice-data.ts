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

// Interface Client (ajoutée)
export interface Client {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  address: string | null
  // autres champs selon votre table
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

// ─── Clients (ajoutés) ────────────────────────────────────────────
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

// ─── Mise à jour facture (ajoutée) ───────────────────────────────
export async function updateInvoice(
  id: string,
  data: { clientId?: string | null; status?: string; date?: string }
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

  if (updates.length === 0) return

  updates.push('updated_at = datetime("now")')
  const sql = `UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`
  values.push(id)
  await dbExecute(sql, values)
}