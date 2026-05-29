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
  Warehouse,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import type { WarehouseType } from '@/lib/types'

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

interface WarehouseData {
  id: string
  name: string
  code: string
  type: WarehouseType
  address?: string | null
  isActive: boolean
  stockSummary: {
    totalStock: number
    totalProducts: number
    lowStockCount: number
  }
}

export function POSView() {
  const {
    cart,
    clearCart,
    selectedPaymentMethod,
    currentCashRegisterId,
    setCurrentCashRegisterId,
    cartSubtotal,
    selectedWarehouseId,
    setSelectedWarehouseId,
  } = useAppStore()

  const queryClient = useQueryClient()

  const [cashOpenDialogOpen, setCashOpenDialogOpen] = useState(false)
  const [cashCloseDialogOpen, setCashCloseDialogOpen] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false)
  const [lastSale, setLastSale] = useState<SaleData | null>(null)
  const [discount, setDiscount] = useState(0)

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery<WarehouseData[]>({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await fetch('/api/warehouses')
      if (!res.ok) throw new Error('Error cargando depósitos')
      return res.json()
    },
  })

  // Auto-select VENTAS warehouse on mount if none selected
  useEffect(() => {
    if (!selectedWarehouseId && warehouses.length > 0) {
      const ventasWarehouse = warehouses.find((w) => w.type === 'VENTAS')
      if (ventasWarehouse) {
        setSelectedWarehouseId(ventasWarehouse.id)
      } else {
        // Fallback to first active warehouse
        setSelectedWarehouseId(warehouses[0].id)
      }
    }
  }, [warehouses, selectedWarehouseId, setSelectedWarehouseId])

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
      if (!selectedWarehouseId) {
        throw new Error('No se pudo determinar el depósito de ventas')
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
          warehouseId: selectedWarehouseId,
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
    if (!selectedWarehouseId) {
      toast.error('No se pudo determinar el depósito de ventas')
      return
    }
    setPaymentDialogOpen(true)
  }

  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId)

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 h-full p-4 lg:p-5">
      {/* Left Side - Product Selection */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <ProductGrid warehouseId={selectedWarehouseId} />
      </div>

      {/* Right Side - Cart & Payment */}
      <div className="w-full lg:w-[380px] xl:w-[400px] shrink-0 flex flex-col min-h-0">
        {/* Warehouse Info & Cash Register Status Bar */}
        <div className="mb-3 shrink-0 space-y-2">
          {/* Warehouse Info (read-only, auto-set to VENTAS) */}
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/20 dark:to-emerald-950/20 border border-teal-200/60 dark:border-teal-800/50">
            <Warehouse className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <span className="text-sm font-semibold text-teal-700 dark:text-teal-300 shrink-0">
              Almacén:
            </span>
            <span className="text-sm font-medium text-teal-800 dark:text-teal-200 flex-1">
              {selectedWarehouse?.name || 'Cargando...'}
            </span>
            {selectedWarehouse && (
              <span className="text-xs text-teal-500 dark:text-teal-400 shrink-0 hidden sm:inline">
                ({selectedWarehouse.type === 'VENTAS' ? 'Ventas' : selectedWarehouse.type === 'PRINCIPAL' ? 'Principal' : 'Secundario'})
              </span>
            )}
          </div>

          {/* Cash Register Status */}
          <div
            className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
              isOpen
                ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200/70 dark:from-emerald-950/20 dark:to-green-950/20 dark:border-emerald-800/50'
                : 'bg-gradient-to-r from-rose-50 to-red-50 border-rose-200/70 dark:from-rose-950/20 dark:to-red-950/20 dark:border-rose-800/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isOpen
                    ? 'bg-emerald-500 shadow-sm shadow-emerald-500/60'
                    : 'bg-rose-500 shadow-sm shadow-rose-500/60'
                }`}
              />
              <span
                className={`text-sm font-semibold ${
                  isOpen
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-700 dark:text-rose-400'
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
                className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-950/30"
              >
                <Lock className="w-3.5 h-3.5 mr-1" />
                Cerrar Caja
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setCashOpenDialogOpen(true)}
                className="h-8 text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm shadow-emerald-600/20"
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
