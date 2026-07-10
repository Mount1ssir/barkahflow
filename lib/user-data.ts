/**
 * lib/user-data.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CRUD operations for the local `users` SQLite table.
 *
 * Roles:
 *  - admin   : linked to Supabase (pin_hash = NULL, supabase_uid = <uid>)
 *  - cashier : local-only (pin_hash = SHA-256 of PIN, no Supabase uid)
 */

import { dbSelect, dbExecute } from '@/src/lib/db'
import { DEFAULT_CASHIER_PERMISSIONS, type Permission } from '@/lib/rbac'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AppUserRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: 'admin' | 'cashier'
  active: boolean
  permissions: Permission[]
  avatarUrl: string | null
  supabaseUid: string | null
  pinHash: string | null
  createdAt: string
  updatedAt: string
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function generateId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

async function sha256(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function mapRow(row: any): AppUserRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? null,
    phone: row.phone ?? null,
    role: row.role ?? 'cashier',
    active: row.active === 1 || row.active === true,
    permissions: (() => {
      try {
        return JSON.parse(row.permissions || '[]') as Permission[]
      } catch {
        return []
      }
    })(),
    avatarUrl: row.avatar_url ?? null,
    supabaseUid: row.supabase_uid ?? null,
    pinHash: row.pin_hash ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Returns all users, ordered admin first then active cashiers, then inactive.
 */
export async function getAllUsers(): Promise<AppUserRow[]> {
  const rows = await dbSelect<any>(
    `SELECT * FROM users ORDER BY
       CASE role WHEN 'admin' THEN 0 ELSE 1 END,
       active DESC,
       name ASC`
  )
  return rows.map(mapRow)
}

export async function getUserById(id: string): Promise<AppUserRow | null> {
  const rows = await dbSelect<any>(`SELECT * FROM users WHERE id = ?`, [id])
  return rows.length > 0 ? mapRow(rows[0]) : null
}

export async function getUserBySupabaseUid(uid: string): Promise<AppUserRow | null> {
  const rows = await dbSelect<any>(`SELECT * FROM users WHERE supabase_uid = ?`, [uid])
  return rows.length > 0 ? mapRow(rows[0]) : null
}

// ─── Admin bootstrap ─────────────────────────────────────────────────────────

/**
 * Ensures an admin row exists in the local `users` table for the given
 * Supabase session user. Safe to call on every login — only inserts if missing.
 */
export async function upsertAdminFromSupabase(supabaseUser: {
  id: string
  email?: string
  user_metadata?: { full_name?: string; avatar_url?: string }
}): Promise<AppUserRow> {
  const existing = await getUserBySupabaseUid(supabaseUser.id)
  if (existing) {
    // Update name / avatar in case they changed in Google
    await dbExecute(
      `UPDATE users SET
         name       = ?,
         email      = ?,
         avatar_url = ?,
         updated_at = datetime('now')
       WHERE supabase_uid = ?`,
      [
        supabaseUser.user_metadata?.full_name || existing.name,
        supabaseUser.email || existing.email,
        supabaseUser.user_metadata?.avatar_url || existing.avatarUrl,
        supabaseUser.id,
      ]
    )
    return (await getUserBySupabaseUid(supabaseUser.id))!
  }

  const id = generateId()
  const now = new Date().toISOString()
  await dbExecute(
    `INSERT INTO users (id, name, email, phone, role, active, permissions, avatar_url, supabase_uid, pin_hash, created_at, updated_at)
     VALUES (?, ?, ?, NULL, 'admin', 1, '[]', ?, ?, NULL, ?, ?)`,
    [
      id,
      supabaseUser.user_metadata?.full_name || supabaseUser.email || 'Admin',
      supabaseUser.email || null,
      supabaseUser.user_metadata?.avatar_url || null,
      supabaseUser.id,
      now,
      now,
    ]
  )
  return (await getUserById(id))!
}

// ─── Cashier CRUD ─────────────────────────────────────────────────────────────

export interface CreateCashierInput {
  name: string
  pin: string                        // plain-text, will be hashed
  phone?: string | null
  avatarUrl?: string | null
  permissions?: Permission[]
}

export async function createCashier(input: CreateCashierInput): Promise<AppUserRow> {
  if (!/^\d{4,6}$/.test(input.pin)) {
    throw new Error('Le PIN doit contenir entre 4 et 6 chiffres')
  }
  if (!input.name.trim()) {
    throw new Error('Le nom est requis')
  }

  const pinHash = await sha256(input.pin)
  const id = generateId()
  const now = new Date().toISOString()
  const permissions = input.permissions ?? DEFAULT_CASHIER_PERMISSIONS

  await dbExecute(
    `INSERT INTO users (id, name, email, phone, role, active, permissions, avatar_url, supabase_uid, pin_hash, created_at, updated_at)
     VALUES (?, ?, NULL, ?, 'cashier', 1, ?, ?, NULL, ?, ?, ?)`,
    [
      id,
      input.name.trim(),
      input.phone || null,
      JSON.stringify(permissions),
      input.avatarUrl || null,
      pinHash,
      now,
      now,
    ]
  )

  return (await getUserById(id))!
}

export interface UpdateCashierInput {
  name?: string
  pin?: string | null                // if provided, update the PIN
  phone?: string | null
  avatarUrl?: string | null
  permissions?: Permission[]
  active?: boolean
}

export async function updateCashier(id: string, input: UpdateCashierInput): Promise<AppUserRow> {
  const current = await getUserById(id)
  if (!current) throw new Error('Utilisateur introuvable')
  if (current.role === 'admin') throw new Error('Impossible de modifier le compte admin via cette fonction')

  const fields: string[] = []
  const values: any[] = []

  if (input.name !== undefined) {
    if (!input.name.trim()) throw new Error('Le nom est requis')
    fields.push('name = ?')
    values.push(input.name.trim())
  }
  if (input.phone !== undefined) {
    fields.push('phone = ?')
    values.push(input.phone || null)
  }
  if (input.avatarUrl !== undefined) {
    fields.push('avatar_url = ?')
    values.push(input.avatarUrl || null)
  }
  if (input.permissions !== undefined) {
    fields.push('permissions = ?')
    values.push(JSON.stringify(input.permissions))
  }
  if (input.active !== undefined) {
    fields.push('active = ?')
    values.push(input.active ? 1 : 0)
  }
  if (input.pin) {
    if (!/^\d{4,6}$/.test(input.pin)) throw new Error('Le PIN doit contenir entre 4 et 6 chiffres')
    const pinHash = await sha256(input.pin)
    fields.push('pin_hash = ?')
    values.push(pinHash)
  }

  if (fields.length === 0) return current

  fields.push("updated_at = datetime('now')")
  values.push(id)

  await dbExecute(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
    values
  )
  return (await getUserById(id))!
}

export async function deactivateCashier(id: string): Promise<void> {
  const current = await getUserById(id)
  if (!current) throw new Error('Utilisateur introuvable')
  if (current.role === 'admin') throw new Error('Impossible de désactiver le compte admin')

  await dbExecute(
    `UPDATE users SET active = 0, updated_at = datetime('now') WHERE id = ?`,
    [id]
  )
}

// ─── PIN verification (per-user, DB-backed) ───────────────────────────────────

/**
 * Verifies a cashier's PIN against their stored hash in the database.
 * Returns the full user row on success, null on failure.
 */
export async function verifyCashierPin(userId: string, pin: string): Promise<AppUserRow | null> {
  const user = await getUserById(userId)
  if (!user || !user.pinHash || !user.active) return null

  const inputHash = await sha256(pin)
  if (inputHash !== user.pinHash) return null

  return user
}

/**
 * Returns all active cashiers (for the user-switch screen).
 */
export async function getActiveCashiers(): Promise<AppUserRow[]> {
  const rows = await dbSelect<any>(
    `SELECT * FROM users WHERE role = 'cashier' AND active = 1 ORDER BY name ASC`
  )
  return rows.map(mapRow)
}
