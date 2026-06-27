'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { Switch } from '@/components/ui/switch'
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
  stock: number
  costPrice: number
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
  const [costPrice, setCostPrice] = useState('')
  const [reason, setReason] = useState('Recepción de stock')
  const [showInPos, setShowInPos] = useState(true)
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

  // Auto-fill costPrice when product is selected
  useEffect(() => {
    if (selectedProduct) {
      setCostPrice(selectedProduct.costPrice > 0 ? String(selectedProduct.costPrice) : '')
    } else {
      setCostPrice('')
    }
  }, [selectedProduct])

  const toWarehouse = useMemo(() => {
    return warehouses.find((w) => w.id === toWarehouseId)
  }, [toWarehouseId, warehouses])

  const resetForm = () => {
    setToWarehouseId('')
    setProductId('')
    setQuantity('')
    setCostPrice('')
    setReason('Recepción de stock')
    setShowInPos(true)
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
    if (!costPrice || parseFloat(costPrice) < 0) {
      toast.error('Ingresa un precio de costo válido')
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
          costPrice: parseFloat(costPrice),
          reason: reason.trim() || 'Recepción de stock',
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
                  body: JSON.stringify({ 
                    name, 
                    costPrice: parseFloat(costPrice) || 0, 
                    salePrice: parseFloat(costPrice) || 0, 
                    unit: 'unidad',
                    showInPos 
                  }),
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

          {/* Cost Price */}
          <div className="grid gap-2">
            <Label htmlFor="receive-costPrice">Precio de Costo *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                id="receive-costPrice"
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
                className="pl-7"
              />
            </div>
          </div>

          {/* Show in POS toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Mostrar en Punto de Venta</Label>
              <p className="text-xs text-muted-foreground">
                Los productos sin esta opción solo se usan en reparaciones o internamente
              </p>
            </div>
            <Switch
              checked={showInPos}
              onCheckedChange={setShowInPos}
            />
          </div>

          {/* Weighted average preview */}
          {selectedProduct && destinationStock !== null && destinationStock > 0 && costPrice && parseFloat(costPrice) > 0 && selectedProduct.costPrice !== parseFloat(costPrice) && (() => {
            const currentStock = destinationStock
            const currentCost = selectedProduct.costPrice
            const newQty = parseInt(quantity) || 0
            const newCost = parseFloat(costPrice)
            const totalStock = currentStock + newQty
            const weightedAvg = totalStock > 0 ? (currentStock * currentCost + newQty * newCost) / totalStock : 0
            return (
              <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 p-3 space-y-1">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">📊 Promedio Ponderado</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Stock actual:</span>
                  <span className="font-medium">{currentStock} uds</span>
                  <span className="text-muted-foreground">Costo actual:</span>
                  <span className="font-medium">${currentCost.toFixed(2)}</span>
                  <span className="text-muted-foreground">Nueva cantidad:</span>
                  <span className="font-medium">{newQty} uds</span>
                  <span className="text-muted-foreground">Nuevo costo:</span>
                  <span className="font-medium">${newCost.toFixed(2)}</span>
                </div>
                <div className="pt-1 border-t border-emerald-200 dark:border-emerald-800 mt-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">Costo promedio resultante:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">${weightedAvg.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )
          })()}

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
