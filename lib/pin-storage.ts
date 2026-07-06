// ─── Stockage local du PIN et de l'utilisateur mémorisé ───────────
// Le PIN protège l'accès à l'app sur CET appareil (pas le compte
// Google lui-même). Stocké en localStorage, jamais en clair (hashé
// via SHA-256). Verrouillage après 5 tentatives échouées.

const PIN_HASH_KEY = 'barkahflow_pin_hash'
const PIN_ATTEMPTS_KEY = 'barkahflow_pin_attempts'
const PIN_LOCKED_UNTIL_KEY = 'barkahflow_pin_locked_until'
const BIOMETRIC_ENABLED_KEY = 'barkahflow_biometric_enabled'
const REMEMBERED_USER_KEY = 'barkahflow_remembered_user'

const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 5 * 60 * 1000 // 5 minutes

export interface RememberedUser {
  name: string
  email: string
  avatarUrl?: string
}

// ─── Hash SHA-256 (Web Crypto API, disponible nativement dans la webview) ──
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ─── Configuration du PIN ──────────────────────────────────────────
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
  resetAttempts()
}

export function disablePin(): void {
  localStorage.removeItem(PIN_HASH_KEY)
  localStorage.removeItem(BIOMETRIC_ENABLED_KEY)
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

// ─── Gestion des tentatives / verrouillage ─────────────────────────
function getAttempts(): number {
  if (typeof window === 'undefined') return 0
  return parseInt(localStorage.getItem(PIN_ATTEMPTS_KEY) || '0', 10)
}

function incrementAttempts(): void {
  const attempts = getAttempts() + 1
  localStorage.setItem(PIN_ATTEMPTS_KEY, String(attempts))
  if (attempts >= MAX_ATTEMPTS) {
    const lockedUntil = Date.now() + LOCKOUT_DURATION_MS
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
  if (!stillLocked) {
    resetAttempts() // le verrouillage a expiré, on nettoie
  }
  return stillLocked
}

export function getLockoutRemainingSeconds(): number {
  if (typeof window === 'undefined') return 0
  const lockedUntil = localStorage.getItem(PIN_LOCKED_UNTIL_KEY)
  if (!lockedUntil) return 0
  const remaining = parseInt(lockedUntil, 10) - Date.now()
  return Math.max(0, Math.ceil(remaining / 1000))
}

// ─── Biométrie (activation/désactivation, la logique WebAuthn est dans biometric-auth.ts) ──
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

// ─── Utilisateur mémorisé (affiché sur l'écran de verrouillage) ────
export function setRememberedUser(user: RememberedUser): void {
  localStorage.setItem(REMEMBERED_USER_KEY, JSON.stringify(user))
}

export function getRememberedUser(): RememberedUser | null {
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