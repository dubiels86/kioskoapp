'use client'

import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/types'
import type { PaymentMethod } from '@/lib/types'

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
    sales: Sale[]
    movements: CashMovement[]
  }
}

export function CashCloseDialog({ open, onOpenChange, cashRegister }: CashCloseDialogProps) {
  const [closingAmount, setClosingAmount] = useState('')
  const queryClient = useQueryClient()
  const { setCurrentCashRegisterId } = useAppStore()

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

  const parsedClosing = parseFloat(closingAmount)
  const difference = isNaN(parsedClosing) ? 0 : parsedClosing - expectedAmount

  const mutation = useMutation({
    mutationFn: async (data: { cashRegisterId: string; closingAmount: number }) => {
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
      setClosingAmount('')
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isNaN(parsedClosing) || parsedClosing < 0) {
      toast.error('Ingrese un monto válido')
      return
    }
    mutation.mutate({ cashRegisterId: cashRegister.id, closingAmount: parsedClosing })
  }

  const methodBadgeColors: Record<string, string> = {
    EFECTIVO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    TRANSFERENCIA: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    CUENTA_CASA: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cerrar Caja</DialogTitle>
          <DialogDescription>
            Revise el resumen y confirme el cierre de la caja registradora.
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
              <span>Total Esperado</span>
              <span>{formatCurrency(expectedAmount)}</span>
            </div>
          </div>

          {/* Closing Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="closingAmount">Monto Contado en Caja</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                id="closingAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)}
                className="pl-7 text-lg font-semibold"
                autoFocus
              />
            </div>
          </div>

          {/* Difference */}
          {closingAmount && !isNaN(parsedClosing) && (
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending || !closingAmount}
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
