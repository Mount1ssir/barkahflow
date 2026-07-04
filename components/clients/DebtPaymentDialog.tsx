'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { recordPaymentForClient } from '@/lib/client-data'
import { formatMAD } from '@/lib/stats-data'
import { DebtWithInvoice } from '@/lib/debt-ledger'

interface DebtPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  debt: DebtWithInvoice | null
  clientName: string
  onSuccess: () => void
}

export function DebtPaymentDialog({
  open,
  onOpenChange,
  debt,
  clientName,
  onSuccess,
}: DebtPaymentDialogProps) {
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [loading, setLoading] = useState(false)

  if (!debt) return null

  const maxAmount = debt.remainingDebt / 100
  const numericAmount = parseFloat(amount) || 0
  const isValid = numericAmount > 0 && numericAmount <= maxAmount

  const handleSubmit = async () => {
    if (!isValid) {
      toast.error('Montant invalide')
      return
    }

    const amountInCentimes = Math.round(numericAmount * 100)

    setLoading(true)
    try {
      await recordPaymentForClient(
        debt.contactId,
        debt.debtId,
        amountInCentimes,
        paymentMethod,
        null,
        '0.0.0.0',
        navigator.userAgent
      )
      toast.success(`Paiement enregistré : ${amount} MAD`)
      onSuccess()
      onOpenChange(false)
      setAmount('')
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors du paiement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Encaisser un paiement</DialogTitle>
          <DialogDescription>
            Client : <strong>{clientName}</strong> — Facture {debt.invoiceNumber}
            <br />
            Solde restant : <strong className="text-red-500">{formatMAD(debt.remainingDebt)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Montant (MAD)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={maxAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Max ${maxAmount.toFixed(2)}`}
              className="rounded-xl h-11"
              disabled={maxAmount === 0}
            />
            {maxAmount === 0 && (
              <p className="text-xs text-amber-600">Cette dette est déjà réglée</p>
            )}
            {amount && numericAmount > 0 && maxAmount > 0 && (
              <p className="text-xs text-gray-500">
                {numericAmount >= maxAmount
                  ? '✅ Paiement total'
                  : `ℹ️ Paiement partiel (il restera ${(maxAmount - numericAmount).toFixed(2)} MAD)`
                }
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Mode de paiement</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="rounded-xl h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Espèces</SelectItem>
                <SelectItem value="card">TPE</SelectItem>
                <SelectItem value="mobile">Mobile</SelectItem>
                <SelectItem value="mixed">Mixte</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !isValid || maxAmount === 0}
            className="text-white"
            style={{ backgroundColor: '#2C3E50' }}
          >
            {loading ? 'Enregistrement...' : 'Confirmer le paiement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}