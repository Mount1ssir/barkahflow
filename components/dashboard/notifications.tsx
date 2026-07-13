'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { open as openExternal } from '@tauri-apps/plugin-shell'
import { Bell, Package, Wallet, AlertTriangle, Loader2, ChevronRight, MessageSquare, Eye, EyeOff, X, Key, Shield } from 'lucide-react'
import { useNotifications } from '@/context/NotificationContext'
import { saveReminder } from '@/lib/debt-data'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import '@/lib/i18n/config'
import { dismissPinResetNotification } from '@/lib/notifications-data'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function Notifications() {
  const { t } = useTranslation()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const { notifications, loading, dismiss, toggleRead, refresh } = useNotifications()
  
  // ─── État pour le dialog de réinitialisation PIN ──────────────
  const [pinResetTarget, setPinResetTarget] = useState<{ id: string; name: string; notifId: string } | null>(null)
  const [newCashierPin, setNewCashierPin] = useState('')
  const [confirmCashierPin, setConfirmCashierPin] = useState('')
  const [showCashierPin, setShowCashierPin] = useState(false)
  const [savingCashierPin, setSavingCashierPin] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)

  const handleNotifClick = (notif: any) => {
    if (!notif.read) {
      toggleRead(notif.id, false)
    }
    
    // Si c'est une notification de réinitialisation PIN
    if (notif.type === 'pin_reset') {
      // Ouvrir le dialog de réinitialisation
      setPinResetTarget({
        id: notif.cashierId,
        name: notif.cashierName || 'Caissier',
        notifId: notif.id
      })
      setResetDialogOpen(true)
      return
    }
    
    setIsOpen(false)
    if ((notif.type === 'overdue' || notif.type === 'debt') && notif.clientId) {
      router.push(`/dashboard/dettes?client=${notif.clientId}`)
    } else if (notif.type === 'stock' && notif.productId) {
      router.push(`/dashboard/produits?produit=${notif.productId}`)
    }
  }

  const handleToggleRead = (e: React.MouseEvent, notif: any) => {
    e.stopPropagation()
    toggleRead(notif.id, notif.read)
  }

  const handleDismiss = (e: React.MouseEvent, notif: any) => {
    e.stopPropagation()
    dismiss(notif.id)
  }

  const handleWhatsApp = async (e: React.MouseEvent, notif: any) => {
    e.stopPropagation()
    if (!notif.phone) {
      toast.error("Ce client n'a pas de numéro de téléphone")
      return
    }
    const phone = notif.phone.replace(/^0/, '212').replace(/\s/g, '')
    const message = `Bonjour ${notif.clientName}, vous avez une dette de ${((notif.amount || 0) / 100).toFixed(2)} MAD chez nous. Merci de régler dès que possible.`
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    try {
      await openExternal(url)
      if (notif.clientId && notif.amount) {
        await saveReminder(notif.clientId, notif.amount, message, 'whatsapp')
      }
      toast.success('WhatsApp ouvert')
    } catch (error: any) {
      toast.error(`Erreur: ${error?.message || 'Inconnue'}`)
    }
  }

  // ─── Réinitialiser le PIN d'un caissier ────────────────────────────
  const handleResetCashierPin = async () => {
    if (!pinResetTarget) return
    
    if (!/^\d{4,6}$/.test(newCashierPin)) {
      toast.error('Le PIN doit contenir entre 4 et 6 chiffres')
      return
    }
    if (newCashierPin !== confirmCashierPin) {
      toast.error('Les deux codes ne correspondent pas')
      return
    }

    setSavingCashierPin(true)
    try {
      // Importer la fonction de réinitialisation
      const { resetCashierPin } = await import('@/lib/user-data')
      await resetCashierPin(pinResetTarget.id, newCashierPin)
      
      toast.success(`PIN de ${pinResetTarget.name} réinitialisé avec succès`)
      
      // Supprimer la notification
      if (pinResetTarget.notifId) {
        dismissPinResetNotification(pinResetTarget.notifId)
        dismiss(pinResetTarget.notifId)
      }
      
      // Fermer le dialog
      setResetDialogOpen(false)
      setPinResetTarget(null)
      setNewCashierPin('')
      setConfirmCashierPin('')
      
      // Rafraîchir les notifications
      refresh()
      
    } catch (error: any) {
      console.error('Erreur réinitialisation PIN:', error)
      toast.error(error?.message || 'Erreur lors de la réinitialisation')
    } finally {
      setSavingCashierPin(false)
    }
  }

  const handleVoirTout = () => {
    setIsOpen(false)
    router.push('/dashboard/notifications')
  }

  const previewNotifs = notifications.slice(0, 5)
  const count = notifications.length

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-9 h-9 flex items-center justify-center rounded-lg
                     transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-white/5"
        >
          <Bell size={18} className="text-gray-600 dark:text-gray-300" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full
                           flex items-center justify-center text-[10px] font-bold text-white bg-red-500">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

            <div className="absolute right-0 mt-2 w-80 rounded-xl shadow-xl z-50 overflow-hidden
                           border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">

              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('notifications.title', 'Notifications')}
                </h3>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={20} className="animate-spin text-gray-400" />
                  </div>
                )}

                {!loading && notifications.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-gray-400">
                      {t('notifications.empty', 'Aucune notification')}
                    </p>
                  </div>
                )}

                {!loading && previewNotifs.map((notif) => {
                  const Icon = notif.type === 'stock' ? Package : 
                               notif.type === 'pin_reset' ? Shield :
                               notif.type === 'overdue' ? AlertTriangle : Wallet
                  const isClickable = !!notif.clientId || !!notif.productId || notif.type === 'pin_reset'
                  const canWhatsApp = !!notif.phone && (notif.type === 'overdue' || notif.type === 'debt')
                  const isPinReset = notif.type === 'pin_reset'

                  return (
                    <div
                      key={notif.id}
                      onClick={() => isClickable && handleNotifClick(notif)}
                      className={`group flex items-start gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0
                                 ${isClickable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''}
                                 ${notif.read ? 'opacity-50' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isPinReset ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <Icon size={14} className={`${
                          isPinReset ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-300'
                        }`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${notif.read ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {notif.message}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{notif.time}</span>
                          <div className="flex items-center gap-2">
                            {canWhatsApp && (
                              <button
                                onClick={(e) => handleWhatsApp(e, notif)}
                                className="flex items-center gap-1 text-[10px] font-medium text-green-600 hover:text-green-700"
                              >
                                <MessageSquare size={11} /> WhatsApp
                              </button>
                            )}
                            {isPinReset && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleNotifClick(notif)
                                }}
                                className="flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-700"
                              >
                                <Key size={11} /> Régler
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => handleToggleRead(e, notif)}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400"
                        >
                          {notif.read ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                        <button
                          onClick={(e) => handleDismiss(e, notif)}
                          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {notifications.length > 0 && (
                <button
                  onClick={handleVoirTout}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-3
                             border-t border-gray-100 dark:border-gray-800
                             text-xs font-medium text-blue-600 dark:text-blue-400
                             hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  Voir toutes ({count})
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── Dialog de réinitialisation PIN ───────────────────────────── */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-500" />
              Réinitialiser le PIN
            </DialogTitle>
            <DialogDescription>
              Définissez un nouveau code PIN pour {pinResetTarget?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Nouveau PIN (4 à 6 chiffres)
              </Label>
              <div className="relative">
                <Input
                  type={showCashierPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={newCashierPin}
                  onChange={(e) => setNewCashierPin(e.target.value.replace(/\D/g, ''))}
                  className="rounded-xl h-11 tracking-widest pr-10"
                  placeholder="Entrez le nouveau PIN"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowCashierPin((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCashierPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirmer le PIN
              </Label>
              <Input
                type={showCashierPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={confirmCashierPin}
                onChange={(e) => setConfirmCashierPin(e.target.value.replace(/\D/g, ''))}
                className="rounded-xl h-11 tracking-widest"
                placeholder="Confirmez le nouveau PIN"
              />
            </div>

            <Button
              onClick={handleResetCashierPin}
              disabled={savingCashierPin || newCashierPin.length < 4 || newCashierPin !== confirmCashierPin}
              className="w-full rounded-xl text-white h-11 font-semibold"
              style={{ backgroundColor: '#38BDF8' }}
            >
              {savingCashierPin ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Réinitialiser le PIN'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}