// lib/invoice-number.ts
import { dbSelect, dbExecute } from '@/src/lib/db'
import { nowLocal } from './datetime'

export async function generateInvoiceNumber(prefix = 'INV'): Promise<string> {
  const year = new Date().getFullYear().toString()
  const id = `${prefix}-${year}`

  try {
    // Vérifier si la table existe
    const tables = await dbSelect<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name = 'sequence_numbers'`
    )
    
    if (tables.length === 0) {
      // Créer la table si elle n'existe pas
      await dbExecute(`
        CREATE TABLE IF NOT EXISTS sequence_numbers (
          id TEXT PRIMARY KEY,
          prefix TEXT NOT NULL,
          last_number INTEGER NOT NULL DEFAULT 0,
          year TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `)
    }

    const now = nowLocal()

    // Essayer d'insérer ou mettre à jour avec RETURNING
    try {
      const rows = await dbSelect<{ last_number: number }>(
        `INSERT INTO sequence_numbers (id, prefix, last_number, year, created_at, updated_at)
         VALUES (?, ?, 1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET 
           last_number = last_number + 1,
           updated_at = ?
         RETURNING last_number`,
        [id, prefix, year, now, now, now]
      )

      const nextNumber = rows[0].last_number
      return `${prefix}-${year}-${String(nextNumber).padStart(6, '0')}`
    } catch {
      // RETURNING non supporté ou erreur, utiliser méthode alternative
      
      // 1. Vérifier si l'enregistrement existe
      let existing = await dbSelect<{ last_number: number }>(
        `SELECT last_number FROM sequence_numbers WHERE id = ?`,
        [id]
      )
      
      let nextNumber: number
      
      if (existing.length > 0) {
        // Mettre à jour
        nextNumber = existing[0].last_number + 1
        await dbExecute(
          `UPDATE sequence_numbers SET last_number = ?, updated_at = ? WHERE id = ?`,
          [nextNumber, now, id]
        )
      } else {
        // Insérer
        nextNumber = 1
        await dbExecute(
          `INSERT INTO sequence_numbers (id, prefix, last_number, year, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, prefix, nextNumber, year, now, now]
        )
      }
      
      return `${prefix}-${year}-${String(nextNumber).padStart(6, '0')}`
    }
  } catch (error) {
    console.error('Erreur generateInvoiceNumber:', error)
    // Fallback: utiliser timestamp
    const timestamp = Date.now().toString().slice(-6)
    return `${prefix}-${year}-${timestamp}`
  }
}

// Réinitialiser le compteur pour une année donnée
export async function resetInvoiceCounter(prefix: string, year: string): Promise<void> {
  const id = `${prefix}-${year}`
  const now = nowLocal()
  await dbExecute(
    `INSERT OR REPLACE INTO sequence_numbers (id, prefix, last_number, year, created_at, updated_at)
     VALUES (?, ?, 0, ?, ?, ?)`,
    [id, prefix, year, now, now]
  )
}

// Obtenir la valeur actuelle du compteur
export async function getCurrentInvoiceCounter(prefix: string, year: string): Promise<number> {
  const id = `${prefix}-${year}`
  try {
    const rows = await dbSelect<{ last_number: number }>(
      `SELECT last_number FROM sequence_numbers WHERE id = ?`,
      [id]
    )
    return rows.length > 0 ? rows[0].last_number : 0
  } catch {
    return 0
  }
}