'use client'

import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/format'
import { PAYMENT_METHOD_LABELS, normalizePaymentMethod } from '@/lib/types'
import type { PaymentMethod, PaymentEntry } from '@/lib/types'
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
import { CreatableSelect } from '@/components/ui/creatable-select'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  CreditCard,
  Home,
  Check,
  Plus,
  Trash2,
  Coffee,
} from 'lucide-react'
import { useState } from 'react'

export interface PaymentResult {
  payments: PaymentEntry[]
  customerName: string
  cashReceived: number
  changeAmount: number
}

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (result: PaymentResult) => void
  isProcessing: boolean
  discount: number
}

const METHOD_ICONS: Record<PaymentMethod, React.ComponentType<{ className?: string }>> = {
  EFECTIVO: Banknote,
  TARJETA: CreditCard,
  CUENTA_CASA: Home,
}

const METHOD_COLORS: Record<PaymentMethod, string> = {
  EFECTIVO: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  TARJETA: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  CUENTA_CASA: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800',
}

const PAYMENT_METHODS_LIST: PaymentMethod[] = ['EFECTIVO', 'TARJETA', 'CUENTA_CASA']

export function PaymentDialog({
  open,
  onOpenChange,
  onConfirm,
  isProcessing,
  discount,
}: PaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <PaymentDialogContent
            onConfirm={onConfirm}
            isProcessing={isProcessing}
            onCancel={() => onOpenChange(false)}
            discount={discount}
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
  discount,
}: {
  onConfirm: (result: PaymentResult) => void
  isProcessing: boolean
  onCancel: () => void
  discount: number
}) {
  const { cart, cartSubtotal, posType, selectedTable } = useAppStore()
  const [payments, setPayments] = useState<PaymentEntry[]>([{ method: 'EFECTIVO', amount: 0 }])
  const [cashReceived, setCashReceived] = useState<string>('')
  const [customerName, setCustomerName] = useState('')

  const queryClient = useQueryClient()
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Error')
      return res.json() as Record<string, { key: string; value: string; label: string }[]>
    },
  })
  const customPaymentMethods: string[] = settings?.custom_options?.find(s => s.key === 'custom_payment_methods')?.value
    ? JSON.parse(settings.custom_options.find(s => s.key === 'custom_payment_methods')!.value)
    : []

  const ALL_PAYMENT_METHODS = [
    ...PAYMENT_METHODS_LIST,
    ...customPaymentMethods.filter(m => !PAYMENT_METHODS_LIST.includes(m as PaymentMethod)) as PaymentMethod[],
  ]

  const isCafeteria = posType === 'cafeteria'
  const subtotal = cartSubtotal()
  const total = subtotal - discount
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = total - totalPaid

  const cashPaymentAmount = payments
    .filter(p => p.method === 'EFECTIVO')
    .reduce((sum, p) => sum + p.amount, 0)
  const cashReceivedNum = parseFloat(cashReceived) || 0
  const cashChange = cashPaymentAmount > 0 ? cashReceivedNum - cashPaymentAmount : 0

  const canConfirm = totalPaid >= total && total > 0

  const handlePaymentAmountChange = (index: number, value: string) => {
    const amount = parseFloat(value) || 0
    const newPayments = [...payments]
    newPayments[index] = { ...newPayments[index], amount }
    setPayments(newPayments)
  }

  const handlePaymentMethodChange = (index: number, method: string) => {
    const newPayments = [...payments]
    newPayments[index] = { ...newPayments[index], method: method as PaymentMethod }
    setPayments(newPayments)
  }

  const addPaymentEntry = () => {
    const nextMethod = payments.length === 0 ? 'EFECTIVO' : 'TARJETA'
    setPayments([...payments, { method: nextMethod, amount: Math.max(0, remaining) }])
  }

  const removePaymentEntry = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index))
  }

  const fillRemaining = (index: number) => {
    const otherPaymentsTotal = payments
      .filter((_, i) => i !== index)
      .reduce((sum, p) => sum + p.amount, 0)
    const remainingForEntry = Math.max(0, total - otherPaymentsTotal)
    const newPayments = [...payments]
    newPayments[index] = { ...newPayments[index], amount: remainingForEntry }
    setPayments(newPayments)
  }

  const handleConfirm = () => {
    onConfirm({
      payments,
      customerName,
      cashReceived: cashPaymentAmount > 0 ? cashReceivedNum : 0,
      changeAmount: cashPaymentAmount > 0 && cashReceivedNum >= cashPaymentAmount ? cashChange : 0,
    })
  }

  // Quick cash amounts based on total
  const quickCashAmounts = (() => {
    if (total <= 0) return []
    const rounded = Math.ceil(total / 100) * 100
    const amounts = new Set<number>()
    amounts.add(rounded)
    if (rounded - 50 >= total) amounts.add(rounded - 50)
    amounts.add(rounded + 100)
    amounts.add(rounded + 200)
    // Add exact amount
    amounts.add(Math.ceil(total))
    return Array.from(amounts).sort((a, b) => a - b).slice(0, 5)
  })()

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Banknote className="w-5 h-5 text-primary" />
          Cobrar
          {isCafeteria && selectedTable && (
            <span className="flex items-center gap-1 text-sm font-normal text-amber-600 dark:text-amber-400 ml-1">
              <Coffee className="w-4 h-4" />
              Mesa #{selectedTable}
            </span>
          )}
        </DialogTitle>
        <DialogDescription>
          Ingresá los medios de pago para la venta.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Sale Summary */}
        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
          {isCafeteria && selectedTable && (
            <div className="flex justify-between text-sm mb-2">
              <span className="text-amber-600 dark:text-amber-400 font-medium">Mesa</span>
              <span className="font-bold text-amber-700 dark:text-amber-400">#{selectedTable}</span>
            </div>
          )}
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">Items</span>
            <span className="font-medium">{cart.length} productos</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-500">Descuento</span>
              <span className="font-medium text-red-600">-{formatCurrency(discount)}</span>
            </div>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between items-baseline">
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Total
            </span>
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {/* Payment Entries */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Medios de pago
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addPaymentEntry}
              className="h-7 text-xs gap-1"
            >
              <Plus className="h-3 w-3" />
              Agregar medio
            </Button>
          </div>

          {payments.map((payment, index) => {
            const Icon = METHOD_ICONS[payment.method]
            return (
              <div
                key={index}
                className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                  METHOD_COLORS[payment.method] || 'bg-slate-50 border-slate-200'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-400" />
                <CreatableSelect
                  options={ALL_PAYMENT_METHODS.map((m) => ({
                    value: m,
                    label: (PAYMENT_METHOD_LABELS as Record<string, string>)[m] || m,
                  }))}
                  value={payment.method}
                  onValueChange={(v) => handlePaymentMethodChange(index, v)}
                  onCreate={async (name) => {
                    const currentCustom = customPaymentMethods
                    const updated = [...currentCustom, name.toUpperCase()]
                    await fetch('/api/settings', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ custom_payment_methods: JSON.stringify(updated) }),
                    })
                    queryClient.invalidateQueries({ queryKey: ['settings'] })
                    return name.toUpperCase()
                  }}
                  placeholder="Medio"
                  searchPlaceholder="Buscar..."
                  createLabel="Crear '{0}'"
                  className="w-[150px] h-8 text-xs"
                />
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    $
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={payment.amount || ''}
                    onChange={(e) => handlePaymentAmountChange(index, e.target.value)}
                    placeholder="0.00"
                    className="h-8 text-sm pl-6"
                    autoFocus={index === 0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canConfirm) {
                        handleConfirm()
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fillRemaining(index)}
                  className="h-8 text-[10px] px-2 shrink-0 text-slate-500 hover:text-slate-700"
                  title="Completar resto"
                >
                  Resto
                </Button>
                {payments.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePaymentEntry(index)}
                    className="h-7 w-7 shrink-0 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        {/* Cash received (only when there's an EFECTIVO payment) */}
        {cashPaymentAmount > 0 && (
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
                autoFocus={payments.length === 1 && payments[0].method === 'EFECTIVO' && payments[0].amount > 0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canConfirm) {
                    handleConfirm()
                  }
                }}
              />
            </div>
            {/* Quick cash buttons */}
            {quickCashAmounts.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {quickCashAmounts.map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCashReceived(String(amount))}
                    className="h-7 text-xs font-medium"
                  >
                    {formatCurrency(amount)}
                  </Button>
                ))}
              </div>
            )}
            {cashReceived && cashReceivedNum >= cashPaymentAmount && cashPaymentAmount > 0 && (
              <div className="mt-2 flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/30 rounded-lg px-3 py-2 border border-emerald-200 dark:border-emerald-800">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Vuelto
                </span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(cashChange)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Payment Summary */}
        <div className={`rounded-lg p-3 border ${
          remaining <= 0
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
        }`}>
          <div className="flex justify-between text-sm">
            <span className={remaining <= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
              {remaining <= 0 ? 'Pagado' : 'Restante'}
            </span>
            <span className={`font-bold ${remaining <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {remaining <= 0 ? formatCurrency(totalPaid) : formatCurrency(remaining)}
            </span>
          </div>
          {remaining < 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              El pago supera el total por {formatCurrency(Math.abs(remaining))}
            </p>
          )}
          {payments.length > 1 && (
            <div className="mt-2 space-y-0.5">
              {payments.map((p, i) => (
                <div key={i} className="flex justify-between text-xs text-slate-500">
                  <span>{(PAYMENT_METHOD_LABELS as Record<string, string>)[normalizePaymentMethod(p.method)] || p.method}</span>
                  <span>{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Customer name */}
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
          onClick={handleConfirm}
          disabled={!canConfirm || isProcessing}
          className="bg-slate-800 hover:bg-slate-700 shadow-sm text-white min-w-[140px]"
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
