// ─── Biométrie via WebAuthn (authentificateur de plateforme) ──────
// Utilise Windows Hello / Touch ID / empreinte selon l'OS, via l'API
// WebAuthn standard supportée par la webview système de Tauri.
// Le credential est enregistré une fois (register), puis vérifié à
// chaque déverrouillage (authenticate) — aucune donnée biométrique
// ne transite ni n'est stockée par l'app, l'OS gère tout nativement.

const CREDENTIAL_ID_KEY = 'barkahflow_webauthn_credential_id'
const RP_NAME = 'BarkahFlow'

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const str = atob(padded)
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i)
  return bytes.buffer
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!window.PublicKeyCredential) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

// ─── Enregistrement (à faire une fois, depuis les paramètres de sécurité) ──
export async function registerBiometric(userEmail: string): Promise<boolean> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const userId = crypto.getRandomValues(new Uint8Array(16))

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: RP_NAME },
        user: {
          id: userId,
          name: userEmail,
          displayName: userEmail,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null

    if (!credential) return false

    localStorage.setItem(CREDENTIAL_ID_KEY, bufferToBase64url(credential.rawId))
    return true
  } catch (error) {
    console.error('Erreur enregistrement biométrique:', error)
    return false
  }
}

// ─── Vérification (à chaque déverrouillage) ────────────────────────
export async function authenticateWithBiometric(): Promise<{ success: boolean; error?: string }> {
  try {
    const storedCredentialId = localStorage.getItem(CREDENTIAL_ID_KEY)
    if (!storedCredentialId) {
      return { success: false, error: 'Aucune biométrie enregistrée' }
    }

    const challenge = crypto.getRandomValues(new Uint8Array(32))

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: base64urlToBuffer(storedCredentialId),
            type: 'public-key',
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    })

    return { success: !!assertion }
  } catch (error: any) {
    console.error('Erreur authentification biométrique:', error)
    return { success: false, error: error?.message || 'Échec de la vérification biométrique' }
  }
}

export function isBiometricRegistered(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem(CREDENTIAL_ID_KEY)
}

export function clearBiometricRegistration(): void {
  localStorage.removeItem(CREDENTIAL_ID_KEY)
}