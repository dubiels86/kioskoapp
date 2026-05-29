'use client'

import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/types'
import type { PaymentMethod } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Banknote, ArrowRightLeft, Home, Check } from 'lucide-react'
import { useState } from 'react'

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isProcessing: boolean
}

const METHOD_ICONS: Record<PaymentMethod, React.ComponentType<{ className?: string }>> = {
  EFECTIVO: Banknote,
  TRANSFERENCIA: ArrowRightLeft,
  CUENTA_CASA: Home,
}

export function PaymentDialog({
  open,
  onOpenChange,
  onConfirm,
  isProcessing,
}: PaymentDialogProps) {
  // Use key to reset internal state when dialog opens/closes
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <PaymentDialogContent
            onConfirm={onConfirm}
            isProcessing={isProcessing}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PaymentDialogContent({
  onConfirm,
  isProcessing,
  onCancel,
}: {
  onConfirm: () => void
  isProcessing: boolean
  onCancel: () => void
}) {
  const { cart, selectedPaymentMethod, cartSubtotal } = useAppStore()
  const [cashReceived, setCashReceived] = useState<string>('')
  const [customerName, setCustomerName] = useState('')

  const subtotal = cartSubtotal()
  const total = subtotal
  const received = parseFloat(cashReceived) || 0
  const change = received - total
  const isEfectivo = selectedPaymentMethod === 'EFECTIVO'
  const canConfirm = isEfectivo ? received >= total : true

  const Icon = METHOD_ICONS[selectedPaymentMethod]

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-emerald-600" />
          Cobrar - {PAYMENT_METHOD_LABELS[selectedPaymentMethod]}
        </DialogTitle>
        <DialogDescription>
          Confirmá los datos de la venta para procesarla.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Sale Summary */}
        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">Items</span>
            <span className="font-medium">{cart.length} productos</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between items-baseline">
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Total
            </span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {/* Cash received (only for EFECTIVO) */}
        {isEfectivo && (
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
              Efectivo recibido
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                $
              </span>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="0.00"
                className="pl-7 h-12 text-lg font-semibold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canConfirm) onConfirm()
                }}
              />
            </div>
            {cashReceived && received >= total && (
              <div className="mt-2 flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/20 rounded-lg px-3 py-2 border border-emerald-200 dark:border-emerald-800">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Vuelto
                </span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(change)}
                </span>
              </div>
            )}
            {cashReceived && received < total && received > 0 && (
              <p className="mt-2 text-sm text-red-500">
                El monto recibido es insuficiente
              </p>
            )}
          </div>
        )}

        {/* Customer name (for all methods, optional) */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
            Cliente{' '}
            <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
          <Input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nombre del cliente"
            className="h-10"
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={onCancel}
          className="mr-2"
        >
          Cancelar
        </Button>
        <Button
          onClick={onConfirm}
          disabled={!canConfirm || isProcessing}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm text-white min-w-[140px]"
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Procesando...
            </span>
          ) : (
            <>
              <Check className="w-4 h-4 mr-1.5" />
              Confirmar
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  )
}
