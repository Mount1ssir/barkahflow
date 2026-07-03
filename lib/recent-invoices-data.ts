import { dbSelectWithRetry } from '@/src/lib/db'

export interface RecentInvoice {
  id: string
  invoiceNumber: string
  clientId: string | null
  clientName: string | null
  total: number
  status: string
  createdAt: string
}

export async function getRecentInvoices(limit: number = 5): Promise<RecentInvoice[]> {
  const rows = await dbSelectWithRetry<any>(
    `SELECT i.id, i.invoice_number, i.client_id, c.full_name as clientName,
            i.total, i.status, i.created_at
     FROM invoices i
     LEFT JOIN clients c ON c.id = i.client_id
     WHERE i.status = 'PAID'
     ORDER BY i.created_at DESC
     LIMIT ?`,
    [limit]
  )

  return rows.map((row: any) => ({
    id: row.id,
    invoiceNumber: row.invoice_number,
    clientId: row.client_id,
    clientName: row.clientName,
    total: row.total,
    status: row.status,
    createdAt: row.created_at,
  }))
}