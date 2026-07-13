/**
 * lib/user-data.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CRUD operations for the local `users` SQLite table.
 *
 * Roles:
 *  - admin   : linked to Supabase (pin_hash = NULL, supabase_uid = <uid>)
 *  - cashier : local-only (pin_hash = SHA-256 of PIN, no Supabase uid)
 *
 * Présence (is_online) :
 *  - Mise à jour de façon EXPLICITE (login réussi → 1, changement de
 *    profil/déconnexion → 0 via markUserOffline), avec un garde-fou basé
 *    sur last_activity au cas où l'app crash sans jamais appeler
 *    markUserOffline (ex: coupure de courant).
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
import { nowLocal, parseFlexibleTimestamp } from '@/lib/datetime'

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
  lastLogin: string | null
  lastActivity: string | null
  isOnline: boolean
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
    lastLogin: row.last_login ?? null,
    lastActivity: row.last_activity ?? null,
    isOnline: row.is_online === 1 || row.is_online === true,
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
    const ts = nowLocal()
    await dbExecute(
      `UPDATE users SET
         name       = ?,
         email      = ?,
         avatar_url = ?,
         updated_at = ?
       WHERE supabase_uid = ?`,
      [
        supabaseUser.user_metadata?.full_name || existing.name,
        supabaseUser.email || existing.email,
        supabaseUser.user_metadata?.avatar_url || existing.avatarUrl,
        ts,
        supabaseUser.id,
      ]
    )
    return (await getUserBySupabaseUid(supabaseUser.id))!
  }

  const id = generateId()
  const ts = nowLocal()
  const adminPinPlaceholder = 'admin_placeholder'

  await dbExecute(
    `INSERT INTO users (id, name, email, phone, role, active, permissions, avatar_url, supabase_uid, pin_hash, failed_pin_attempts, locked_until, last_login, is_online, created_at, updated_at)
     VALUES (?, ?, ?, NULL, 'admin', 1, '[]', ?, ?, ?, 0, NULL, NULL, 0, ?, ?)`,
    [
      id,
      supabaseUser.user_metadata?.full_name || supabaseUser.email || 'Admin',
      supabaseUser.email || null,
      supabaseUser.user_metadata?.avatar_url || null,
      supabaseUser.id,
      adminPinPlaceholder,
      ts,
      ts,
    ]
  )
  return (await getUserById(id))!
}

// ─── Cashier CRUD ─────────────────────────────────────────────────────────────

export interface CreateCashierInput {
  name: string
  pin: string
  email?: string | null
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
  const ts = nowLocal()
  const permissions = input.permissions ?? DEFAULT_CASHIER_PERMISSIONS

  await dbExecute(
    `INSERT INTO users (id, name, email, phone, role, active, permissions, avatar_url, supabase_uid, pin_hash, failed_pin_attempts, locked_until, last_login, is_online, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'cashier', 1, ?, ?, NULL, ?, 0, NULL, NULL, 0, ?, ?)`,
    [
      id,
      input.name.trim(),
      input.email || null,
      input.phone || null,
      JSON.stringify(permissions),
      input.avatarUrl || null,
      pinHash,
      ts,
      ts,
    ]
  )

  return (await getUserById(id))!
}

export interface UpdateCashierInput {
  name?: string
  email?: string | null
  pin?: string | null
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
  if (input.email !== undefined) {
    fields.push('email = ?')
    values.push(input.email || null)
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
    fields.push('failed_pin_attempts = 0')
    fields.push('locked_until = NULL')
  }

  if (fields.length === 0) return current

  const ts = nowLocal()
  fields.push('updated_at = ?')
  values.push(ts)
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

  const ts = nowLocal()
  await dbExecute(
    `UPDATE users SET active = 0, is_online = 0, last_activity = ?, updated_at = ? WHERE id = ?`,
    [ts, ts, id]
  )
}

export async function deleteCashier(id: string): Promise<void> {
  const current = await getUserById(id)
  if (!current) throw new Error('Utilisateur introuvable')
  if (current.role === 'admin') throw new Error('Impossible de supprimer le compte admin')

  await dbExecute(
    `DELETE FROM users WHERE id = ?`,
    [id]
  )
}

export async function updateLastLogin(id: string): Promise<void> {
  const ts = nowLocal()
  await dbExecute(
    `UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?`,
    [ts, ts, id]
  )
}

// ─── PIN verification + lockout ─────────────────────────────────────────────

export async function verifyCashierPin(userId: string, pin: string): Promise<VerifyPinResult> {
  const user = await getUserById(userId)
  if (!user || !user.active || !user.pinHash) {
    return { status: 'invalid', remainingAttempts: 0 }
  }

  if (user.lockedUntil) {
    const lockedUntilMs = parseFlexibleTimestamp(user.lockedUntil)
    const remaining = Math.ceil((lockedUntilMs - Date.now()) / 1000)
    if (remaining > 0) {
      return {
        status: 'locked',
        type: user.failedPinAttempts >= HARD_LOCK_THRESHOLD ? 'hard' : 'soft',
        remainingSeconds: remaining,
      }
    }
  }

  const inputHash = await sha256(pin)

  if (inputHash === user.pinHash) {
    // Connexion réussie : marquage explicite "en ligne", en heure LOCALE
    // pour rester cohérent avec le calcul de présence côté client.
    const ts = nowLocal()
    await dbExecute(
      `UPDATE users SET failed_pin_attempts = 0, locked_until = NULL, last_login = ?, last_activity = ?, is_online = 1, updated_at = ? WHERE id = ?`,
      [ts, ts, ts, userId]
    )
    return { status: 'success', user: { ...user, isOnline: true, lastActivity: ts } }
  }

  const newAttempts = user.failedPinAttempts + 1
  let lockedUntil: string | null = null
  let lockType: 'soft' | 'hard' | null = null
  let emailSent = false

  if (newAttempts >= HARD_LOCK_THRESHOLD) {
    const lockUntilDate = new Date(Date.now() + HARD_LOCK_SECONDS * 1000)
    lockedUntil = nowLocal()
    lockType = 'hard'
    emailSent = await sendCashierUnlockEmail()
  } else if (newAttempts >= SOFT_LOCK_THRESHOLD) {
    const lockUntilDate = new Date(Date.now() + SOFT_LOCK_SECONDS * 1000)
    lockedUntil = nowLocal()
    lockType = 'soft'
  }

  const ts = nowLocal()
  await dbExecute(
    `UPDATE users SET failed_pin_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?`,
    [newAttempts, lockedUntil, ts, userId]
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
 * ⚠️ Appelé par UserContext.setCurrentUser dès qu'on quitte le profil
 * d'un caissier (changement de profil, retour admin, ou déconnexion).
 * C'est ce qui corrige le bug de présence qui restait figée sur "en ligne".
 */
export async function markUserOffline(userId: string): Promise<void> {
  const ts = nowLocal()
  await dbExecute(
    `UPDATE users SET is_online = 0, last_activity = ?, updated_at = ? WHERE id = ?`,
    [ts, ts, userId]
  )
}

export async function markUserOnline(userId: string): Promise<void> {
  const ts = nowLocal()
  await dbExecute(
    `UPDATE users SET is_online = 1, last_activity = ?, updated_at = ? WHERE id = ?`,
    [ts, ts, userId]
  )
}

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

    const ts = nowLocal()
    await dbExecute(
      `UPDATE users SET failed_pin_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?`,
      [ts, userId]
    )

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur lors de la vérification' }
  }
}

export async function getActiveCashiers(): Promise<AppUserRow[]> {
  const rows = await dbSelect<any>(
    `SELECT * FROM users WHERE role = 'cashier' AND active = 1 ORDER BY name ASC`
  )
  return rows.map(mapRow)
}

export async function requestCashierPinResetEmail(): Promise<boolean> {
  return sendCashierUnlockEmail()
}

export async function verifyCashierResetCode(
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

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur lors de la vérification' }
  }
}

export async function changeCashierOwnPin(
  userId: string,
  oldPin: string,
  newPin: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getUserById(userId)
  if (!user || user.role !== 'cashier' || !user.pinHash) {
    return { success: false, error: 'Utilisateur introuvable' }
  }

  const oldHash = await sha256(oldPin)
  if (oldHash !== user.pinHash) {
    return { success: false, error: 'Ancien PIN incorrect' }
  }

  if (!/^\d{4,6}$/.test(newPin)) {
    return { success: false, error: 'Le PIN doit contenir entre 4 et 6 chiffres' }
  }

  const newHash = await sha256(newPin)
  const ts = nowLocal()
  await dbExecute(
    `UPDATE users SET pin_hash = ?, failed_pin_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?`,
    [newHash, ts, userId]
  )

  return { success: true }
}

export async function resetCashierPin(cashierId: string, newPin: string): Promise<{ success: boolean; error?: string }> {
  const user = await getUserById(cashierId)
  if (!user) {
    return { success: false, error: 'Utilisateur introuvable' }
  }
  if (user.role !== 'cashier') {
    return { success: false, error: 'Seul un caissier peut avoir son PIN réinitialisé' }
  }

  if (!/^\d{4,6}$/.test(newPin)) {
    return { success: false, error: 'Le PIN doit contenir entre 4 et 6 chiffres' }
  }

  try {
    const newHash = await sha256(newPin)
    const ts = nowLocal()

    await dbExecute(
      `UPDATE users SET 
         pin_hash = ?, 
         failed_pin_attempts = 0, 
         locked_until = NULL, 
         updated_at = ? 
       WHERE id = ?`,
      [newHash, ts, cashierId]
    )

    return { success: true }
  } catch (error: any) {
    console.error('Erreur réinitialisation PIN:', error)
    return { success: false, error: error?.message || 'Erreur lors de la réinitialisation du PIN' }
  }
}

// ─── PRÉSENCE DES CAISSIERS ───────────────────────────────────────────────────

export type PresenceStatus = 'online' | 'offline'

const STALE_ONLINE_SECONDS = 300 // garde-fou : "en ligne" en DB mais inactif depuis 5min -> hors ligne

export function getPresenceStatus(user: Pick<AppUserRow, 'isOnline' | 'lastActivity'>): PresenceStatus {
  if (!user.isOnline) return 'offline'
  if (!user.lastActivity) return 'offline'
  const diffSeconds = (Date.now() - parseFlexibleTimestamp(user.lastActivity)) / 1000
  if (diffSeconds > STALE_ONLINE_SECONDS) return 'offline'
  return 'online'
}

export function getPresenceColor(status: PresenceStatus): string {
  return status === 'online' ? '#22C55E' : '#6B7280'
}

/** Texte "dernière connexion" — seule info de présence affichée dans la table */
export function getLastConnectionText(user: Pick<AppUserRow, 'isOnline' | 'lastActivity'>): string {
  const status = getPresenceStatus(user)
  if (status === 'online') return 'En ligne maintenant'

  if (!user.lastActivity) return 'Jamais connecté'

  const diffSeconds = Math.floor((Date.now() - parseFlexibleTimestamp(user.lastActivity)) / 1000)
  if (diffSeconds < 60) return "Il y a moins d'1 minute"

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `Il y a ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`

  const diffDays = Math.floor(diffHours / 24)
  return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`
}

export async function updateLastActivity(userId: string): Promise<void> {
  const ts = nowLocal()
  await dbExecute(
    `UPDATE users SET last_activity = ?, updated_at = ? WHERE id = ?`,
    [ts, ts, userId]
  )
}

// ─── CASHIER SETTINGS PERSISTENCE ──────────────────────────────────────────
// Ces fonctions permettent de sauvegarder et récupérer les préférences
// des caissiers (thème, langue, paramètres d'affichage, etc.)
// Les données sont persistées dans la table `cashier_settings`.

import { 
  getCashierSettings as getCashierSettingsFromDb,
  setCashierSetting as setCashierSettingInDb,
  setCashierSettings as setCashierSettingsInDb,
  getCashierSetting as getCashierSettingFromDb,
  deleteCashierSetting as deleteCashierSettingFromDb
} from './cashier-settings'

/**
 * Sauvegarde toutes les préférences d'un caissier
 * @param userId - ID du caissier
 * @param preferences - Objet contenant les paires clé/valeur des préférences
 */
export async function saveCashierPreferences(userId: string, preferences: Record<string, string>): Promise<void> {
  await setCashierSettingsInDb(userId, preferences)
}

/**
 * Récupère toutes les préférences d'un caissier
 * @param userId - ID du caissier
 * @returns Objet contenant les paires clé/valeur des préférences
 */
export async function getCashierPreferences(userId: string): Promise<Record<string, string>> {
  return await getCashierSettingsFromDb(userId)
}

/**
 * Sauvegarde une préférence individuelle d'un caissier
 * @param userId - ID du caissier
 * @param key - Clé de la préférence
 * @param value - Valeur de la préférence
 */
export async function saveCashierPreference(userId: string, key: string, value: string): Promise<void> {
  await setCashierSettingInDb(userId, key, value)
}

/**
 * Récupère une préférence individuelle d'un caissier
 * @param userId - ID du caissier
 * @param key - Clé de la préférence
 * @returns La valeur de la préférence ou null si non trouvée
 */
export async function getCashierPreference(userId: string, key: string): Promise<string | null> {
  return await getCashierSettingFromDb(userId, key)
}

/**
 * Supprime une préférence d'un caissier
 * @param userId - ID du caissier
 * @param key - Clé de la préférence à supprimer
 */
export async function deleteCashierPreference(userId: string, key: string): Promise<void> {
  await deleteCashierSettingFromDb(userId, key)
}

/**
 * Supprime toutes les préférences d'un caissier
 * @param userId - ID du caissier
 */
export async function deleteAllCashierPreferences(userId: string): Promise<void> {
  await dbExecute(
    `DELETE FROM cashier_settings WHERE user_id = ?`,
    [userId]
  )
}