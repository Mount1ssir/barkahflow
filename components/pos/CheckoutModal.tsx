'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import { processCheckout } from '@/lib/checkout-process'
import { dbSelect } from '@/src/lib/db'
import { formatMAD } from '@/lib/stats-data'
import { Plus, DollarSign, CreditCard, Smartphone, Repeat, AlertTriangle } from 'lucide-react'

const WALKIN_CLIENT_ID = 'client_walkin'

interface CartItem {
  product: {
    id: string
    retailPrice: number
    taxRate: number
  }
  quantity: number
}

interface Client {
  id: string
  full_name: string
  phone: string | null
}

interface CheckoutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cart: CartItem[]
  total: number
  subtotal: number
  tax: number
  onSuccess: (invoiceId: string, invoiceNumber: string) => void
}

const BLUE_NAVY = '#1E293B'

type PaymentMethod = 'cash' | 'card' | 'mobile' | 'mixed'

interface CreditLimitWarning {
  currentDebt: number   // centimes
  newDebt: number       // centimes
  limit: number         // centimes
}

export function CheckoutModal({
  open,
  onOpenChange,
  cart,
  total,
  subtotal,
  tax,
  onSuccess,
}: CheckoutModalProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PARTIAL' | 'UNPAID'>('PAID')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [paidAmount, setPaidAmount] = useState('')
  const [customerId, setCustomerId] = useState<string>(WALKIN_CLIENT_ID)
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [discount, setDiscount] = useState('0')
  const [poNumber, setPoNumber] = useState('')

  // ── Avertissement limite de crédit (non bloquant) ─────────────────
  const [limitWarning, setLimitWarning] = useState<CreditLimitWarning | null>(null)
  const limitConfirmedRef = useRef(false)

  useEffect(() => {
    if (open) {
      dbSelect<Client>(
        `SELECT id, full_name, phone FROM clients ORDER BY
          CASE WHEN id = ? THEN 0 ELSE 1 END, full_name ASC`,
        [WALKIN_CLIENT_ID]
      )
        .then(setClients)
        .catch(() => toast.error('Impossible de charger les clients'))

      setCustomerId(WALKIN_CLIENT_ID)
      setPaidAmount('')
      setPaymentStatus('PAID')
      setPaymentMethod('cash')
      setDiscount('0')
      setPoNumber('')
      setLimitWarning(null)
      limitConfirmedRef.current = false
    }
  }, [open])

  // Toute modification des paramètres de la vente invalide une éventuelle
  // confirmation précédente du dépassement de limite (on revérifie).
  useEffect(() => {
    setLimitWarning(null)
    limitConfirmedRef.current = false
  }, [customerId, paymentStatus, paidAmount, discount])

  const handleCustomerChange = (value: string) => {
    if (value === 'add_client') {
      router.push('/dashboard/clients/nouveau')
      return
    }
    setCustomerId(value)
  }

  const totalAmount = (total / 100) * (1 - (parseFloat(discount) || 0) / 100)
  const received = parseFloat(paidAmount) || 0
  const change = received > totalAmount ? received - totalAmount : 0

  const showReceivedAmount = paymentStatus === 'PARTIAL' ||
                             (paymentStatus === 'PAID' && paymentMethod === 'cash')

  // ── Vérification de la limite de crédit ───────────────────────────
  // Renvoie true si on peut continuer (pas de limite dépassée, ou déjà
  // confirmé par l'utilisateur). Renvoie false et affiche un avertissement
  // sinon — sans jamais bloquer définitivement la vente.
  const checkCreditLimit = async (finalPaidAmount: number, newTotalMAD: number): Promise<boolean> => {
    if (paymentStatus === 'PAID' || customerId === WALKIN_CLIENT_ID) return true
    if (limitConfirmedRef.current) return true

    try {
      const clientRows = await dbSelect<{ credit_limit: number | null }>(
        `SELECT credit_limit FROM clients WHERE id = ?`,
        [customerId]
      )
      const creditLimit = clientRows[0]?.credit_limit ?? null
      if (creditLimit === null) return true // pas de limite définie pour ce client

      const debtRows = await dbSelect<{ total: number }>(
        `SELECT COALESCE(SUM(remaining_debt), 0) as total
         FROM debt_ledger
         WHERE contact_id = ? AND status IN ('ACTIVE', 'PARTIAL')`,
        [customerId]
      )
      const currentDebt = debtRows[0]?.total || 0

      // Montant qui ira à crédit sur CETTE vente (en centimes)
      const newCreditMAD = paymentStatus === 'UNPAID' ? newTotalMAD : (newTotalMAD - finalPaidAmount)
      const newCreditCentimes = Math.round(newCreditMAD * 100)
      const projectedDebt = currentDebt + newCreditCentimes

      if (projectedDebt > creditLimit) {
        setLimitWarning({ currentDebt, newDebt: projectedDebt, limit: creditLimit })
        return false
      }
      return true
    } catch (error) {
      console.error('Erreur vérification limite de crédit:', error)
      return true // en cas d'erreur, on ne bloque pas la vente
    }
  }

  const handleSubmit = async () => {
    if (!cart || cart.length === 0) {
      toast.error('Le panier est vide')
      return
    }

    for (const item of cart) {
      if (!item?.product?.id) {
        toast.error('Élément de panier invalide')
        return
      }
    }

    if (paymentStatus !== 'PAID' && customerId === WALKIN_CLIENT_ID) {
      toast.error('Veuillez sélectionner un vrai client pour une facture partielle ou impayée')
      return
    }

    if (paymentStatus === 'PARTIAL') {
      const amount = parseFloat(paidAmount)
      if (!amount || amount <= 0 || amount >= totalAmount) {
        toast.error('Le montant payé doit être inférieur au total et supérieur à 0')
        return
      }
    }

    if (paymentStatus === 'PAID' && paymentMethod === 'cash') {
      const amount = parseFloat(paidAmount)
      if (!amount || amount < totalAmount) {
        toast.error('Le montant reçu doit être supérieur ou égal au total')
        return
      }
    }

    const discountPercent = parseFloat(discount) || 0
    const discountFactor = 1 - discountPercent / 100
    const newTotal = (total / 100) * discountFactor
    let finalPaidAmount = newTotal

    if (paymentStatus === 'PARTIAL') {
      finalPaidAmount = parseFloat(paidAmount) || 0
    } else if (paymentStatus === 'PAID' && paymentMethod === 'cash') {
      finalPaidAmount = parseFloat(paidAmount) || newTotal
    }

    // ── Vérification limite de crédit avant de continuer ──────────
    const canProceed = await checkCreditLimit(finalPaidAmount, newTotal)
    if (!canProceed) return

    setLoading(true)
    try {
      const cartForCheckout = cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.product.retailPrice / 100,
      }))

      const result = await processCheckout({
        cart: cartForCheckout,
        customerId: customerId === WALKIN_CLIENT_ID ? null : customerId,
        paymentStatus,
        paymentMethod,
        paidAmount: finalPaidAmount,
        poNumber: poNumber.trim() || null,
        userId: null,
        ipAddress: '0.0.0.0',
        userAgent: navigator.userAgent,
      })

      onSuccess(result.invoiceId, result.invoiceNumber)
      onOpenChange(false)
    } catch (error: any) {
      console.error('Erreur checkout:', error)
      toast.error(error?.message || 'Erreur lors de la finalisation')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmDespiteLimit = () => {
    limitConfirmedRef.current = true
    setLimitWarning(null)
    handleSubmit()
  }

  const isWalkin = customerId === WALKIN_CLIENT_ID
  const discountPercent = parseFloat(discount) || 0
  const discountFactor = 1 - discountPercent / 100
  const displaySubtotal = (subtotal / 100) * discountFactor
  const displayTax = (tax / 100) * discountFactor
  const displayTotal = (total / 100) * discountFactor
  const hasPartialAmountError = paymentStatus === 'PARTIAL' && paidAmount !== '' && (received <= 0 || received >= displayTotal)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl border-0">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-50">
            {t('pos.checkout_title', 'Récapitulatif de la commande')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('pos.subtotal', 'Sous-total')}</span>
              <span className="font-medium">{displaySubtotal.toFixed(2)} MAD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('pos.tax', 'TVA')}</span>
              <span className="font-medium">{displayTax.toFixed(2)} MAD</span>
            </div>
            {discountPercent > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Remise ({discountPercent}%)</span>
                <span>- {((subtotal / 100) * discountPercent / 100).toFixed(2)} MAD</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-1 border-t border-gray-200 dark:border-gray-700">
              <span>{t('pos.total', 'Total')}</span>
              <span className="text-lg" style={{ color: '#D4A017' }}>{displayTotal.toFixed(2)} MAD</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('pos.customer', 'Client')}
              {paymentStatus !== 'PAID' && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select value={customerId} onValueChange={handleCustomerChange}>
              <SelectTrigger className="rounded-xl border-gray-200 dark:border-gray-700 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.id === WALKIN_CLIENT_ID ? (
                      <span className="text-gray-400 italic">
                        {t('pos.walkin_client', 'Client de passage')}
                      </span>
                    ) : (
                      <>
                        {c.full_name}
                        {c.phone ? ` — ${c.phone}` : ''}
                      </>
                    )}
                  </SelectItem>
                ))}
                <SelectItem
                  value="add_client"
                  className="text-blue-500 font-medium hover:text-blue-600 border-t border-gray-200 pt-2 mt-1"
                >
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    {t('pos.add_client', 'Ajouter un client')}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {paymentStatus !== 'PAID' && isWalkin && (
              <p className="text-xs text-red-500">⚠️ Sélectionnez un vrai client pour ce mode de paiement</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Référence commande <span className="text-gray-400 font-normal">(optionnel)</span>
            </Label>
            <Input
              type="text"
              placeholder="Ex: BC-2026-045"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              className="rounded-xl border-gray-200 dark:border-gray-700 h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('pos.discount', 'Remise (%)')}
            </Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="rounded-xl border-gray-200 dark:border-gray-700 h-11"
            />
          </div>

          <div className="space-y-2 pos-checkout-radio">
            <style jsx global>{`
              .pos-checkout-radio [data-slot="radio-group-indicator"] span {
                background-color: #60a5fa !important;
                border-radius: 9999px !important;
                width: 8px !important;
                height: 8px !important;
              }
            `}</style>
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('pos.payment_status', 'Statut de paiement')}
            </Label>
            <RadioGroup
              value={paymentStatus}
              onValueChange={(v: 'PAID' | 'PARTIAL' | 'UNPAID') => setPaymentStatus(v)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="PAID" id="paid" />
                <Label htmlFor="paid" className="font-medium text-green-600 dark:text-green-400">
                  {t('pos.paid', 'Payé')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="PARTIAL" id="partial" />
                <Label htmlFor="partial" className="font-medium text-amber-600 dark:text-amber-400">
                  {t('pos.partial', 'Partiel')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="UNPAID" id="unpaid" />
                <Label htmlFor="unpaid" className="font-medium text-red-600 dark:text-red-400">
                  {t('pos.unpaid', 'Impayé')}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {(paymentStatus === 'PAID' || paymentStatus === 'PARTIAL') && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Moyen de paiement
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'cash', label: 'Espèces', icon: DollarSign },
                  { value: 'card', label: 'TPE', icon: CreditCard },
                  { value: 'mobile', label: 'Mobile', icon: Smartphone },
                  { value: 'mixed', label: 'Mixte', icon: Repeat },
                ].map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    type="button"
                    variant={paymentMethod === value ? 'default' : 'outline'}
                    onClick={() => setPaymentMethod(value as PaymentMethod)}
                    className={`h-12 rounded-xl font-medium flex flex-col items-center gap-1 ${
                      paymentMethod === value
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px]">{label}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {showReceivedAmount && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {paymentStatus === 'PARTIAL'
                  ? t('pos.paid_amount', 'Montant payé')
                  : 'Montant reçu'}
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="rounded-xl border-gray-200 dark:border-gray-700 h-11"
              />
              {paymentMethod === 'cash' && received > 0 && change > 0 && (
                <p className="text-sm text-green-600 font-medium">
                  Monnaie à rendre : {change.toFixed(2)} MAD
                </p>
              )}
              {paymentMethod === 'cash' && paymentStatus === 'PAID' && received > 0 && received < displayTotal && (
                <p className="text-sm text-red-500">
                  Le montant reçu est inférieur au total
                </p>
              )}
              {paymentStatus === 'PARTIAL' && paidAmount !== '' && received <= 0 && (
                <p className="text-sm text-red-500">
                  Le montant payé doit être supérieur à 0
                </p>
              )}
              {paymentStatus === 'PARTIAL' && paidAmount !== '' && received > 0 && received >= displayTotal && (
                <p className="text-sm text-red-500">
                  Le montant payé doit être inférieur au total ({displayTotal.toFixed(2)} MAD)
                </p>
              )}
            </div>
          )}

          {/* ── Avertissement limite de crédit dépassée (non bloquant) ── */}
          {limitWarning && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-800 dark:text-amber-300">
                  <p className="font-semibold mb-1">Ce client dépassera sa limite de crédit</p>
                  <p>Limite fixée : {formatMAD(limitWarning.limit)}</p>
                  <p>Dette actuelle : {formatMAD(limitWarning.currentDebt)}</p>
                  <p className="font-semibold">Nouvelle dette totale : {formatMAD(limitWarning.newDebt)}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs rounded-lg"
                  onClick={() => setLimitWarning(null)}
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs rounded-lg bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleConfirmDespiteLimit}
                  disabled={loading}
                >
                  Confirmer quand même
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
          >
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !!limitWarning || hasPartialAmountError}
            className="rounded-xl font-semibold text-white h-11 px-6 shadow-sm hover:shadow-md transition-all"
            style={{ backgroundColor: BLUE_NAVY }}
          >
            {loading ? t('common.loading', 'Chargement...') : t('pos.confirm_checkout', 'Confirmer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}