'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/format'
import { ProductGrid } from '@/components/pos/product-grid'
import { CartPanel } from '@/components/pos/cart-panel'
import { CashOpenDialog } from '@/components/pos/cash-open-dialog'
import { CashCloseDialog } from '@/components/pos/cash-close-dialog'
import { PaymentDialog } from '@/components/pos/payment-dialog'
import { ReceiptDialog } from '@/components/pos/receipt-dialog'
import { Button } from '@/components/ui/button'
import {
  Lock,
  Unlock,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

interface CashRegisterData {
  id: string
  openingAmount: number
  status: string
  openingBillBreakdown: string | null
  closingBillBreakdown: string | null
  sales: SaleData[]
  movements: MovementData[]
  openedAt: string
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

export function POSView() {
  const {
    cart,
    clearCart,
    selectedPaymentMethod,
    currentCashRegisterId,
    setCurrentCashRegisterId,
    cartSubtotal,
  } = useAppStore()

  const queryClient = useQueryClient()

  const [cashOpenDialogOpen, setCashOpenDialogOpen] = useState(false)
  const [cashCloseDialogOpen, setCashCloseDialogOpen] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false)
  const [lastSale, setLastSale] = useState<SaleData | null>(null)
  const [discount, setDiscount] = useState(0)

  // Fetch current cash register
  const { data: cashRegister } = useQuery<CashRegisterData | null>({
    queryKey: ['cash-register'],
    queryFn: async () => {
      const res = await fetch('/api/cash-register')
      if (!res.ok) throw new Error('Error cargando caja')
      const data = await res.json()
      return data || null
    },
  })

  // Sync cash register ID with store
  useEffect(() => {
    if (cashRegister && cashRegister.status === 'ABIERTA') {
      setCurrentCashRegisterId(cashRegister.id)
    } else {
      setCurrentCashRegisterId(null)
    }
  }, [cashRegister, setCurrentCashRegisterId])

  // Process sale mutation
  const processSaleMutation = useMutation({
    mutationFn: async () => {
      if (!currentCashRegisterId) {
        throw new Error('No hay una caja abierta')
      }
      if (cart.length === 0) {
        throw new Error('El carrito está vacío')
      }

      const subtotal = cartSubtotal()
      if (discount > subtotal) {
        throw new Error('El descuento no puede superar el subtotal')
      }

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashRegisterId: currentCashRegisterId,
          paymentMethod: selectedPaymentMethod,
          discount,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al procesar la venta')
      }

      return res.json()
    },
    onSuccess: (data) => {
      toast.success(`Venta ${data.invoiceNumber} procesada correctamente`)
      setLastSale(data)
      setPaymentDialogOpen(false)
      setReceiptDialogOpen(true)
      clearCart()
      setDiscount(0)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['cash-register'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const isOpen = currentCashRegisterId !== null

  const handleOpenPaymentDialog = () => {
    if (!currentCashRegisterId) {
      toast.error('Abrí la caja para poder cobrar')
      return
    }
    if (cart.length === 0) return
    setPaymentDialogOpen(true)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 h-full p-4 lg:p-5">
      {/* Left Side - Product Selection */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <ProductGrid />
      </div>

      {/* Right Side - Cart & Payment */}
      <div className="w-full lg:w-[380px] xl:w-[400px] shrink-0 flex flex-col min-h-0">
        {/* Cash Register Status Bar */}
        <div className="mb-3 shrink-0">
          <div
            className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
              isOpen
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isOpen
                    ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                    : 'bg-red-500 shadow-sm shadow-red-500/50'
                }`}
              />
              <span
                className={`text-sm font-semibold ${
                  isOpen
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-700 dark:text-red-400'
                }`}
              >
                {isOpen ? 'Caja Abierta' : 'Caja Cerrada'}
              </span>
              {isOpen && cashRegister && (
                <span className="text-xs text-slate-500">
                  Apertura: {formatCurrency(cashRegister.openingAmount)}
                </span>
              )}
            </div>

            {isOpen ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCashCloseDialogOpen(true)}
                className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-950/30"
              >
                <Lock className="w-3.5 h-3.5 mr-1" />
                Cerrar Caja
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setCashOpenDialogOpen(true)}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Unlock className="w-3.5 h-3.5 mr-1" />
                Abrir Caja
              </Button>
            )}
          </div>
        </div>

        {/* Cart Panel */}
        <div className="flex-1 min-h-0">
          <CartPanel
            discount={discount}
            onDiscountChange={setDiscount}
            onProcessSale={handleOpenPaymentDialog}
            isProcessing={processSaleMutation.isPending}
          />
        </div>
      </div>

      {/* Dialogs */}
      <CashOpenDialog
        open={cashOpenDialogOpen}
        onOpenChange={setCashOpenDialogOpen}
      />
      <CashCloseDialog
        open={cashCloseDialogOpen}
        onOpenChange={setCashCloseDialogOpen}
        cashRegisterData={cashRegister}
      />
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        onConfirm={() => processSaleMutation.mutate()}
        isProcessing={processSaleMutation.isPending}
      />
      <ReceiptDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        sale={lastSale}
      />
    </div>
  )
}
