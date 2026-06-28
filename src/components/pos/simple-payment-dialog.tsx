'use client'

import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/format'
import type { PaymentMethod, PaymentEntry } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Banknote,
  CreditCard,
  Check,
  X,
  Calculator,
  RefreshCw,
} from 'lucide-react'
import { useState, useEffect } from 'react'

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (payments: PaymentEntry[], customerName: string) => void
  isProcessing: boolean
}

export function SimplePaymentDialog({
  open,
  onOpenChange,
  onConfirm,
  isProcessing,
}: PaymentDialogProps) {
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
  onConfirm: (payments: PaymentEntry[], customerName: string) => void
  isProcessing: boolean
  onCancel: () => void
}) {
  const { cart, cartSubtotal, posType, selectedTable } = useAppStore()
  
  // Estado inicial: un pago en EFECTIVO
  const [payments, setPayments] = useState<PaymentEntry[]>([{ method: 'EFECTIVO', amount: 0 }])
  const [cashReceived, setCashReceived] = useState<string>('')
  const [customerName, setCustomerName] = useState('')

  const isCafeteria = posType === 'cafeteria'
  const subtotal = cartSubtotal()
  const total = subtotal
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = total - totalPaid

  // Encontrar el pago en EFECTIVO
  const cashPayment = payments.find((p) => p.method === 'EFECTIVO')
  const cashReceivedNum = parseFloat(cashReceived) || 0
  const cashChange = cashPayment ? cashReceivedNum - cashPayment.amount : 0

  // Validación
  const canConfirm = totalPaid >= total && total > 0

  const handlePaymentAmountChange = (index: number, value: string) => {
    const amount = parseFloat(value) || 0
    const newPayments = [...payments]
    newPayments[index] = { ...newPayments[index], amount }
    setPayments(newPayments)
  }

  const togglePaymentMethod = (index: number) => {
    const newPayments = [...payments]
    const currentMethod = newPayments[index].method
    // Cambiar entre EFECTIVO y TARJETA
    newPayments[index].method = currentMethod === 'EFECTIVO' ? 'TARJETA' : 'EFECTIVO'
    setPayments(newPayments)
  }

  const addPaymentMethod = () => {
    // Solo permitir 2 métodos máximo
    if (payments.length >= 2) return
    
    // Si ya hay EFECTIVO, agregar TARJETA, y viceversa
    const hasCash = payments.some(p => p.method === 'EFECTIVO')
    const nextMethod = hasCash ? 'TARJETA' : 'EFECTIVO'
    
    setPayments([...payments, { method: nextMethod, amount: Math.max(0, remaining) }])
  }

  const removePaymentMethod = (index: number) => {
    if (payments.length === 1) return // No dejar sin métodos de pago
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

  // Efecto para sincronizar efectivo recibido con pago en EFECTIVO
  useEffect(() => {
    if (cashPayment && cashReceivedNum !== cashPayment.amount) {
      const newPayments = [...payments]
      const cashIndex = newPayments.findIndex(p => p.method === 'EFECTIVO')
      if (cashIndex >= 0) {
        newPayments[cashIndex].amount = Math.min(cashReceivedNum, total)
        setPayments(newPayments)
      }
    }
  }, [cashReceivedNum, cashPayment, total])

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Banknote className="w-5 h-5 text-primary" />
          {isCafeteria && selectedTable ? (
            <>
              Cobrar Mesa #{selectedTable}
            </>
          ) : (
            <>
              Cobrar Venta
            </>
          )}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Resumen de la Venta */}
        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Total a pagar:
            </span>
            <span className="text-2xl font-bold text-primary">
              {formatCurrency(total)}
            </span>
          </div>
          {isCafeteria && selectedTable && (
            <div className="mt-2 text-sm text-slate-500">
              Mesa #{selectedTable}
            </div>
          )}
        </div>

        {/* Métodos de Pago */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Medios de Pago</span>
            {payments.length < 2 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPaymentMethod}
                className="h-7 text-xs"
              >
                + Agregar
              </Button>
            )}
          </div>

          {payments.map((payment, index) => (
            <div
              key={index}
              className={`flex items-center gap-2 p-3 rounded-lg border ${
                payment.method === 'EFECTIVO'
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200'
                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200'
              }`}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => togglePaymentMethod(index)}
                className={`h-8 px-2 ${
                  payment.method === 'EFECTIVO'
                    ? 'text-emerald-700 hover:text-emerald-800'
                    : 'text-blue-700 hover:text-blue-800'
                }`}
              >
                {payment.method === 'EFECTIVO' ? (
                  <Banknote className="w-4 h-4" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
              </Button>

              <Badge
                variant="secondary"
                className={`text-xs ${
                  payment.method === 'EFECTIVO'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {payment.method === 'EFECTIVO' ? 'Efectivo' : 'Tarjeta'}
              </Badge>

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
                  className="h-9 text-sm pl-6"
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fillRemaining(index)}
                className="h-8 text-xs px-2 text-slate-600 hover:text-slate-800"
                title="Completar resto"
              >
                <Calculator className="w-3 h-3" />
              </Button>

              {payments.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removePaymentMethod(index)}
                  className="h-8 w-8 text-slate-400 hover:text-red-500"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Efectivo Recibido - Solo si hay pago en EFECTIVO */}
        {cashPayment && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Efectivo recibido
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                $
              </span>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="0.00"
                className="pl-7 h-10 text-lg"
              />
            </div>

            {/* Vuelto para el Cliente */}
            {cashReceivedNum > 0 && cashPayment.amount > 0 && (
              <div className={`p-3 rounded-lg border ${
                cashChange >= 0
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200'
                  : 'bg-amber-50 dark:bg-amber-900/30 border-amber-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {cashChange >= 0 ? 'Vuelto al cliente' : 'Falta dinero'}
                  </span>
                  <span className={`text-lg font-bold ${
                    cashChange >= 0 ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {formatCurrency(Math.abs(cashChange))}
                  </span>
                </div>
                
                {cashChange >= 0 ? (
                  <p className="text-xs text-slate-500 mt-1">
                    El cliente recibirá {formatCurrency(cashChange)} de vuelto
                  </p>
                ) : (
                  <p className="text-xs text-amber-500 mt-1">
                    Falta {formatCurrency(Math.abs(cashChange))} para completar el pago
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Resumen de Pagos */}
        <div className={`p-3 rounded-lg border ${
          remaining <= 0
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200'
            : 'bg-slate-50 dark:bg-slate-900 border-slate-200'
        }`}>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Total a pagar:</span>
              <span className="font-semibold">{formatCurrency(total)}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Total pagado:</span>
              <span className="font-semibold">{formatCurrency(totalPaid)}</span>
            </div>

            <div className="flex justify-between text-sm font-bold">
              <span className={remaining <= 0 ? 'text-emerald-600' : 'text-slate-800'}>
                {remaining <= 0 ? '✅ Pago completo' : '⏳ Resta pagar'}
              </span>
              <span className={remaining <= 0 ? 'text-emerald-600' : 'text-slate-800'}>
                {remaining <= 0 ? formatCurrency(totalPaid - total) : formatCurrency(remaining)}
              </span>
            </div>

            {/* Detalle de pagos si hay múltiples */}
            {payments.length > 1 && (
              <div className="mt-2 pt-2 border-t border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Detalle:</p>
                {payments.map((p, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span>{p.method === 'EFECTIVO' ? 'Efectivo' : 'Tarjeta'}</span>
                    <span>{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nombre del Cliente (Opcional) */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">
            Cliente (opcional)
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
          onClick={() => onConfirm(payments, customerName)}
          disabled={!canConfirm || isProcessing}
          className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Procesando...
            </span>
          ) : (
            <>
              <Check className="w-4 h-4 mr-1.5" />
              {remaining <= 0 ? 'Cobrar' : 'Cobrar parcial'}
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  )
}