// lib/transactions.ts
import { dbExecute } from '@/src/lib/db'

export async function recordTransaction(
  type: 'INCOME' | 'EXPENSE',
  amount: number,
  sourceType: 'invoice' | 'manual',
  sourceId: string,
  category?: string,
  notes?: string,
  paymentMethod?: string
): Promise<void> {
  const id = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const now = new Date().toISOString()

  // ✅ Utilisation de datetime('now', 'localtime') pour la date locale de la machine
  await dbExecute(
    `INSERT INTO transactions 
     (id, type, amount, source_type, source_id, category, notes, payment_method, transaction_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), ?)`,
    [
      id,
      type,
      amount,
      sourceType,
      sourceId,
      category || null,
      notes || null,
      paymentMethod || null,
      now,
    ]
  )
}