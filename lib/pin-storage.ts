// lib/pin-storage.ts

const PIN_HASH_KEY = 'barkahflow_pin_hash'
const PIN_LOCK_ENABLED_KEY = 'barkahflow_pin_lock_enabled'
const PIN_ATTEMPTS_KEY = 'barkahflow_pin_attempts'
const PIN_LOCKED_UNTIL_KEY = 'barkahflow_pin_locked_until'
const BIOMETRIC_ENABLED_KEY = 'barkahflow_biometric_enabled'
const REMEMBERED_USER_KEY = 'barkahflow_remembered_user'
const PIN_LENGTH_KEY = 'barkahflow_pin_length'
const INACTIVITY_TIMEOUT_KEY = 'barkahflow_inactivity_timeout'

// ═══════════════════════════════════════════════════════════════════════
// ADMIN PIN - Utilise le même stockage que le PIN de la page de profil
// Le PIN défini dans "Mon profil" est le PIN admin
// ═══════════════════════════════════════════════════════════════════════

// Clés pour le PIN admin (même stockage que setPinCode)
const ADMIN_PIN_ATTEMPTS_KEY = 'barkahflow_admin_pin_attempts'
const ADMIN_PIN_LOCKED_UNTIL_KEY = 'barkahflow_admin_pin_locked_until'

const ADMIN_MAX_ATTEMPTS = 5
const ADMIN_LOCKOUT_MS = 5 * 60 * 1000 // 5 minutes
const MAX_ATTEMPTS = 5
const LOCKOUT_WARNING_MS = 30 * 1000      // 30 secondes
const LOCKOUT_FINAL_MS = 5 * 60 * 1000    // 5 minutes
const DEFAULT_INACTIVITY_SECONDS = 30

// ─── Hash SHA-256 ──────────────────────────────────────────────────
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ─── ADMIN PIN : vérification ──────────────────────────────────────────

/**
 * Vérifie le PIN administrateur.
 * Utilise le même hash que setPinCode() (page de profil).
 * Incrémente les tentatives si incorrect.
 * Retourne true si le PIN est correct, false sinon.
 */
export async function verifyAdminPin(userId: string, pin: string): Promise<boolean> {
  if (isAdminLockedOut()) return false

  const storedHash = localStorage.getItem(PIN_HASH_KEY)
  if (!storedHash) {
    console.log('🔐 Aucun PIN admin défini')
    return false
  }

  const inputHash = await hashPin(pin)
  const isCorrect = inputHash === storedHash

  if (isCorrect) {
    resetAdminAttempts()
  } else {
    incrementAdminAttempts()
  }

  return isCorrect
}

/**
 * Vérifie si le PIN admin est bloqué (trop de tentatives).
 */
function isAdminLockedOut(): boolean {
  if (typeof window === 'undefined') return false
  const lockedUntil = localStorage.getItem(ADMIN_PIN_LOCKED_UNTIL_KEY)
  if (!lockedUntil) return false
  const stillLocked = Date.now() < parseInt(lockedUntil, 10)
  if (!stillLocked) resetAdminAttempts()
  return stillLocked
}

function getAdminAttempts(): number {
  if (typeof window === 'undefined') return 0
  return parseInt(localStorage.getItem(ADMIN_PIN_ATTEMPTS_KEY) || '0', 10)
}

function incrementAdminAttempts(): void {
  const attempts = getAdminAttempts() + 1
  localStorage.setItem(ADMIN_PIN_ATTEMPTS_KEY, String(attempts))

  if (attempts >= ADMIN_MAX_ATTEMPTS) {
    const lockedUntil = Date.now() + ADMIN_LOCKOUT_MS
    localStorage.setItem(ADMIN_PIN_LOCKED_UNTIL_KEY, String(lockedUntil))
  }
}

function resetAdminAttempts(): void {
  localStorage.removeItem(ADMIN_PIN_ATTEMPTS_KEY)
  localStorage.removeItem(ADMIN_PIN_LOCKED_UNTIL_KEY)
}

/**
 * Récupère le temps restant de blocage du PIN admin (en secondes).
 */
export function getAdminLockoutRemainingSeconds(): number {
  if (typeof window === 'undefined') return 0
  const lockedUntil = localStorage.getItem(ADMIN_PIN_LOCKED_UNTIL_KEY)
  if (!lockedUntil) return 0
  const remaining = parseInt(lockedUntil, 10) - Date.now()
  return Math.max(0, Math.ceil(remaining / 1000))
}

/**
 * Vérifie si un PIN admin a été défini.
 * = hasPinDefined() car c'est le même stockage.
 */
export function hasAdminPinDefined(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem(PIN_HASH_KEY)
}

// ═══════════════════════════════════════════════════════════════════════
// PIN ADMIN - Fonctions pour PinLockScreen (verrouillage de l'app)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Vérifie le PIN pour le verrouillage de l'application (admin).
 * Utilisé par PinLockScreen.
 */
export async function verifyPinCode(pin: string): Promise<boolean> {
  if (isLockedOut()) return false

  const storedHash = localStorage.getItem(PIN_HASH_KEY)
  if (!storedHash) return false

  const inputHash = await hashPin(pin)
  const isCorrect = inputHash === storedHash

  if (isCorrect) {
    resetAttempts()
    resetAdminAttempts()
  } else {
    incrementAttempts()
    incrementAdminAttempts()
  }

  return isCorrect
}

/**
 * Indique si un code PIN a été défini (admin uniquement).
 */
export function hasPinDefined(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem(PIN_HASH_KEY)
}

/**
 * Crée ou change le code PIN (utilisé par l'admin dans la page de profil).
 */
export async function setPinCode(pin: string): Promise<void> {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error('Le PIN doit contenir entre 4 et 6 chiffres')
  }
  const hash = await hashPin(pin)
  localStorage.setItem(PIN_HASH_KEY, hash)
  localStorage.setItem(PIN_LENGTH_KEY, String(pin.length))
  resetAttempts()
  resetAdminAttempts()
}

/**
 * Vérifie qu'un PIN correspond au hash stocké, SANS incrémenter le
 * compteur de tentatives ni déclencher de blocage.
 */
export async function checkPinMatches(pin: string): Promise<boolean> {
  const storedHash = localStorage.getItem(PIN_HASH_KEY)
  if (!storedHash) return false
  const inputHash = await hashPin(pin)
  return inputHash === storedHash
}

/**
 * Suppression complète du PIN.
 */
export function disablePin(): void {
  localStorage.removeItem(PIN_HASH_KEY)
  localStorage.removeItem(PIN_LOCK_ENABLED_KEY)
  localStorage.removeItem(BIOMETRIC_ENABLED_KEY)
  localStorage.removeItem(PIN_LENGTH_KEY)
  resetAttempts()
  resetAdminAttempts()
}

export function getPinLength(): number {
  if (typeof window === 'undefined') return 6
  const length = localStorage.getItem(PIN_LENGTH_KEY)
  if (length) {
    const parsed = parseInt(length, 10)
    if (parsed >= 4 && parsed <= 6) return parsed
  }
  return 6
}

// ─── Verrouillage : ON/OFF ──────────────────────────────────────
export function isPinEnabled(): boolean {
  if (typeof window === 'undefined') return false
  if (!hasPinDefined()) return false
  const stored = localStorage.getItem(PIN_LOCK_ENABLED_KEY)
  if (stored === null) return true
  return stored === 'true'
}

export function setPinLockEnabled(enabled: boolean): void {
  if (enabled && !hasPinDefined()) {
    throw new Error("Aucun code PIN défini. Définissez-le d'abord dans votre profil.")
  }
  localStorage.setItem(PIN_LOCK_ENABLED_KEY, enabled ? 'true' : 'false')
  if (!enabled) {
    resetAttempts()
    resetAdminAttempts()
  }
}

// ─── Gestion des tentatives (PIN admin - verrouillage) ──────────
function getAttempts(): number {
  if (typeof window === 'undefined') return 0
  return parseInt(localStorage.getItem(PIN_ATTEMPTS_KEY) || '0', 10)
}

function incrementAttempts(): void {
  const attempts = getAttempts() + 1
  localStorage.setItem(PIN_ATTEMPTS_KEY, String(attempts))

  let lockoutDuration = 0
  if (attempts >= MAX_ATTEMPTS) {
    lockoutDuration = LOCKOUT_FINAL_MS
  } else if (attempts >= 3) {
    lockoutDuration = LOCKOUT_WARNING_MS
  }

  if (lockoutDuration > 0) {
    const lockedUntil = Date.now() + lockoutDuration
    localStorage.setItem(PIN_LOCKED_UNTIL_KEY, String(lockedUntil))
  }
}

function resetAttempts(): void {
  localStorage.removeItem(PIN_ATTEMPTS_KEY)
  localStorage.removeItem(PIN_LOCKED_UNTIL_KEY)
}

export function getRemainingAttempts(): number {
  return Math.max(0, MAX_ATTEMPTS - getAttempts())
}

export function isLockedOut(): boolean {
  if (typeof window === 'undefined') return false
  const lockedUntil = localStorage.getItem(PIN_LOCKED_UNTIL_KEY)
  if (!lockedUntil) return false
  const stillLocked = Date.now() < parseInt(lockedUntil, 10)
  if (!stillLocked) resetAttempts()
  return stillLocked
}

export function getLockoutRemainingSeconds(): number {
  if (typeof window === 'undefined') return 0
  const lockedUntil = localStorage.getItem(PIN_LOCKED_UNTIL_KEY)
  if (!lockedUntil) return 0
  const remaining = parseInt(lockedUntil, 10) - Date.now()
  return Math.max(0, Math.ceil(remaining / 1000))
}

// ─── Biométrie ──────────────────────────────────────────────────────
export function isBiometricEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true'
}

export function setBiometricEnabled(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true')
  } else {
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY)
  }
}

// ─── Utilisateur mémorisé ──────────────────────────────────────────
export function setRememberedUser(name: string, avatarUrl?: string): void {
  localStorage.setItem(REMEMBERED_USER_KEY, JSON.stringify({ name, avatarUrl }))
}

export function getRememberedUser(): { name: string; avatarUrl?: string } | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(REMEMBERED_USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearRememberedUser(): void {
  localStorage.removeItem(REMEMBERED_USER_KEY)
}

// ─── Durée d'inactivité ─────────────────────────────────────────────
export function getInactivityTimeoutSeconds(): number {
  if (typeof window === 'undefined') return DEFAULT_INACTIVITY_SECONDS
  const stored = localStorage.getItem(INACTIVITY_TIMEOUT_KEY)
  if (!stored) return DEFAULT_INACTIVITY_SECONDS
  const parsed = parseInt(stored, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INACTIVITY_SECONDS
}

export function setInactivityTimeoutSeconds(seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error('La durée doit être un nombre de secondes positif')
  }
  localStorage.setItem(INACTIVITY_TIMEOUT_KEY, String(seconds))
  window.dispatchEvent(new CustomEvent('barkahflow:inactivity-timeout-changed'))
}

// ─── Récupération admin depuis Supabase ──────────────────────────────

/**
 * Récupère les données admin depuis la session Supabase.
 * Fonction synchrone qui utilise les données de la session.
 */
export function getAdminBySupabaseId(supabaseId: string, supabaseUser: any): {
  id: string
  name: string
  email: string | null
  phone: string | null
  avatarUrl: string | null
} | null {
  if (!supabaseUser) return null
  
  return {
    id: supabaseUser.id,
    name: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'Admin',
    email: supabaseUser.email || null,
    phone: supabaseUser.user_metadata?.phone || null,
    avatarUrl: supabaseUser.user_metadata?.avatar_url || null,
  }
}