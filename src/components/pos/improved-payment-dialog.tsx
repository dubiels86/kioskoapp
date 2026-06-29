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
import { Badge } from '@/components/ui/badge'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  CreditCard,
  Check,
  Plus,
  Trash2,
  Coffee,
  Calculator,
  DollarSign,
  Percent,
  Divide,
  X,
  ChevronRight,
} from 'lucide-react'
import { useState, useCallback, useEffect } from 'react'

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (payments: PaymentEntry[], customerName: string) => void
  isProcessing: boolean
}

const METHOD_ICONS: Record<PaymentMethod, React.ComponentType<{ className?: string }>> = {
  EFECTIVO: Banknote,
  TARJETA: CreditCard,
}

const METHOD_COLORS: Record<PaymentMethod, string> = {
  EFECTIVO: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  TARJETA: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
}

const PAYMENT_METHODS_LIST: PaymentMethod[] = ['EFECTIVO', 'TARJETA']

export function ImprovedPaymentDialog({
  open,
  onOpenChange,
  onConfirm,
  isProcessing,
}: PaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden">
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
  onConfirm: (payments: PaymentEntry[], customerName: string) => void
  isProcessing: boolean
  onCancel: () => void
}) {
  const { cart, cartSubtotal, posType, selectedTable } = useAppStore()
  const [payments, setPayments] = useState<PaymentEntry[]>([{ method: 'EFECTIVO', amount: 0 }])
  const [cashReceived, setCashReceived] = useState<string>('')
  const [customerName, setCustomerName] = useState('')
  const [numPadInput, setNumPadInput] = useState<string>('')
  const [activePaymentIndex, setActivePaymentIndex] = useState<number>(0)

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
  const total = subtotal
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = total - totalPaid

  const cashPaymentIndex = payments.findIndex((p) => p.method === 'EFECTIVO')
  const cashReceivedNum = parseFloat(cashReceived) || 0
  const cashChange = cashPaymentIndex >= 0 ? cashReceivedNum - payments[cashPaymentIndex].amount : 0

  // Validation rules
  const canConfirm = totalPaid >= total && total > 0

  const handlePaymentAmountChange = (index: number, value: string) => {
    const amount = parseFloat(value) || 0
    const newPayments = [...payments]
    newPayments[index] = { ...newPayments[index], amount }
    setPayments(newPayments)
  }

  const handlePaymentMethodChange = (index: number, method: string) => {
    const newPayments = [...payments]
    const newMethod = method as PaymentMethod
    newPayments[index] = { ...newPayments[index], method: newMethod }
    
    if (method === 'EFECTIVO') {
      // If switching to EFECTIVO, reset cash received
      setCashReceived('')
    }
    
    setPayments(newPayments)
  }

  const addPaymentEntry = () => {
    const nextMethod = payments.length === 0 ? 'EFECTIVO' : 'TARJETA'
    setPayments([...payments, { method: nextMethod, amount: Math.max(0, remaining) }])
    setActivePaymentIndex(payments.length)
  }

  const removePaymentEntry = (index: number) => {
    const newPayments = payments.filter((_, i) => i !== index)
    setPayments(newPayments)
    if (activePaymentIndex >= newPayments.length) {
      setActivePaymentIndex(Math.max(0, newPayments.length - 1))
    }
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

  // Numeric keyboard functions
  const handleNumPadKey = (key: string) => {
    if (key === 'C') {
      setNumPadInput('')
    } else if (key === '⌫') {
      setNumPadInput(numPadInput.slice(0, -1))
    } else if (key === '00') {
      setNumPadInput(numPadInput + '00')
    } else if (key === '.') {
      if (!numPadInput.includes('.')) {
        setNumPadInput(numPadInput + (numPadInput === '' ? '0.' : '.'))
      }
    } else {
      setNumPadInput(numPadInput + key)
    }
  }

  const applyNumPadToPayment = () => {
    const amount = parseFloat(numPadInput) || 0
    if (activePaymentIndex < payments.length) {
      const newPayments = [...payments]
      newPayments[activePaymentIndex] = { ...newPayments[activePaymentIndex], amount }
      setPayments(newPayments)
      setNumPadInput('')
    }
  }

  const quickAmount = (percentage: number) => {
    if (activePaymentIndex < payments.length) {
      const amount = (total * percentage) / 100
      const newPayments = [...payments]
      newPayments[activePaymentIndex] = { ...newPayments[activePaymentIndex], amount: parseFloat(amount.toFixed(2)) }
      setPayments(newPayments)
    }
  }

  const cashAmounts = [100, 200, 500, 1000, 2000, 5000]

  // Effect to sync cash received with EFECTIVO payment
  useEffect(() => {
    if (cashPaymentIndex >= 0) {
      const currentCashAmount = payments[cashPaymentIndex]?.amount || 0
      if (cashReceivedNum !== currentCashAmount) {
        setCashReceived(currentCashAmount.toString())
      }
    }
  }, [payments, cashPaymentIndex])

  // Effect to auto-focus on active payment when switching
  useEffect(() => {
    if (activePaymentIndex < payments.length) {
      setNumPadInput(payments[activePaymentIndex]?.amount?.toString() || '')
    }
  }, [activePaymentIndex])

  return (
    <div className="flex flex-col h-full">
      <DialogHeader className="shrink-0">
        <DialogTitle className="flex items-center gap-2">
          <Banknote className="w-5 h-5 text-primary" />
          COBRO - CAJA REGISTRADORA
          {isCafeteria && selectedTable && (
            <span className="flex items-center gap-1 text-sm font-normal text-amber-600 dark:text-amber-400 ml-1">
              <Coffee className="w-4 h-4" />
              Mesa #{selectedTable}
            </span>
          )}
        </DialogTitle>
        <DialogDescription>
          Ingresá los medios de pago para procesar la venta.
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-4 py-4">
        {/* Left Column: Sale Summary */}
        <div className="lg:col-span-1 space-y-4">
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
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between items-baseline">
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                TOTAL A PAGAR
              </span>
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                MEDIOS DE PAGO
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPaymentEntry}
                className="h-7 text-xs gap-1"
              >
                <Plus className="h-3 w-3" />
                Agregar
              </Button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {payments.map((payment, index) => {
                const Icon = METHOD_ICONS[payment.method]
                const isActive = index === activePaymentIndex
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                      METHOD_COLORS[payment.method]
                    } ${isActive ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                    onClick={() => setActivePaymentIndex(index)}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-400" />
                    <Badge
                      variant="secondary"
                      className={`text-xs font-medium ${payment.method === 'EFECTIVO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'}`}
                    >
                      {PAYMENT_METHOD_LABELS[payment.method]}
                    </Badge>
                    <div className="flex-1 text-right font-mono text-lg font-semibold">
                      {formatCurrency(payment.amount)}
                    </div>
                    {payments.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          removePaymentEntry(index)
                        }}
                        className="h-6 w-6 shrink-0 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => quickAmount(25)}
                className="h-8 text-xs"
              >
                25%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => quickAmount(50)}
                className="h-8 text-xs"
              >
                50%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => quickAmount(75)}
                className="h-8 text-xs"
              >
                75%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fillRemaining(activePaymentIndex)}
                className="h-8 text-xs"
              >
                100%
              </Button>
            </div>
          </div>

          {/* Cash Quick Amounts */}
          {cashPaymentIndex >= 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                EFECTIVO RÁPIDO
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {cashAmounts.map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newPayments = [...payments]
                      newPayments[cashPaymentIndex] = { 
                        ...newPayments[cashPaymentIndex], 
                        amount: newPayments[cashPaymentIndex].amount + amount 
                      }
                      setPayments(newPayments)
                    }}
                    className="h-10 font-mono"
                  >
                    {formatCurrency(amount)}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Middle Column: Numeric Keyboard */}
        <div className="lg:col-span-1 space-y-4">
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
              TECLADO NUMÉRICO
            </h3>
            
            {/* Current Payment Info */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-500">Monto actual:</span>
                {activePaymentIndex < payments.length && (
                  <Badge variant="secondary" className="text-xs">
                    {PAYMENT_METHOD_LABELS[payments[activePaymentIndex].method]}
                  </Badge>
                )}
              </div>
              <div className="text-center">
                <div className="text-3xl font-mono font-bold text-primary mb-2">
                  {formatCurrency(parseFloat(numPadInput) || 0)}
                </div>
                <div className="text-sm text-slate-500">
                  {numPadInput || '0'}
                </div>
              </div>
            </div>

            {/* Numeric Keyboard */}
            <div className="grid grid-cols-4 gap-2">
              {['7', '8', '9', 'C'].map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => handleNumPadKey(key)}
                  className="h-14 text-lg font-mono"
                >
                  {key}
                </Button>
              ))}
              {['4', '5', '6', '00'].map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => handleNumPadKey(key)}
                  className="h-14 text-lg font-mono"
                >
                  {key}
                </Button>
              ))}
              {['1', '2', '3', '.'].map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => handleNumPadKey(key)}
                  className="h-14 text-lg font-mono"
                >
                  {key}
                </Button>
              ))}
              {['0', '⌫', 'Aplicar'].map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant={key === 'Aplicar' ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => {
                    if (key === 'Aplicar') {
                      applyNumPadToPayment()
                    } else {
                      handleNumPadKey(key)
                    }
                  }}
                  className={`h-14 text-lg font-mono ${key === 'Aplicar' ? 'col-span-2 bg-primary hover:bg-primary/90' : ''}`}
                  disabled={key === 'Aplicar' && !numPadInput}
                >
                  {key}
                </Button>
              ))}
            </div>
          </div>

          {/* Customer Info */}
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
              CLIENTE (OPCIONAL)
            </label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nombre del cliente"
              className="h-10"
            />
          </div>
        </div>

        {/* Right Column: Payment Summary */}
        <div className="lg:col-span-1 space-y-4">
          {/* Payment Summary */}
          <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
              RESUMEN DE PAGO
            </h3>

            <div className="space-y-2">
              {payments.map((payment, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${payment.method === 'EFECTIVO' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}
                    >
                      {PAYMENT_METHOD_LABELS[payment.method]}
                    </Badge>
                    <span className="text-sm text-slate-500">
                      {index === activePaymentIndex && '(actual)'}
                    </span>
                  </div>
                  <span className="font-mono font-semibold">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
              ))}

              <Separator />

              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total pagado:</span>
                <span className="font-bold">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total a pagar:</span>
                <span className="font-bold">{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span className={remaining <= 0 ? 'text-emerald-600' : 'text-amber-600'}>
                  {remaining <= 0 ? 'PAGO COMPLETO' : 'RESTANTE'}
                </span>
                <span className={remaining <= 0 ? 'text-emerald-600' : 'text-amber-600'}>
                  {remaining <= 0 ? formatCurrency(totalPaid - total) : formatCurrency(remaining)}
                </span>
              </div>
            </div>
          </div>

          {/* Cash Received & Change */}
          {cashPaymentIndex >= 0 && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                EFECTIVO RECIBIDO
              </h3>
              
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">
                  $
                </span>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={cashReceived}
                  onChange={(e) => {
                    setCashReceived(e.target.value)
                    // Auto-fill payment amount with cash received
                    const newCashAmount = parseFloat(e.target.value) || 0
                    const newPayments = [...payments]
                    newPayments[cashPaymentIndex] = { ...newPayments[cashPaymentIndex], amount: Math.min(newCashAmount, total) }
                    setPayments(newPayments)
                  }}
                  placeholder="0.00"
                  className="pl-8 h-12 text-xl font-semibold"
                />
              </div>

              {cashReceivedNum > 0 && (
                <div className="space-y-2">
                  {cashReceivedNum >= payments[cashPaymentIndex]?.amount && payments[cashPaymentIndex]?.amount > 0 && (
                    <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/30 rounded-lg px-4 py-3 border border-emerald-200 dark:border-emerald-800">
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        🔄 VUELTO
                      </span>
                      <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(cashChange)}
                      </span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-center p-2 bg-slate-100 dark:bg-slate-800 rounded">
                      <div className="text-slate-500">Recibido</div>
                      <div className="font-semibold">{formatCurrency(cashReceivedNum)}</div>
                    </div>
                    <div className="text-center p-2 bg-slate-100 dark:bg-slate-800 rounded">
                      <div className="text-slate-500">Paga</div>
                      <div className="font-semibold">{formatCurrency(payments[cashPaymentIndex]?.amount || 0)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status Summary */}
          <div className={`rounded-xl p-4 border ${
            remaining <= 0
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${
                remaining <= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
              }`}>
                {remaining <= 0 ? '✅ LISTO PARA COBRAR' : '⏳ PAGO INCOMPLETO'}
              </span>
              <ChevronRight className={`w-4 h-4 ${
                remaining <= 0 ? 'text-emerald-500' : 'text-amber-500'
              }`} />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Total:</span>
                <span className="font-semibold">{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Pagado:</span>
                <span className="font-semibold">{formatCurrency(totalPaid)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm font-bold">
                <span>Estado:</span>
                <span className={remaining <= 0 ? 'text-emerald-600' : 'text-amber-600'}>
                  {remaining <= 0 ? 'COMPLETADO' : `FALTAN ${formatCurrency(remaining)}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter className="shrink-0 pt-4 border-t">
        <Button
          variant="outline"
          onClick={onCancel}
          className="mr-2"
        >
          Cancelar
        </Button>
        <Button
          onClick={() => onConfirm(payments, customerName)}
          disabled={!canConfirm || isProcessing}
          className="bg-emerald-600 hover:bg-emerald-700 shadow-sm text-white min-w-[160px] h-12 text-lg font-semibold"
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              PROCESANDO...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Check className="w-5 h-5" />
              {remaining <= 0 ? 'CONFIRMAR COBRO' : 'COBRAR PARCIAL'}
            </span>
          )}
        </Button>
      </DialogFooter>
    </div>
  )
}