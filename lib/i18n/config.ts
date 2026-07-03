import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import fr from './fr.json'
import en from './en.json'
import ar from './ar.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      ar: { translation: ar },
    },
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'en', 'ar'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'barkah_language',
    },
  })

export default i18n
export type SupportedLang = 'fr' | 'en' | 'ar'

// ✅ Fonction initI18n accepte une string, valide et change la langue
export const initI18n = (lng: string) => {
  if (['fr', 'en', 'ar'].includes(lng)) {
    i18n.changeLanguage(lng as SupportedLang)
  }
}