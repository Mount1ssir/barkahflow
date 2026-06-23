import { dbSelect } from '@/src/lib/db'

export interface RecentInvoice {
  id: string
  invoiceNumber: string
  clientName: string
  total: number
  status: 'PAID' | 'PARTIAL' | 'UNPAID'
  createdAt: string
}

interface InvoiceRow {
  id: string
  invoice_number: string
  total: number
  status: 'PAID' | 'PARTIAL' | 'UNPAID'
  created_at: string
  full_name: string | null
}

export async function getRecentInvoices(limit: number = 5): Promise<RecentInvoice[]> {
  const rows = await dbSelect<InvoiceRow>(
    `SELECT
       invoices.id,
       invoices.invoice_number,
       invoices.total,
       invoices.status,
       invoices.created_at,
       clients.full_name
     FROM invoices
     LEFT JOIN clients ON clients.id = invoices.client_id
     ORDER BY invoices.created_at DESC
     LIMIT ?`,
    [limit]
  )

  return rows.map((row) => ({
    id: row.id,
    invoiceNumber: row.invoice_number,
    clientName: row.full_name || 'Client anonyme',
    total: row.total,
    status: row.status,
    createdAt: row.created_at,
  }))
}