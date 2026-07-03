import { dbExecute, dbSelect } from '@/src/lib/db'

export async function generateInvoiceNumber(prefix = 'INV'): Promise<string> {
  const year = new Date().getFullYear().toString()
  const sequenceId = `${prefix}-${year}`

  let rows = await dbSelect<{ last_number: number }>(
    `SELECT last_number FROM sequence_numbers WHERE id = ?`,
    [sequenceId]
  )

  if (rows.length === 0) {
    await dbExecute(
      `INSERT INTO sequence_numbers (id, prefix, last_number, year) VALUES (?, ?, 0, ?)`,
      [sequenceId, prefix, year]
    )
    rows = [{ last_number: 0 }]
  }

  const nextNumber = rows[0].last_number + 1

  await dbExecute(
    `UPDATE sequence_numbers SET last_number = ? WHERE id = ?`,
    [nextNumber, sequenceId]
  )

  return `${prefix}-${year}-${String(nextNumber).padStart(6, '0')}`
}