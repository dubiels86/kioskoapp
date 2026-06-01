'use client'

import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Banknote } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/types'
import type { PaymentMethod } from '@/lib/types'
import { BillBreakdownInput, BillBreakdownDisplay, breakdownToJSON, calculateBreakdownTotal, jsonToBreakdown } from '@/components/cash/bill-breakdown-input'
import type { BillBreakdown } from '@/components/cash/bill-breakdown-input'

interface Sale {
  id: string
  invoiceNumber: string
  paymentMethod: string
  total: number
  costTotal: number
  customerName: string | null
  createdAt: string
}

interface CashMovement {
  id: string
  type: string
  amount: number
  reason: string
  createdAt: string
}

interface CashCloseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cashRegister: {
    id: string
    openingAmount: number
    openingBillBreakdown: string | null
    sales: Sale[]
    movements: CashMovement[]
  }
}

export function CashCloseDialog({ open, onOpenChange, cashRegister }: CashCloseDialogProps) {
  const [billBreakdown, setBillBreakdown] = useState<BillBreakdown>({})
  const [useBreakdown, setUseBreakdown] = useState(true)
  const [manualClosingAmount, setManualClosingAmount] = useState('')
  const queryClient = useQueryClient()
  const { setCurrentCashRegisterId } = useAppStore()

  const breakdownTotal = useMemo(() => calculateBreakdownTotal(billBreakdown), [billBreakdown])
  const effectiveClosingAmount = useBreakdown ? breakdownTotal : (parseFloat(manualClosingAmount) || 0)

  const salesSummary = useMemo(() => {
    const summary: Record<string, { count: number; total: number; costTotal: number }> = {
      EFECTIVO: { count: 0, total: 0, costTotal: 0 },
      TRANSFERENCIA: { count: 0, total: 0, costTotal: 0 },
      CUENTA_CASA: { count: 0, total: 0, costTotal: 0 },
    }
    for (const sale of cashRegister.sales) {
      const method = sale.paymentMethod as PaymentMethod
      if (summary[method]) {
        summary[method].count++
        summary[method].total += sale.total
        summary[method].costTotal += sale.costTotal
      }
    }
    return summary
  }, [cashRegister.sales])

  const entradaMovements = useMemo(
    () => cashRegister.movements.filter((m) => m.type === 'ENTRADA').reduce((sum, m) => sum + m.amount, 0),
    [cashRegister.movements]
  )
  const salidaMovements = useMemo(
    () => cashRegister.movements.filter((m) => m.type === 'SALIDA').reduce((sum, m) => sum + m.amount, 0),
    [cashRegister.movements]
  )

  const expectedAmount = useMemo(
    () => cashRegister.openingAmount + salesSummary.EFECTIVO.total + entradaMovements - salidaMovements,
    [cashRegister.openingAmount, salesSummary.EFECTIVO.total, entradaMovements, salidaMovements]
  )

  const difference = effectiveClosingAmount - expectedAmount

  // Opening breakdown display
  const openingBreakdown = useMemo(() => jsonToBreakdown(cashRegister.openingBillBreakdown), [cashRegister.openingBillBreakdown])

  const mutation = useMutation({
    mutationFn: async (data: { cashRegisterId: string; closingAmount: number; billBreakdown: string | null }) => {
      const res = await fetch('/api/cash-register?action=close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al cerrar caja')
      return json
    },
    onSuccess: () => {
      setCurrentCashRegisterId(null)
      queryClient.invalidateQueries({ queryKey: ['cash-register'] })
      toast.success('Caja cerrada correctamente')
      setBillBreakdown({})
      setManualClosingAmount('')
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (effectiveClosingAmount < 0) {
      toast.error('Ingrese un monto válido')
      return
    }
    mutation.mutate({
      cashRegisterId: cashRegister.id,
      closingAmount: effectiveClosingAmount,
      billBreakdown: useBreakdown ? breakdownToJSON(billBreakdown) : null,
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setBillBreakdown({})
      setManualClosingAmount('')
    }
    onOpenChange(newOpen)
  }

  const methodBadgeColors: Record<string, string> = {
    EFECTIVO: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30',
    TRANSFERENCIA: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30',
    CUENTA_CASA: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" />
            Cerrar Caja
          </DialogTitle>
          <DialogDescription>
            Revise el resumen, cuente el efectivo por denominación y confirme el cierre.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Sales Summary */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Resumen de Ventas
            </h4>
            {Object.entries(salesSummary).map(([method, data]) => (
              <div key={method} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={methodBadgeColors[method]}>
                    {PAYMENT_METHOD_LABELS[method as PaymentMethod]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    ({data.count} {data.count === 1 ? 'venta' : 'ventas'})
                  </span>
                </div>
                <span className="font-semibold">{formatCurrency(data.total)}</span>
              </div>
            ))}
          </div>

          <Separator />

          {/* Movements Summary */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Movimientos
            </h4>
            <div className="flex items-center justify-between">
              <span className="text-sm">Entradas</span>
              <span className="font-semibold text-emerald-600">+{formatCurrency(entradaMovements)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Salidas</span>
              <span className="font-semibold text-red-500">-{formatCurrency(salidaMovements)}</span>
            </div>
          </div>

          <Separator />

          {/* Expected Calculation */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Cálculo Esperado
            </h4>
            <div className="flex items-center justify-between text-sm">
              <span>Apertura</span>
              <span>{formatCurrency(cashRegister.openingAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>+ Ventas en Efectivo</span>
              <span className="text-emerald-600">+{formatCurrency(salesSummary.EFECTIVO.total)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>+ Entradas</span>
              <span className="text-emerald-600">+{formatCurrency(entradaMovements)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>- Salidas</span>
              <span className="text-red-500">-{formatCurrency(salidaMovements)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between font-bold">
              <span>Total Esperado en Caja</span>
              <span>{formatCurrency(expectedAmount)}</span>
            </div>
          </div>

          {/* Opening Breakdown (if available) */}
          {Object.keys(openingBreakdown).length > 0 && (
            <BillBreakdownDisplay breakdown={openingBreakdown} label="Desglose de Apertura" />
          )}

          <Separator />

          {/* Cash Count - Bill Breakdown */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Conteo de Cierre
            </h4>

            {/* Toggle between breakdown and manual input */}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={useBreakdown ? 'default' : 'outline'}
                onClick={() => setUseBreakdown(true)}
              >
                Conteo por Denominación
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!useBreakdown ? 'default' : 'outline'}
                onClick={() => setUseBreakdown(false)}
              >
                Ingreso Manual
              </Button>
            </div>

            {useBreakdown ? (
              <BillBreakdownInput
                value={billBreakdown}
                onChange={setBillBreakdown}
                label="Conteo de Efectivo"
              />
            ) : (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Monto Contado en Caja</h4>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={manualClosingAmount}
                    onChange={(e) => setManualClosingAmount(e.target.value)}
                    className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 pl-7 text-lg font-semibold ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    autoFocus
                  />
                </div>
              </div>
            )}
          </div>

          {/* Difference */}
          {effectiveClosingAmount > 0 && (
            <div className={`flex items-center gap-2 rounded-lg p-3 ${
              Math.abs(difference) < 0.01
                ? 'bg-emerald-50 dark:bg-emerald-900/20'
                : 'bg-amber-50 dark:bg-amber-900/20'
            }`}>
              {Math.abs(difference) < 0.01 ? (
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600" />
              )}
              <div>
                <p className="text-sm font-medium">
                  Diferencia: {formatCurrency(difference)}
                </p>
                {Math.abs(difference) >= 0.01 && (
                  <p className="text-xs text-muted-foreground">
                    {difference > 0 ? 'Sobrante en caja' : 'Faltante en caja'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending || effectiveClosingAmount <= 0}
            onClick={handleSubmit}
            className="bg-red-600 hover:bg-red-700"
          >
            {mutation.isPending ? 'Cerrando...' : 'Confirmar Cierre'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
