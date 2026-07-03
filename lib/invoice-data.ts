import { dbSelect, dbExecute } from '@/src/lib/db'

export interface Invoice {
  id: string
  invoiceNumber: string
  clientId: string | null
  clientName: string | null
  clientPhone: string | null   // ✅ nouveau
  clientEmail: string | null   // ✅ nouveau
  clientAddress: string | null // ✅ nouveau
  subtotal: number
  tax: number
  discount: number
  total: number
  status: string
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
}

function mapInvoice(row: any): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    clientId: row.client_id,
    clientName: row.client_name || null,
    clientPhone: row.client_phone || null,    // ✅
    clientEmail: row.client_email || null,    // ✅
    clientAddress: row.client_address || null, // ✅
    subtotal: row.subtotal,
    tax: row.tax,
    discount: row.discount,
    total: row.total,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

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

export async function getInvoiceStatusCounts(): Promise<{ status: string; count: number }[]> {
  const rows = await dbSelect<any>(
    `SELECT status, COUNT(*) as count FROM invoices GROUP BY status`
  )
  return rows.map((row: any) => ({ status: row.status, count: row.count }))
}

// ─── Clients ──────────────────────────────────────────────────────
export async function getAllClients(): Promise<Client[]> {
  const rows = await dbSelect<any>(
    `SELECT id, full_name, phone FROM clients ORDER BY full_name ASC`
  )
  return rows.map((row: any) => ({
    id: row.id,
    full_name: row.full_name,
    phone: row.phone,
  }))
}

// ─── Mise à jour ──────────────────────────────────────────────────
export async function updateInvoice(
  id: string,
  data: {
    clientId: string | null
    status: string
    date: string
  }
): Promise<void> {
  const now = new Date().toISOString()
  await dbExecute(
    `UPDATE invoices SET
       client_id = ?,
       status = ?,
       created_at = ?,
       updated_at = ?
     WHERE id = ?`,
    [data.clientId || null, data.status, data.date, now, id]
  )
}

// ─── Suppression ──────────────────────────────────────────────────
export async function deleteInvoice(id: string): Promise<void> {
  await dbExecute(`DELETE FROM line_items WHERE invoice_id = ?`, [id])
  await dbExecute(`DELETE FROM invoices WHERE id = ?`, [id])
}