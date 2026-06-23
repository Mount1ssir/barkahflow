const PIN_KEY = 'barkah_pin_code'
const PIN_ENABLED_KEY = 'barkah_pin_enabled'
const PIN_ATTEMPTS_KEY = 'barkah_pin_attempts'
const BIOMETRIC_ENABLED_KEY = 'barkah_biometric_enabled'

const MAX_ATTEMPTS = 5

export function isPinEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(PIN_ENABLED_KEY) === 'true'
}

export function setPinCode(pin: string): void {
  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    throw new Error('Le PIN doit contenir exactement 4 chiffres')
  }
  localStorage.setItem(PIN_KEY, pin)
  localStorage.setItem(PIN_ENABLED_KEY, 'true')
  resetAttempts()
}

export function verifyPinCode(pin: string): boolean {
  const stored = localStorage.getItem(PIN_KEY)
  const isCorrect = stored === pin

  if (isCorrect) {
    resetAttempts()
  } else {
    incrementAttempts()
  }

  return isCorrect
}

export function disablePin(): void {
  localStorage.removeItem(PIN_KEY)
  localStorage.removeItem(PIN_ENABLED_KEY)
  resetAttempts()
}

export function getRemainingAttempts(): number {
  const used = parseInt(localStorage.getItem(PIN_ATTEMPTS_KEY) || '0', 10)
  return Math.max(0, MAX_ATTEMPTS - used)
}

function incrementAttempts(): void {
  const used = parseInt(localStorage.getItem(PIN_ATTEMPTS_KEY) || '0', 10)
  localStorage.setItem(PIN_ATTEMPTS_KEY, String(used + 1))
}

function resetAttempts(): void {
  localStorage.setItem(PIN_ATTEMPTS_KEY, '0')
}

export function isLockedOut(): boolean {
  return getRemainingAttempts() <= 0
}

// ── Biométrie ──────────────────────────────────────────────────
export function isBiometricEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true'
}

export function setBiometricEnabled(enabled: boolean): void {
  localStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false')
}

// ── Compte mémorisé localement (pour "Changer de compte") ───────
const REMEMBERED_USER_KEY = 'barkah_remembered_user'

export interface RememberedUser {
  name: string
  email: string
  avatarUrl?: string
}

export function setRememberedUser(user: RememberedUser): void {
  localStorage.setItem(REMEMBERED_USER_KEY, JSON.stringify(user))
}

export function getRememberedUser(): RememberedUser | null {
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
  disablePin()
  setBiometricEnabled(false)
}