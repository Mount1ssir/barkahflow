import { dbExecute } from '@/src/lib/db'

/**
 * Enregistre une transaction financière (entrée ou sortie)
 */
export async function recordTransaction(
  type: 'INCOME' | 'EXPENSE',
  amount: number,
  sourceType: 'invoice' | 'manual' | 'debt_payment',
  sourceId: string,
  category?: string,
  notes?: string
): Promise<void> {
  const id = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const now = new Date().toISOString()

  await dbExecute(
    `INSERT INTO transactions (id, type, amount, source_type, source_id, category, notes, transaction_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, type, amount, sourceType, sourceId, category || null, notes || null, now, now]
  )
}