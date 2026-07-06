import { dbSelect } from '@/src/lib/db'

export async function generateInvoiceNumber(prefix = 'INV'): Promise<string> {
  const year = new Date().getFullYear().toString()
  const sequenceId = `${prefix}-${year}`

  const rows = await dbSelect<{ last_number: number }>(
    `INSERT INTO sequence_numbers (id, prefix, last_number, year)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(id) DO UPDATE SET last_number = last_number + 1
     RETURNING last_number`,
    [sequenceId, prefix, year]
  )

  const nextNumber = rows[0].last_number

  return `${prefix}-${year}-${String(nextNumber).padStart(6, '0')}`
}