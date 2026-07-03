import { dbSelect, dbExecute } from '@/src/lib/db'

export interface Client {
  id: string
  fullName: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  debt: number
  invoiceCount: number
  totalSpent: number        // ✅ total dépensé en centimes (PAID uniquement)
  lastInvoiceDate: string | null  // ✅ date de la dernière facture PAID
  createdAt: string
  updatedAt: string
}

const WALKIN_CLIENT_ID = 'client_walkin'

function isWalkInClient(row: any): boolean {
  if (row.id === WALKIN_CLIENT_ID) return true
  const name = (row.full_name || '').toLowerCase()
  return name.includes('passage') || name.includes('عابر')
}

function mapClient(row: any): Client {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    debt: row.debt || 0,
    invoiceCount: row.invoice_count || 0,
    totalSpent: row.total_spent || 0,
    lastInvoiceDate: row.last_invoice_date || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getAllClients(): Promise<Client[]> {
  const rows = await dbSelect<any>(
    `SELECT c.*,
            COALESCE(SUM(dl.remaining_debt), 0)                          AS debt,
            COUNT(DISTINCT i.id)                                          AS invoice_count,
            COALESCE(SUM(CASE WHEN i.status = 'PAID' THEN i.total ELSE 0 END), 0) AS total_spent,
            MAX(CASE WHEN i.status = 'PAID' THEN i.created_at ELSE NULL END)       AS last_invoice_date
     FROM clients c
     LEFT JOIN debt_ledger dl ON dl.contact_id = c.id AND dl.status = 'ACTIVE'
     LEFT JOIN invoices i ON i.client_id = c.id
     WHERE c.id != ?
     GROUP BY c.id
     ORDER BY c.full_name ASC`,
    [WALKIN_CLIENT_ID]
  )
  return rows.map(mapClient)
}

export async function getClientById(id: string): Promise<Client | null> {
  const rows = await dbSelect<any>(
    `SELECT c.*,
            COALESCE(SUM(dl.remaining_debt), 0)                          AS debt,
            COUNT(DISTINCT i.id)                                          AS invoice_count,
            COALESCE(SUM(CASE WHEN i.status = 'PAID' THEN i.total ELSE 0 END), 0) AS total_spent,
            MAX(CASE WHEN i.status = 'PAID' THEN i.created_at ELSE NULL END)       AS last_invoice_date
     FROM clients c
     LEFT JOIN debt_ledger dl ON dl.contact_id = c.id AND dl.status = 'ACTIVE'
     LEFT JOIN invoices i ON i.client_id = c.id
     WHERE c.id = ? AND c.id != ?
     GROUP BY c.id`,
    [id, WALKIN_CLIENT_ID]
  )
  return rows.length > 0 ? mapClient(rows[0]) : null
}

export async function searchClients(query: string): Promise<Client[]> {
  const q = `%${query.trim()}%`
  const rows = await dbSelect<any>(
    `SELECT c.*,
            COALESCE(SUM(dl.remaining_debt), 0)                          AS debt,
            COUNT(DISTINCT i.id)                                          AS invoice_count,
            COALESCE(SUM(CASE WHEN i.status = 'PAID' THEN i.total ELSE 0 END), 0) AS total_spent,
            MAX(CASE WHEN i.status = 'PAID' THEN i.created_at ELSE NULL END)       AS last_invoice_date
     FROM clients c
     LEFT JOIN debt_ledger dl ON dl.contact_id = c.id AND dl.status = 'ACTIVE'
     LEFT JOIN invoices i ON i.client_id = c.id
     WHERE c.id != ?
       AND (c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)
     GROUP BY c.id
     ORDER BY c.full_name ASC`,
    [WALKIN_CLIENT_ID, q, q, q]
  )
  return rows.map(mapClient)
}

// ─── Création ─────────────────────────────────────────────────────
export async function createClient(
  data: Omit<Client, 'id' | 'debt' | 'invoiceCount' | 'totalSpent' | 'lastInvoiceDate' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id  = `cli_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const now = new Date().toISOString()
  await dbExecute(
    `INSERT INTO clients (id, full_name, phone, email, address, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.fullName, data.phone || null, data.email || null, data.address || null, data.notes || null, now, now]
  )
  return id
}

// ─── Mise à jour ──────────────────────────────────────────────────
export async function updateClient(
  id: string,
  data: Partial<Omit<Client, 'id' | 'debt' | 'invoiceCount' | 'totalSpent' | 'lastInvoiceDate' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const now = new Date().toISOString()
  const updates: string[] = []
  const values: any[]     = []
  const fields = ['fullName', 'phone', 'email', 'address', 'notes']
  for (const field of fields) {
    if (data[field as keyof typeof data] !== undefined) {
      const dbField = field === 'fullName' ? 'full_name' : field
      updates.push(`${dbField} = ?`)
      values.push(data[field as keyof typeof data])
    }
  }
  if (updates.length === 0) return
  values.push(now, id)
  await dbExecute(
    `UPDATE clients SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`,
    values
  )
}

// ─── Suppression ──────────────────────────────────────────────────
export async function deleteClient(id: string): Promise<void> {
  await dbExecute(`DELETE FROM clients WHERE id = ?`, [id])
}