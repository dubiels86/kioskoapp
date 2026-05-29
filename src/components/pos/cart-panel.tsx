'use client'

import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/format'
import type { PaymentMethod, CartItem } from '@/lib/types'
import { PAYMENT_METHOD_LABELS } from '@/lib/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import {
  Minus,
  Plus,
  Trash2,
  ShoppingCart,
  Banknote,
  ArrowRightLeft,
  Home,
  AlertCircle,
} from 'lucide-react'

interface CartPanelProps {
  discount: number
  onDiscountChange: (discount: number) => void
  onProcessSale: () => void
  isProcessing: boolean
}

const PAYMENT_METHODS: {
  value: PaymentMethod
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  {
    value: 'EFECTIVO',
    label: PAYMENT_METHOD_LABELS.EFECTIVO,
    icon: Banknote,
  },
  {
    value: 'TRANSFERENCIA',
    label: PAYMENT_METHOD_LABELS.TRANSFERENCIA,
    icon: ArrowRightLeft,
  },
  {
    value: 'CUENTA_CASA',
    label: PAYMENT_METHOD_LABELS.CUENTA_CASA,
    icon: Home,
  },
]

export function CartPanel({
  discount,
  onDiscountChange,
  onProcessSale,
  isProcessing,
}: CartPanelProps) {
  const {
    cart,
    removeFromCart,
    updateCartItemQuantity,
    clearCart,
    cartSubtotal,
    cartCostTotal,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    currentCashRegisterId,
  } = useAppStore()

  const subtotal = cartSubtotal()
  const costTotal = cartCostTotal()
  const total = subtotal - discount
  const isCuentaCasa = selectedPaymentMethod === 'CUENTA_CASA'
  const isCartEmpty = cart.length === 0
  const canProcess = !isCartEmpty && currentCashRegisterId !== null

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Cart Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="font-bold text-lg text-slate-900 dark:text-slate-100">
            Carrito
          </h2>
          {cart.length > 0 && (
            <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-0 h-6 min-w-6 flex items-center justify-center text-xs font-bold px-1.5">
              {cart.length}
            </Badge>
          )}
        </div>
        {cart.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCart}
            className="text-slate-500 hover:text-red-600 text-xs h-8"
          >
            Limpiar
          </Button>
        )}
      </div>

      {/* Cart Items */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3">
          {isCartEmpty ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <ShoppingCart className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm font-medium">Carrito vacío</p>
              <p className="text-xs mt-0.5">
                Hacé clic en un producto para agregarlo
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <CartItemRow
                  key={item.productId}
                  item={item}
                  onUpdateQuantity={updateCartItemQuantity}
                  onRemove={removeFromCart}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Cart Summary */}
      {!isCartEmpty && (
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 px-4 py-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {formatCurrency(subtotal)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Label
              htmlFor="discount"
              className="text-sm text-slate-500 shrink-0"
            >
              Descuento
            </Label>
            <div className="relative w-32">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                $
              </span>
              <Input
                id="discount"
                type="number"
                min={0}
                max={subtotal}
                step={0.01}
                value={discount || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  onDiscountChange(isNaN(val) ? 0 : Math.max(0, Math.min(val, subtotal)))
                }}
                className="h-8 text-right text-sm pl-6 pr-2"
              />
            </div>
          </div>

          <Separator />

          <div className="flex justify-between items-baseline">
            <span className="font-bold text-slate-900 dark:text-slate-100">
              Total
            </span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(total)}
            </span>
          </div>

          {isCuentaCasa && (
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-500">Costo Total</span>
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                {formatCurrency(costTotal)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Payment Method Selection */}
      <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 px-4 py-3">
        <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
          Método de pago
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((method) => {
            const Icon = method.icon
            const isSelected = selectedPaymentMethod === method.value
            return (
              <button
                key={method.value}
                onClick={() => setSelectedPaymentMethod(method.value)}
                className={`
                  flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all duration-150 min-h-[60px]
                  ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold leading-tight text-center">
                  {method.label}
                </span>
              </button>
            )
          })}
        </div>
        {isCuentaCasa && (
          <div className="flex items-start gap-1.5 mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-tight">
              Las ventas &quot;Cuenta Casa / Merma&quot; se registran en reportes
              al precio de costo.
            </p>
          </div>
        )}
      </div>

      {/* Process Sale Button */}
      <div className="shrink-0 px-4 pb-4 pt-1">
        <Button
          onClick={onProcessSale}
          disabled={!canProcess || isProcessing}
          className="w-full h-13 text-base font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:shadow-none"
          size="lg"
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Procesando...
            </span>
          ) : (
            'Cobrar'
          )}
        </Button>
        {currentCashRegisterId === null && !isCartEmpty && (
          <p className="text-[10px] text-red-500 text-center mt-1.5">
            Abrí la caja para poder cobrar
          </p>
        )}
      </div>
    </div>
  )
}

function CartItemRow({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: CartItem
  onUpdateQuantity: (productId: string, quantity: number) => void
  onRemove: (productId: string) => void
}) {
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate leading-tight">
          {item.productName}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {formatCurrency(item.salePrice)} c/u
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 rounded-lg"
          onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
        >
          <Minus className="w-3 h-3" />
        </Button>
        <span className="w-7 text-center text-sm font-bold text-slate-900 dark:text-slate-100">
          {item.quantity}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 rounded-lg"
          disabled={item.quantity >= item.stock}
          onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex flex-col items-end shrink-0">
        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(item.subtotal)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500"
          onClick={() => onRemove(item.productId)}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}
