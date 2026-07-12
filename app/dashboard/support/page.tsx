'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  HelpCircle,
  Mail,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  BookOpen,
  LifeBuoy,
  Bug,
} from 'lucide-react'
import { open } from '@tauri-apps/plugin-shell'

// ─── Config ───────────────────────────────────────────────────────
const WHATSAPP_NUMBER = '+212609884563'
const SUPPORT_EMAIL = 'barkahflow.support@gmail.com'
const APP_VERSION = '1.0.0'
const BLUE = '#3B82F6'

// ─── FAQ ──────────────────────────────────────────────────────────
interface FaqItem {
  key: string
  question: string
  answer: string
}

const FAQ_ITEMS: FaqItem[] = [
  {
    key: 'create_invoice',
    question: 'Comment créer une nouvelle facture ?',
    answer: 'Rendez-vous dans la section "Factures" depuis le menu latéral, puis cliquez sur "Nouvelle facture". Remplissez les informations du client, ajoutez les produits, puis validez.',
  },
  {
    key: 'add_product',
    question: 'Comment ajouter un nouveau produit ?',
    answer: 'Allez dans "Produits" dans le menu latéral, puis cliquez sur "Ajouter un produit". Remplissez les informations (nom, prix, stock, etc.) et enregistrez.',
  },
  {
    key: 'manage_debts',
    question: 'Comment gérer les dettes clients ?',
    answer: 'La section "Dettes" vous permet de voir tous les clients endettés. Vous pouvez enregistrer des paiements partiels et suivre l\'historique complet.',
  },
  {
    key: 'export_data',
    question: 'Puis-je exporter mes données ?',
    answer: 'Oui ! Dans la page "Revenus" ou "Clients", vous trouverez un bouton "Exporter" qui génère un fichier CSV de vos données pour la période sélectionnée.',
  },
  {
    key: 'pin_lock',
    question: 'Comment fonctionne le verrouillage PIN ?',
    answer: 'Allez dans "Paramètres → Sécurité" pour activer ou modifier votre code PIN. L\'application se verrouillera automatiquement après une période d\'inactivité.',
  },
  {
    key: 'reset_pin',
    question: 'Comment réinitialiser mon PIN ?',
    answer: 'Sur l\'écran PIN, cliquez sur "PIN oublié ?". Un email de réinitialisation sera envoyé à votre adresse Google associée. Suivez le lien reçu pour créer un nouveau PIN.',
  },
  {
    key: 'print_invoices',
    question: 'Puis-je imprimer mes factures ?',
    answer: 'Oui, sur la page de détail d\'une facture, cliquez sur "Imprimer" pour une version papier, ou "Télécharger PDF" pour la sauvegarder sur votre ordinateur.',
  },
  {
    key: 'backup_data',
    question: 'Comment sauvegarder mes données ?',
    answer: 'Vos données sont stockées localement dans une base SQLite sur votre ordinateur. Il est recommandé de copier régulièrement le fichier de base de données vers un disque externe ou un cloud (Google Drive, OneDrive).',
  },
  {
    key: 'app_launch_issue',
    question: 'Que faire si l\'application ne démarre pas ?',
    answer: 'Essayez de redémarrer votre ordinateur. Si le problème persiste, contactez le support via WhatsApp ou email en précisant votre système d\'exploitation et la version de l\'app.',
  },
  {
    key: 'update_app',
    question: 'Comment mettre à jour l\'application ?',
    answer: 'Une notification apparaîtra automatiquement lorsqu\'une nouvelle version est disponible. Vous pouvez aussi contacter le support pour recevoir la dernière version.',
  },
]

// ─── Accordéon FAQ ─────────────────────────────────────────────────
function FaqAccordion() {
  const { t } = useTranslation()
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <div className="space-y-2">
      {FAQ_ITEMS.map((item, index) => {
        const isOpen = openIndex === index
        return (
          <div
            key={index}
            className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden transition-all"
          >
            <button
              onClick={() => toggle(index)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {t('support_page.faq.' + item.key + '.question', item.question)}
              </span>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
              )}
            </button>
            {isOpen && (
              <div className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed border-t border-gray-100 dark:border-gray-700 pt-3">
                {t('support_page.faq.' + item.key + '.answer', item.answer)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────
export default function SupportPage() {
  const { t } = useTranslation()

  const openWhatsApp = () => {
    const message = encodeURIComponent(t('support_page.whatsapp_message', "Bonjour, j'ai besoin d'aide avec BarkahFlow v{{version}}.", { version: APP_VERSION }))
    open(`https://wa.me/${WHATSAPP_NUMBER.replace('+', '')}?text=${message}`)
  }

  const openEmail = () => {
    const subject = encodeURIComponent(`BarkahFlow v${APP_VERSION} - Demande d'aide`)
    open(`https://mail.google.com/mail/?view=cm&to=${SUPPORT_EMAIL}&su=${subject}`)
  }

  const openBugReport = () => {
    const subject = encodeURIComponent(`[Bug] BarkahFlow v${APP_VERSION}`)
    const body = encodeURIComponent(
      `Bonjour,\n\nJ'ai rencontré un problème avec BarkahFlow v${APP_VERSION}.\n\nDescription du problème :\n[Décrivez ici le bug]\n\nÉtapes pour reproduire :\n1. \n2. \n3. \n\nSystème d'exploitation : Windows\n\nMerci.`
    )
    open(`https://mail.google.com/mail/?view=cm&to=${SUPPORT_EMAIL}&su=${subject}&body=${body}`)
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full p-6">

      {/* ─── Titre ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <LifeBuoy className="h-8 w-8" style={{ color: BLUE }} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('support_page.title', 'Support & Aide')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('support_page.subtitle', 'Trouvez des réponses ou contactez notre équipe.')}
          </p>
        </div>
      </div>

      {/* ─── Contact Rapide ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card
          className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-green-300"
          onClick={openWhatsApp}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center shrink-0">
              <MessageSquare className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">WhatsApp</p>
              <p className="text-xs text-gray-400">{t('support_page.whatsapp_desc', 'Rapide et direct')}</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-blue-300"
          onClick={openEmail}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Email</p>
              <p className="text-xs text-gray-400">{SUPPORT_EMAIL}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Signaler un bug ─────────────────────────────────────── */}
      <Card className="rounded-2xl border shadow-sm border-red-100 dark:border-red-900/30">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
              <Bug className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{t('support_page.bug_title', 'Signaler un bug')}</p>
              <p className="text-xs text-gray-400">{t('support_page.bug_desc', 'Un problème ? Dites-le nous.')}</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="rounded-xl text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300"
            onClick={openBugReport}
          >
            {t('support_page.bug_action', 'Signaler')}
          </Button>
        </CardContent>
      </Card>

      {/* ─── FAQ ─────────────────────────────────────────────────── */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-gray-500" />
            {t('support_page.faq_title', 'Questions fréquentes')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FaqAccordion />
        </CardContent>
      </Card>

      {/* ─── Footer ───────────────────────────────────────────────── */}
      <div className="text-center text-xs text-gray-400 dark:text-gray-500 space-y-1">
        <p>BarkahFlow v{APP_VERSION}</p>
        <p>{t('support_page.footer_hours', 'Support disponible du lundi au vendredi, 9h à 18h.')}</p>
      </div>

    </div>
  )
}