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
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Lock,
  Unlock,
  Warehouse,
  Coffee,
  ArrowLeft,
} from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import type { WarehouseType, PaymentEntry } from '@/lib/types'
import type { PaymentResult } from '@/components/pos/payment-dialog'
import type { PosType } from '@/lib/store'

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
  cashReceived?: number | null
  changeAmount?: number | null
  tableNumber: number | null
  customerName?: string | null
  items: SaleItemData[]
  payments: SalePaymentData[]
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

function parsePosTypeFromSettings(settings: Record<string, { key: string; value: string; label: string }[]> | undefined): { posType: PosType; posTables: number } {
  const result = { posType: 'kiosko' as PosType, posTables: 10 }
  if (!settings?.pos) return result
  for (const s of settings.pos) {
    try {
      const val = JSON.parse(s.value)
      if (s.key === 'pos_type') result.posType = val === 'cafeteria' ? 'cafeteria' : 'kiosko'
      if (s.key === 'pos_tables') result.posTables = typeof val === 'number' ? val : parseInt(val) || 10
    } catch {
      // ignore
    }
  }
  return result
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
    posType,
    setPosType,
    posTables,
    setPosTables,
    selectedTable,
    setSelectedTable,
    tableCarts,
  } = useAppStore()

  const queryClient = useQueryClient()

  const [cashOpenDialogOpen, setCashOpenDialogOpen] = useState(false)
  const [cashCloseDialogOpen, setCashCloseDialogOpen] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false)
  const [lastSale, setLastSale] = useState<SaleData | null>(null)
  const [discount, setDiscount] = useState(0)

  // Fetch settings for POS type
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Error cargando configuración')
      return res.json() as Record<string, { key: string; value: string; label: string }[]>
    },
  })

  // Sync POS settings from server to store
  const parsedPos = useMemo(() => parsePosTypeFromSettings(settings), [settings])
  useEffect(() => {
    if (parsedPos.posType !== posType) setPosType(parsedPos.posType)
    if (parsedPos.posTables !== posTables) setPosTables(parsedPos.posTables)
  }, [parsedPos, posType, posTables, setPosType, setPosTables])

  const isCafeteria = posType === 'cafeteria'

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

  // Process sale with payments
  const handleProcessSale = (result: PaymentResult) => {
    processSaleMutation.mutate(result)
  }

  // Process sale mutation
  const processSaleMutation = useMutation({
    mutationFn: async ({ payments, customerName, cashReceived, changeAmount }: PaymentResult) => {
      if (!currentCashRegisterId) {
        throw new Error('No hay una caja abierta')
      }
      if (cart.length === 0) {
        throw new Error('El carrito está vacío')
      }
      if (!selectedWarehouseId) {
        throw new Error('No se pudo determinar el depósito de ventas')
      }
      if (isCafeteria && !selectedTable) {
        throw new Error('Seleccioná una mesa para la venta')
      }

      const subtotal = cartSubtotal()
      if (discount > subtotal) {
        throw new Error('El descuento no puede superar el subtotal')
      }

      // Determine primary payment method
      const primaryMethod = payments.length === 1
        ? payments[0].method
        : 'MIXTO'

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashRegisterId: currentCashRegisterId,
          paymentMethod: primaryMethod,
          discount,
          warehouseId: selectedWarehouseId,
          customerName: customerName || undefined,
          tableNumber: isCafeteria ? selectedTable : undefined,
          cashReceived: cashReceived || undefined,
          changeAmount: changeAmount || undefined,
          payments: payments.map((p) => ({ method: p.method, amount: p.amount })),
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
      // In cafeteria mode, keep the table selected for convenience
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
    if (isCafeteria && !selectedTable) {
      toast.error('Seleccioná una mesa primero')
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
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/50">
            <Warehouse className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 shrink-0">
              Almacén:
            </span>
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200 flex-1">
              {selectedWarehouse?.name || 'Cargando...'}
            </span>
            {selectedWarehouse && (
              <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 hidden sm:inline">
                ({selectedWarehouse.type === 'VENTAS' ? 'Ventas' : selectedWarehouse.type === 'PRINCIPAL' ? 'Principal' : 'Secundario'})
              </span>
            )}
          </div>

          {/* Table Selector - only in cafeteria mode */}
          {isCafeteria && (
            <div className="px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Coffee className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    Mesas
                  </span>
                  {selectedTable && (
                    <span className="text-lg font-bold text-amber-800 dark:text-amber-300">
                      #{selectedTable}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {Object.keys(tableCarts).length > 0 && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      {Object.keys(tableCarts).length} {Object.keys(tableCarts).length === 1 ? 'mesa activa' : 'mesas activas'}
                    </span>
                  )}
                  {selectedTable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTable(null)}
                      className="h-6 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-950/30"
                    >
                      <ArrowLeft className="w-3 h-3 mr-1" />
                      Quitar
                    </Button>
                  )}
                </div>
              </div>
              <ScrollArea className="max-h-24">
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: posTables }, (_, i) => i + 1).map((tableNum) => {
                    const hasActiveOrder = (tableCarts[tableNum] || []).length > 0;
                    const isSelected = tableNum === selectedTable;
                    return (
                      <button
                        key={tableNum}
                        onClick={() => setSelectedTable(isSelected ? null : tableNum)}
                        className={`relative min-w-[36px] h-8 rounded-lg text-xs font-bold transition-all border ${
                          isSelected
                            ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                            : hasActiveOrder
                              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-400 dark:border-amber-600 hover:border-amber-500'
                              : 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 hover:border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/30'
                        }`}
                      >
                        {tableNum}
                        {hasActiveOrder && !isSelected && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-amber-50 dark:border-amber-950/20" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Cash Register Status */}
          <div
            className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
              isOpen
                ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200/70 dark:border-emerald-800/50'
                : 'bg-gradient-to-r from-rose-50 to-red-50 border-rose-200/70 dark:from-rose-950/20 dark:to-red-950/20 dark:border-rose-800/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isOpen
                    ? 'bg-emerald-500 shadow-sm'
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
                className="h-8 text-xs bg-slate-800 hover:bg-slate-700 text-white shadow-sm"
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
        onConfirm={handleProcessSale}
        isProcessing={processSaleMutation.isPending}
        discount={discount}
      />
      <ReceiptDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        sale={lastSale}
      />
    </div>
  )
}
