/**
 * lib/user-data.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CRUD operations for the local `users` SQLite table.
 *
 * Roles:
 *  - admin   : linked to Supabase (pin_hash = NULL, supabase_uid = <uid>)
 *  - cashier : local-only (pin_hash = SHA-256 of PIN, no Supabase uid)
 *
 * PIN lockout (cashiers only):
 *  - 3 failed attempts  → soft lock, 30 seconds
 *  - 5 failed attempts  → hard lock, 5 minutes, AND a temp code is emailed
 *                          to the boutique's admin address (reuses the same
 *                          Supabase edge functions as the admin's own PIN
 *                          reset flow). Entering that code just clears the
 *                          lock — it does not change the cashier's PIN.
 */

import { dbSelect, dbExecute } from '@/src/lib/db'
import { supabase } from '@/src/lib/supabase'
import { DEFAULT_CASHIER_PERMISSIONS, type Permission } from '@/lib/rbac'

// ─── Lockout tuning ─────────────────────────────────────────────────────────

const SOFT_LOCK_THRESHOLD = 3
const SOFT_LOCK_SECONDS = 30
const HARD_LOCK_THRESHOLD = 5
const HARD_LOCK_SECONDS = 5 * 60

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
  failedPinAttempts: number
  lockedUntil: string | null
  createdAt: string
  updatedAt: string
}

export type VerifyPinResult =
  | { status: 'success'; user: AppUserRow }
  | { status: 'invalid'; remainingAttempts: number }
  | { status: 'locked'; type: 'soft' | 'hard'; remainingSeconds: number; emailSent?: boolean }

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
    failedPinAttempts: row.failed_pin_attempts ?? 0,
    lockedUntil: row.locked_until ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Sends a temp unlock code to the boutique's admin email, via the same
 * edge function used by the admin's own "PIN oublié" flow. Requires an
 * active Supabase session on this device — which there always is, since
 * the admin's OAuth session persists regardless of which local profile
 * (admin or cashier) is currently active in the UI.
 *
 * Returns true if the email call was made without throwing (best-effort —
 * failure here should never block the lockout itself).
 */
async function sendCashierUnlockEmail(): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) return false

    const { error } = await supabase.functions.invoke('generate-temp-pin', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return !error
  } catch {
    return false
  }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

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
    `INSERT INTO users (id, name, email, phone, role, active, permissions, avatar_url, supabase_uid, pin_hash, failed_pin_attempts, locked_until, created_at, updated_at)
     VALUES (?, ?, ?, NULL, 'admin', 1, '[]', ?, ?, NULL, 0, NULL, ?, ?)`,
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
    `INSERT INTO users (id, name, email, phone, role, active, permissions, avatar_url, supabase_uid, pin_hash, failed_pin_attempts, locked_until, created_at, updated_at)
     VALUES (?, ?, NULL, ?, 'cashier', 1, ?, ?, NULL, ?, 0, NULL, ?, ?)`,
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
    // Changing the PIN also clears any active lockout
    fields.push('failed_pin_attempts = 0')
    fields.push('locked_until = NULL')
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

// ─── PIN verification + lockout (per-user, DB-backed) ─────────────────────────

/**
 * Verifies a cashier's PIN. Handles the full lockout lifecycle:
 *  - checks for an existing lock before even looking at the PIN
 *  - on failure, increments the counter and applies the appropriate tier
 *  - on success, resets the counter
 */
export async function verifyCashierPin(userId: string, pin: string): Promise<VerifyPinResult> {
  const user = await getUserById(userId)
  if (!user || !user.active || !user.pinHash) {
    return { status: 'invalid', remainingAttempts: 0 }
  }

  // Already locked?
  if (user.lockedUntil) {
    const lockedUntilMs = new Date(user.lockedUntil).getTime()
    const remaining = Math.ceil((lockedUntilMs - Date.now()) / 1000)
    if (remaining > 0) {
      return {
        status: 'locked',
        type: user.failedPinAttempts >= HARD_LOCK_THRESHOLD ? 'hard' : 'soft',
        remainingSeconds: remaining,
      }
    }
    // Lock expired naturally — fall through and let this attempt count fresh
  }

  const inputHash = await sha256(pin)

  if (inputHash === user.pinHash) {
    await dbExecute(
      `UPDATE users SET failed_pin_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?`,
      [userId]
    )
    return { status: 'success', user }
  }

  // Wrong PIN — increment and apply tier
  const newAttempts = user.failedPinAttempts + 1
  let lockedUntil: string | null = null
  let lockType: 'soft' | 'hard' | null = null
  let emailSent = false

  if (newAttempts >= HARD_LOCK_THRESHOLD) {
    lockedUntil = new Date(Date.now() + HARD_LOCK_SECONDS * 1000).toISOString()
    lockType = 'hard'
    emailSent = await sendCashierUnlockEmail()
  } else if (newAttempts >= SOFT_LOCK_THRESHOLD) {
    lockedUntil = new Date(Date.now() + SOFT_LOCK_SECONDS * 1000).toISOString()
    lockType = 'soft'
  }

  await dbExecute(
    `UPDATE users SET failed_pin_attempts = ?, locked_until = ?, updated_at = datetime('now') WHERE id = ?`,
    [newAttempts, lockedUntil, userId]
  )

  if (lockType) {
    return {
      status: 'locked',
      type: lockType,
      remainingSeconds: lockType === 'hard' ? HARD_LOCK_SECONDS : SOFT_LOCK_SECONDS,
      emailSent,
    }
  }

  return {
    status: 'invalid',
    remainingAttempts: SOFT_LOCK_THRESHOLD - newAttempts,
  }
}

/**
 * Verifies the temp code the admin received by email and, if valid,
 * clears the lockout on the given cashier so they can retry their own PIN.
 * Does NOT change the cashier's pin_hash.
 */
export async function unlockCashierWithEmailCode(
  userId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) {
      return { success: false, error: 'Session administrateur expirée' }
    }

    const { data, error } = await supabase.functions.invoke('verify-temp-pin', {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { pin: code },
    })

    if (error || !data?.valid) {
      return { success: false, error: data?.error || 'Code incorrect' }
    }

    const user = await getUserById(userId)
    if (!user) return { success: false, error: 'Utilisateur introuvable' }

    await dbExecute(
      `UPDATE users SET failed_pin_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?`,
      [userId]
    )

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur lors de la vérification' }
  }
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