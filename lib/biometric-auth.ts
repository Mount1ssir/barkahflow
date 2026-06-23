import { Capacitor } from '@capacitor/core'

export interface BiometricResult {
  success: boolean
  error?: string
}

// Vérifie si la biométrie est disponible sur cet appareil
export async function isBiometricAvailable(): Promise<boolean> {
  const platform = Capacitor.getPlatform()

  // La biométrie n'a de sens que sur mobile (pas Desktop/Tauri)
  if (platform !== 'android' && platform !== 'ios') {
    return false
  }

  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')
    const result = await BiometricAuth.checkBiometry()
    return result.isAvailable
  } catch (error) {
    console.error('Erreur vérification biométrie:', error)
    return false
  }
}

// Déclenche la demande d'authentification biométrique
export async function authenticateWithBiometric(): Promise<BiometricResult> {
  const platform = Capacitor.getPlatform()

  if (platform !== 'android' && platform !== 'ios') {
    return { success: false, error: 'Biométrie non disponible sur cette plateforme' }
  }

  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')

    await BiometricAuth.authenticate({
      reason: 'Accédez à BarkahFlow',
      cancelTitle: 'Annuler',
      allowDeviceCredential: false,
      iosFallbackTitle: 'Utiliser le code PIN',
      androidTitle: 'Authentification BarkahFlow',
      androidSubtitle: 'Confirmez votre identité',
      androidConfirmationRequired: false,
    })

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Authentification échouée' }
  }
}