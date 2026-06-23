'use client'

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import fr from './fr.json'
import en from './en.json'
import ar from './ar.json'

const resources = {
  fr: { translation: fr },
  en: { translation: en },
  ar: { translation: ar },
}

// ✅ Lire la langue stockée immédiatement
function getStoredLang(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('barkahflow-language')
    if (stored && ['fr', 'en', 'ar'].includes(stored)) {
      return stored
    }
  }
  return 'fr'
}

// ✅ Initialiser i18n immédiatement avec la langue stockée
if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: getStoredLang(),
      fallbackLng: 'fr',
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    })
}

export function initI18n(lng: string = 'fr') {
  i18n.changeLanguage(lng)
  return i18n
}

export default i18n