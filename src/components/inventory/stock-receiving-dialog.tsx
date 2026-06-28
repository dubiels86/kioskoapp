'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useUsdExchangeRate, calculateUsdPrice, getExchangeRateDisplay } from '@/lib/currency'
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
import { Label } from '@/components/ui/label'
import { CreatableSelect } from '@/components/ui/creatable-select'
import { PackagePlus } from 'lucide-react'
import { toast } from 'sonner'

interface Warehouse {
  id: string
  name: string
  code: string
  type: string
  isActive: boolean
}

interface ProductStock {
  warehouseId: string
  warehouse: {
    id: string
    name: string
    code: string
  }
  stock: number
  minStock: number
}

interface Product {
  id: string
  name: string
  barcode?: string | null
  sku?: string | null
  costPrice: number
  salePrice: number
  stock: number
  stocks: ProductStock[]
}

interface StockReceivingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StockReceivingDialog({ open, onOpenChange }: StockReceivingDialogProps) {
  const queryClient = useQueryClient()

  const [toWarehouseId, setToWarehouseId] = useState('')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('Recepción de stock')
  const [costPrice, setCostPrice] = useState('')
  const [currency, setCurrency] = useState('CUP') // CUP o USD
  const [exchangeRate, setExchangeRate] = useState(1)
  const [usdEquivalent, setUsdEquivalent] = useState('')
  const [loadingExchange, setLoadingExchange] = useState(false)
  const [saving, setSaving] = useState(false)

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await fetch('/api/warehouses')
      if (!res.ok) throw new Error('Error al obtener depósitos')
      return res.json() as Promise<Warehouse[]>
    },
  })

  // Fetch products with stocks
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await fetch('/api/products')
      if (!res.ok) throw new Error('Error al obtener productos')
      return res.json() as Promise<Product[]>
    },
  })

  // Set default warehouse to PRINCIPAL on first load
  useEffect(() => {
    if (!toWarehouseId && warehouses.length > 0) {
      const principal = warehouses.find((w) => w.type === 'PRINCIPAL' && w.isActive)
      if (principal) {
        setToWarehouseId(principal.id)
      }
    }
  }, [warehouses, toWarehouseId])

  // Use exchange rate hook
  const { data: currentExchangeRate, isLoading: isLoadingExchangeRate } = useUsdExchangeRate()
  
  // Set exchange rate from hook
  useEffect(() => {
    if (currentExchangeRate) {
      setExchangeRate(currentExchangeRate)
    }
  }, [currentExchangeRate])

  // Calculate USD equivalent when costPrice or exchange rate changes
  useEffect(() => {
    if (costPrice && currency === 'CUP') {
      const costNum = parseFloat(costPrice)
      if (!isNaN(costNum) && costNum > 0 && exchangeRate > 0) {
        const usdPrice = calculateUsdPrice(costNum, exchangeRate)
        setUsdEquivalent(usdPrice.toFixed(2))
      } else {
        setUsdEquivalent('')
      }
    } else if (currency === 'USD') {
      setUsdEquivalent(costPrice || '')
    } else {
      setUsdEquivalent('')
    }
  }, [costPrice, currency, exchangeRate])

  // Filter products
  const filteredProducts = useMemo(() => {
    return products
  }, [products])

  // Get current stock in destination warehouse
  const destinationStock = useMemo(() => {
    if (!productId || !toWarehouseId) return null
    const product = products.find((p) => p.id === productId)
    if (!product) return null
    return product.stocks.find((s) => s.warehouseId === toWarehouseId)?.stock ?? 0
  }, [productId, toWarehouseId, products])

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === productId)
  }, [productId, products])

  const toWarehouse = useMemo(() => {
    return warehouses.find((w) => w.id === toWarehouseId)
  }, [toWarehouseId, warehouses])

  const resetForm = () => {
    setToWarehouseId('')
    setProductId('')
    setQuantity('')
    setReason('Recepción de stock')
    setCostPrice('')
    setCurrency('CUP')
    setExchangeRate(1)
    setUsdEquivalent('')
  }

  const handleSubmit = async () => {
    if (!toWarehouseId) {
      toast.error('Selecciona el depósito de destino')
      return
    }
    if (!productId) {
      toast.error('Selecciona un producto')
      return
    }
    if (!quantity || parseInt(quantity) <= 0) {
      toast.error('Ingresa una cantidad válida')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          warehouseId: toWarehouseId,
          quantity: parseInt(quantity),
          reason: reason.trim() || 'Recepción de stock',
          costPrice: costPrice.trim() ? parseFloat(costPrice) : undefined,
          costCurrency: currency,
          exchangeRate: currency === 'CUP' ? exchangeRate : 1,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al recibir stock')
      }

      toast.success('Stock recibido correctamente')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
      resetForm()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al recibir stock')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-primary" />
            Recibir Stock
          </DialogTitle>
          <DialogDescription>
            Recibe productos en un depósito específico
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Destination warehouse */}
          <div className="grid gap-2">
            <Label>Depósito de Destino *</Label>
            <CreatableSelect
              options={warehouses.filter((w) => w.isActive).map((wh) => ({ value: wh.id, label: `${wh.name} (${wh.code})` }))}
              value={toWarehouseId}
              onValueChange={(v) => { setToWarehouseId(v); setProductId('') }}
              onCreate={async (name) => {
                const res = await fetch('/api/warehouses', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name }),
                })
                if (!res.ok) throw new Error('Error al crear depósito')
                const warehouse = await res.json()
                queryClient.invalidateQueries({ queryKey: ['warehouses'] })
                return warehouse.id
              }}
              placeholder="Seleccionar depósito destino"
              searchPlaceholder="Buscar depósito..."
              createLabel="Crear '{0}'"
            />
          </div>

          {/* Product select */}
          <div className="grid gap-2">
            <Label>Producto *</Label>
            <CreatableSelect
              options={filteredProducts.map((p) => {
                const stockInDest = p.stocks.find((s) => s.warehouseId === toWarehouseId)?.stock ?? 0
                return { value: p.id, label: `${p.name}${toWarehouseId ? ` (Stock: ${stockInDest})` : ''}` }
              })}
              value={productId}
              onValueChange={setProductId}
              onCreate={async (name) => {
                const res = await fetch('/api/products', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name, costPrice: 0, salePrice: 0, unit: 'unidad' }),
                })
                if (!res.ok) throw new Error('Error al crear producto')
                const product = await res.json()
                queryClient.invalidateQueries({ queryKey: ['products'] })
                return product.id
              }}
              placeholder={filteredProducts.length === 0 ? 'Sin productos' : 'Seleccionar producto...'}
              searchPlaceholder="Buscar producto..."
              createLabel="Crear '{0}'"
            />
          </div>

          {/* Current stock info */}
          {selectedProduct && destinationStock !== null && (
            <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/30 p-3">
              <p className="text-sm text-muted-foreground">
                Stock de <span className="font-medium text-foreground">{selectedProduct.name}</span> en{' '}
                <span className="font-medium text-foreground">{toWarehouse?.name}</span>:
                <span className={`ml-1 font-bold ${
                  destinationStock === 0
                    ? 'text-red-600'
                    : destinationStock <= 5
                      ? 'text-yellow-600'
                      : 'text-emerald-600'
                }`}>
                  {destinationStock} unidades
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Precio costo actual: <span className="font-medium">${selectedProduct.costPrice?.toFixed(2) || '0.00'}</span>
              </p>
            </div>
          )}

          {/* Quantity */}
          <div className="grid gap-2">
            <Label htmlFor="receive-qty">Cantidad a recibir *</Label>
            <Input
              id="receive-qty"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
            />
          </div>

          {/* Cost Price and Currency */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="receive-currency">Moneda</Label>
              <select
                id="receive-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="CUP">CUP (Peso Cubano)</option>
                <option value="USD">USD (Dólar)</option>
              </select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="receive-costPrice">Precio de costo (opcional)</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  {currency === 'USD' ? 'US$' : '$'}
                </span>
                <Input
                  id="receive-costPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder={currency === 'USD' ? '0.00 USD' : '0.00 CUP'}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
          
          {/* Exchange rate and USD equivalent */}
          {currency === 'CUP' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="receive-exchangeRate">Tipo de cambio USD del día</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    1 USD =
                  </span>
                  <Input
                    id="receive-exchangeRate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                    placeholder="Tipo de cambio"
                    className="pl-16"
                    disabled={loadingExchange}
                  />
                </div>
                {isLoadingExchangeRate && (
                  <p className="text-xs text-muted-foreground">Cargando tipo de cambio actual...</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {getExchangeRateDisplay(exchangeRate)}
                </p>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="receive-usdEquivalent">Equivalente en USD</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    US$
                  </span>
                  <Input
                    id="receive-usdEquivalent"
                    type="text"
                    value={usdEquivalent ? `${usdEquivalent} USD` : ''}
                    readOnly
                    placeholder="Calculado automáticamente"
                    className="pl-10 bg-gray-50 dark:bg-gray-900"
                  />
                </div>
                {costPrice && usdEquivalent && (
                  <p className="text-xs text-muted-foreground">
                    {costPrice} {currency} = {usdEquivalent} USD
                  </p>
                )}
              </div>
            </div>
          )}
          
          {currency === 'USD' && costPrice && (
            <div className="rounded-lg border bg-blue-50 dark:bg-blue-900/20 p-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Precio en dólares: <span className="font-medium">US$ {costPrice}</span>
              </p>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground -mt-2">
            Actualiza el precio de costo del producto si es diferente al actual
          </p>

          {/* Reason */}
          <div className="grid gap-2">
            <Label htmlFor="receive-reason">Razón (opcional)</Label>
            <Input
              id="receive-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Razón de la recepción"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false) }} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-slate-800 hover:bg-slate-700 text-white shadow-sm">
            {saving ? 'Recibiendo...' : 'Recibir Stock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
