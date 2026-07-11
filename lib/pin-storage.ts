// lib/pin-storage.ts
const PIN_HASH_KEY = 'barkahflow_pin_hash'
const PIN_ATTEMPTS_KEY = 'barkahflow_pin_attempts'
const PIN_LOCKED_UNTIL_KEY = 'barkahflow_pin_locked_until'
const BIOMETRIC_ENABLED_KEY = 'barkahflow_biometric_enabled'
const REMEMBERED_USER_KEY = 'barkahflow_remembered_user'
const PIN_LENGTH_KEY = 'barkahflow_pin_length'
const INACTIVITY_TIMEOUT_KEY = 'barkahflow_inactivity_timeout'

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

// ─── PIN ──────────────────────────────────────────────────────────
export function isPinEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem(PIN_HASH_KEY)
}

export async function setPinCode(pin: string): Promise<void> {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error('Le PIN doit contenir entre 4 et 6 chiffres')
  }
  const hash = await hashPin(pin)
  localStorage.setItem(PIN_HASH_KEY, hash)
  localStorage.setItem(PIN_LENGTH_KEY, String(pin.length))
  resetAttempts()
}

export function disablePin(): void {
  localStorage.removeItem(PIN_HASH_KEY)
  localStorage.removeItem(BIOMETRIC_ENABLED_KEY)
  localStorage.removeItem(PIN_LENGTH_KEY)
  resetAttempts()
}

export async function verifyPinCode(pin: string): Promise<boolean> {
  if (isLockedOut()) return false

  const storedHash = localStorage.getItem(PIN_HASH_KEY)
  if (!storedHash) return false

  const inputHash = await hashPin(pin)
  const isCorrect = inputHash === storedHash

  if (isCorrect) {
    resetAttempts()
  } else {
    incrementAttempts()
  }

  return isCorrect
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

// ─── Gestion des tentatives ──────────────────────────────────────
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

// ─── Durée d'inactivité (configurable) ─────────────────────────────
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