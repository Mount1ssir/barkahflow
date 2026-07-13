/**
 * lib/cashier-settings.ts
 * Persistance des paramètres des caissiers
 */

import { dbSelect, dbExecute } from '@/src/lib/db'
import { nowLocal } from './datetime'

export interface CashierSetting {
  id: string
  userId: string
  key: string
  value: string
  createdAt: string
  updatedAt: string
}

export async function getCashierSetting(userId: string, key: string): Promise<string | null> {
  const rows = await dbSelect<{ value: string }>(
    `SELECT value FROM cashier_settings WHERE user_id = ? AND key = ?`,
    [userId, key]
  )
  return rows.length > 0 ? rows[0].value : null
}

export async function getCashierSettings(userId: string): Promise<Record<string, string>> {
  const rows = await dbSelect<{ key: string; value: string }>(
    `SELECT key, value FROM cashier_settings WHERE user_id = ?`,
    [userId]
  )
  const settings: Record<string, string> = {}
  for (const row of rows) {
    settings[row.key] = row.value
  }
  return settings
}

export async function setCashierSetting(userId: string, key: string, value: string): Promise<void> {
  const existing = await getCashierSetting(userId, key)
  const now = nowLocal()
  const id = `setting_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  if (existing !== null) {
    await dbExecute(
      `UPDATE cashier_settings SET value = ?, updated_at = ? WHERE user_id = ? AND key = ?`,
      [value, now, userId, key]
    )
  } else {
    await dbExecute(
      `INSERT INTO cashier_settings (id, user_id, key, value, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, key, value, now, now]
    )
  }
}

export async function setCashierSettings(userId: string, settings: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    await setCashierSetting(userId, key, value)
  }
}

export async function deleteCashierSetting(userId: string, key: string): Promise<void> {
  await dbExecute(
    `DELETE FROM cashier_settings WHERE user_id = ? AND key = ?`,
    [userId, key]
  )
}

export async function deleteAllCashierSettings(userId: string): Promise<void> {
  await dbExecute(
    `DELETE FROM cashier_settings WHERE user_id = ?`,
    [userId]
  )
}