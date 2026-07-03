'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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

const GOLD = '#D4A017'
const DARK_NAVY = '#0F172A'

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
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PARTIAL' | 'UNPAID'>('PAID')
  const [paidAmount, setPaidAmount] = useState('')
  const [customerId, setCustomerId] = useState<string>(WALKIN_CLIENT_ID)
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [discount, setDiscount] = useState('0')

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
      setDiscount('0')
    }
  }, [open])

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
      if (!amount || amount <= 0 || amount >= total / 100) {
        toast.error('Le montant payé doit être inférieur au total et supérieur à 0')
        return
      }
    }

    const discountPercent = parseFloat(discount) || 0
    const discountFactor = 1 - discountPercent / 100
    const newTotal = (total / 100) * discountFactor
    const newPaidAmount = paymentStatus === 'PAID' ? newTotal : parseFloat(paidAmount) || 0

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
        paidAmount: newPaidAmount,
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

  const isWalkin = customerId === WALKIN_CLIENT_ID
  const discountPercent = parseFloat(discount) || 0
  const discountFactor = 1 - discountPercent / 100
  const displaySubtotal = (subtotal / 100) * discountFactor
  const displayTax = (tax / 100) * discountFactor
  const displayTotal = (total / 100) * discountFactor

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl border-0">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-50">
            {t('pos.checkout_title', 'Récapitulatif de la commande')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Récapitulatif */}
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
              <span className="text-lg" style={{ color: GOLD }}>{displayTotal.toFixed(2)} MAD</span>
            </div>
          </div>

          {/* Client */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('pos.customer', 'Client')}
              {paymentStatus !== 'PAID' && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select value={customerId} onValueChange={setCustomerId}>
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
              </SelectContent>
            </Select>
            {paymentStatus !== 'PAID' && isWalkin && (
              <p className="text-xs text-red-500">⚠️ Sélectionnez un vrai client pour ce mode de paiement</p>
            )}
          </div>

          {/* Remise */}
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

          {/* Paiement */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('pos.payment_status', 'Mode de paiement')}
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

          {/* Montant reçu (PARTIAL) */}
          {paymentStatus === 'PARTIAL' && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('pos.paid_amount', 'Montant reçu')} <span className="text-red-500">*</span>
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
            disabled={loading}
            className="rounded-xl font-semibold text-white h-11 px-6 shadow-sm hover:shadow-md transition-all"
            style={{ backgroundColor: GOLD }}
          >
            {loading ? t('common.loading', 'Chargement...') : t('pos.confirm_checkout', 'Confirmer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}