'use client'

import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/format'
import { BillBreakdownInput, BillBreakdownDisplay, breakdownToJSON, calculateBreakdownTotal, jsonToBreakdown } from '@/components/cash/bill-breakdown-input'
import type { BillBreakdown } from '@/components/cash/bill-breakdown-input'
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
import { Banknote, AlertCircle, Check } from 'lucide-react'
import { toast } from 'sonner'

interface CashCloseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cashRegisterData: CashRegisterData | null
}

interface CashRegisterData {
  id: string
  openingAmount: number
  openingBillBreakdown: string | null
  sales: SaleData[]
  movements: MovementData[]
}

interface SaleData {
  id: string
  invoiceNumber: string
  paymentMethod: string
  subtotal: number
  discount: number
  total: number
  costTotal: number
  items: SaleItemData[]
  createdAt: string
}

interface SaleItemData {
  id: string
  productId: string
  quantity: number
  costPrice: number
  salePrice: number
  subtotal: number
  costSubtotal: number
  product: { name: string }
}

interface MovementData {
  id: string
  type: string
  amount: number
  reason: string
  createdAt: string
}

export function CashCloseDialog({
  open,
  onOpenChange,
  cashRegisterData,
}: CashCloseDialogProps) {
  const { setCurrentCashRegisterId } = useAppStore()
  const [manualClosingAmount, setManualClosingAmount] = useState<string>('')
  const [billBreakdown, setBillBreakdown] = useState<BillBreakdown>({})
  const [useBreakdown, setUseBreakdown] = useState(true)
  const queryClient = useQueryClient()

  const breakdownTotal = useMemo(() => calculateBreakdownTotal(billBreakdown), [billBreakdown])
  const effectiveClosingAmount = useBreakdown ? breakdownTotal : (parseFloat(manualClosingAmount) || 0)

  const closeRegisterMutation = useMutation({
    mutationFn: async (data: { cashRegisterId: string; closingAmount: number; billBreakdown: string | null }) => {
      const res = await fetch('/api/cash-register?action=close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const resp = await res.json()
        throw new Error(resp.error || 'Error al cerrar caja')
      }
      return res.json()
    },
    onSuccess: () => {
      setCurrentCashRegisterId(null)
      queryClient.invalidateQueries({ queryKey: ['cash-register'] })
      toast.success('Caja cerrada correctamente')
      setManualClosingAmount('')
      setBillBreakdown({})
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Calculate totals (safe with null data)
  const id = cashRegisterData?.id ?? ''
  const openingAmount = cashRegisterData?.openingAmount ?? 0
  const sales = cashRegisterData?.sales ?? []
  const movements = cashRegisterData?.movements ?? []

  const efectivoSales = sales
    .filter((s) => s.paymentMethod === 'EFECTIVO')
    .reduce((sum, s) => sum + s.total, 0)

  const transferenciaSales = sales
    .filter((s) => s.paymentMethod === 'TRANSFERENCIA')
    .reduce((sum, s) => sum + s.total, 0)

  const cuentaCasaCost = sales
    .filter((s) => s.paymentMethod === 'CUENTA_CASA')
    .reduce((sum, s) => sum + s.costTotal, 0)

  const cuentaCasaSale = sales
    .filter((s) => s.paymentMethod === 'CUENTA_CASA')
    .reduce((sum, s) => sum + s.total, 0)

  const totalGeneral =
    efectivoSales + transferenciaSales + cuentaCasaSale

  const entradaMovements = movements
    .filter((m) => m.type === 'ENTRADA')
    .reduce((sum, m) => sum + m.amount, 0)

  const salidaMovements = movements
    .filter((m) => m.type === 'SALIDA')
    .reduce((sum, m) => sum + m.amount, 0)

  const expectedAmount =
    openingAmount + efectivoSales + entradaMovements - salidaMovements

  const difference = effectiveClosingAmount - expectedAmount

  // Opening breakdown display
  const openingBreakdown = useMemo(() => jsonToBreakdown(cashRegisterData?.openingBillBreakdown), [cashRegisterData?.openingBillBreakdown])

  const handleClose = () => {
    if (isNaN(effectiveClosingAmount) || effectiveClosingAmount < 0) {
      toast.error('Ingresá un monto válido')
      return
    }
    closeRegisterMutation.mutate({
      cashRegisterId: id,
      closingAmount: effectiveClosingAmount,
      billBreakdown: useBreakdown ? breakdownToJSON(billBreakdown) : null,
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setManualClosingAmount('')
      setBillBreakdown({})
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-600" />
            Cerrar Caja
          </DialogTitle>
          <DialogDescription>
            Resumen de la sesión de caja y conteo final por denominación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Ventas por método */}
          <section>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Resumen de Ventas
            </h3>
            <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Ventas en efectivo</span>
                <span className="font-medium">
                  {formatCurrency(efectivoSales)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Ventas por transferencia</span>
                <span className="font-medium">
                  {formatCurrency(transferenciaSales)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Cuenta casa (costo)</span>
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {formatCurrency(cuentaCasaCost)}
                </span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between text-sm font-semibold">
                <span>Total general (venta)</span>
                <span>{formatCurrency(totalGeneral)}</span>
              </div>
            </div>
          </section>

          {/* Movimientos */}
          <section>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Movimientos de Caja
            </h3>
            <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Entradas</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  +{formatCurrency(entradaMovements)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Salidas</span>
                <span className="font-medium text-red-600 dark:text-red-400">
                  -{formatCurrency(salidaMovements)}
                </span>
              </div>
            </div>
          </section>

          {/* Expected calculation */}
          <section>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Cálculo Esperado
            </h3>
            <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Monto apertura</span>
                <span className="font-medium">
                  {formatCurrency(openingAmount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">+ Ventas efectivo</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  +{formatCurrency(efectivoSales)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">+ Entradas</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  +{formatCurrency(entradaMovements)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">- Salidas</span>
                <span className="font-medium text-red-600 dark:text-red-400">
                  -{formatCurrency(salidaMovements)}
                </span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between text-sm font-bold">
                <span>Monto esperado</span>
                <span>{formatCurrency(expectedAmount)}</span>
              </div>
            </div>
          </section>

          {/* Opening Breakdown (if available) */}
          {Object.keys(openingBreakdown).length > 0 && (
            <BillBreakdownDisplay breakdown={openingBreakdown} label="Desglose de Apertura" />
          )}

          <Separator />

          {/* Cash count - Bill Breakdown */}
          <section>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Conteo de Cierre
            </h3>

            {/* Toggle between breakdown and manual input */}
            <div className="flex gap-2 mb-3">
              <Button
                type="button"
                size="sm"
                variant={useBreakdown ? 'default' : 'outline'}
                onClick={() => setUseBreakdown(true)}
                className={useBreakdown ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm' : ''}
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
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    $
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={manualClosingAmount}
                    onChange={(e) => setManualClosingAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-7 h-12 text-lg font-semibold"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleClose()
                    }}
                  />
                </div>
              </div>
            )}
          </section>

          {/* Difference */}
          {effectiveClosingAmount > 0 && (
            <div
              className={`flex items-center justify-between p-3 rounded-xl border ${
                Math.abs(difference) < 0.01
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {Math.abs(difference) < 0.01 ? (
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                )}
                <span className="text-sm font-medium">Diferencia</span>
              </div>
              <Badge
                variant={Math.abs(difference) < 0.01 ? 'default' : 'destructive'}
                className={
                  Math.abs(difference) < 0.01
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30'
                    : ''
                }
              >
                {difference >= 0 ? '+' : ''}
                {formatCurrency(difference)}
              </Badge>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="mr-2"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleClose}
            disabled={closeRegisterMutation.isPending || effectiveClosingAmount <= 0}
            variant="destructive"
          >
            {closeRegisterMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Cerrando...
              </span>
            ) : (
              'Confirmar Cierre'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
