'use client'

import { formatCurrency } from '@/lib/format'
import { PAYMENT_METHOD_LABELS, normalizePaymentMethod } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Printer, Check, Coffee } from 'lucide-react'

interface SalePaymentData {
  id: string
  method: string
  amount: number
}

interface SaleData {
  id: string
  invoiceNumber: string
  paymentMethod: string
  subtotal: number
  discount: number
  total: number
  costTotal: number
  tableNumber?: number | null
  customerName?: string | null
  notes?: string | null
  createdAt: string
  items: SaleItemData[]
  payments?: SalePaymentData[]
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

interface ReceiptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sale: SaleData | null
}

export function ReceiptDialog({ open, onOpenChange, sale }: ReceiptDialogProps) {
  if (!sale) return null

  const handlePrint = () => {
    window.print()
  }

  const formattedDate = new Date(sale.createdAt).toLocaleString('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Venta Procesada
          </DialogTitle>
          <DialogDescription>
            Comprobante de venta generado correctamente.
          </DialogDescription>
        </DialogHeader>

        <div className="print:px-0" id="receipt-content">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 space-y-3 font-mono text-sm">
            {/* Header */}
            <div className="text-center">
              <p className="font-bold text-base text-slate-900 dark:text-slate-100">
                KioskoApp
              </p>
              <p className="text-slate-500 text-xs mt-0.5">
                Comprobante de Venta
              </p>
            </div>

            <Separator />

            {/* Sale Info */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Comprobante</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {sale.invoiceNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha</span>
                <span className="text-slate-900 dark:text-slate-100">
                  {formattedDate}
                </span>
              </div>
              {sale.tableNumber && (
                <div className="flex justify-between">
                  <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                    <Coffee className="w-3 h-3" />
                    Mesa
                  </span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">
                    #{sale.tableNumber}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Pago</span>
                <span className="text-slate-900 dark:text-slate-100">
                  {sale.payments && sale.payments.length > 0
                    ? sale.payments.map((p) =>
                        `${PAYMENT_METHOD_LABELS[normalizePaymentMethod(p.method)] || p.method}: ${formatCurrency(p.amount)}`
                      ).join(' + ')
                    : PAYMENT_METHOD_LABELS[normalizePaymentMethod(sale.paymentMethod)] || sale.paymentMethod
                  }
                </span>
              </div>
              {sale.customerName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Cliente</span>
                  <span className="text-slate-900 dark:text-slate-100">
                    {sale.customerName}
                  </span>
                </div>
              )}
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-2">
              {sale.items.map((item) => (
                <div key={item.id} className="space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-slate-900 dark:text-slate-100 truncate max-w-[60%]">
                      {item.product.name}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>
                      {item.quantity} x {formatCurrency(item.salePrice)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span>{formatCurrency(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Descuento</span>
                  <span className="text-red-600 dark:text-red-400">
                    -{formatCurrency(sale.discount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base">
                <span className="text-slate-900 dark:text-slate-100">Total</span>
                <span className="text-slate-900 dark:text-slate-100">
                  {formatCurrency(sale.total)}
                </span>
              </div>
            </div>

            {sale.paymentMethod === 'CUENTA_CASA' && (
              <>
                <Separator />
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded p-2">
                  <div className="flex justify-between text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">
                    <span>💵 Venta al costo</span>
                    <span>CUENTA CASA</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-amber-600 dark:text-amber-400">
                      Costo total
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                      {formatCurrency(sale.costTotal)}
                    </span>
                  </div>
                </div>
              </>
            )}

            {sale.notes && (
              <>
                <Separator />
                <div className="text-xs text-slate-500">
                  Nota: {sale.notes}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handlePrint}
            className="mr-2"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-slate-800 hover:bg-slate-700 shadow-sm text-white"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
