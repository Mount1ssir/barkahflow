'use client'

import { I18nextProvider } from 'react-i18next'
import i18n, { initI18n } from './config'

// ✅ Lire la langue IMMÉDIATEMENT (pas dans useEffect)
function getStoredLang(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('barkahflow-language')
    if (stored && ['fr', 'en', 'ar'].includes(stored)) {
      return stored
    }
  }
  return 'fr'
}

// ✅ Initialiser i18n AVANT le premier rendu
initI18n(getStoredLang())

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  )
}