'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/format'
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
  const [closingAmount, setClosingAmount] = useState<string>('')
  const queryClient = useQueryClient()

  const closeRegisterMutation = useMutation({
    mutationFn: async (data: { cashRegisterId: string; closingAmount: number }) => {
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
      setClosingAmount('')
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

  const countedAmount = parseFloat(closingAmount) || 0
  const difference = countedAmount - expectedAmount

  const handleClose = () => {
    if (isNaN(countedAmount)) {
      toast.error('Ingresá un monto válido')
      return
    }
    closeRegisterMutation.mutate({
      cashRegisterId: id,
      closingAmount: countedAmount,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-600" />
            Cerrar Caja
          </DialogTitle>
          <DialogDescription>
            Resumen de la sesión de caja y conteo final.
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

          {/* Cash count input */}
          <section>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Conteo de Efectivo
            </h3>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                $
              </span>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)}
                placeholder="0.00"
                className="pl-7 h-12 text-lg font-semibold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleClose()
                }}
              />
            </div>
          </section>

          {/* Difference */}
          {closingAmount && !isNaN(countedAmount) && (
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
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0'
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
            onClick={() => onOpenChange(false)}
            className="mr-2"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleClose}
            disabled={closeRegisterMutation.isPending || !closingAmount}
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
