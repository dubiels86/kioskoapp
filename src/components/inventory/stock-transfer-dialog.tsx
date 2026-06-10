'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import { ArrowRightLeft } from 'lucide-react'
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
  stocks: ProductStock[]
}

interface StockTransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StockTransferDialog({ open, onOpenChange }: StockTransferDialogProps) {
  const queryClient = useQueryClient()

  const [fromWarehouseId, setFromWarehouseId] = useState('')
  const [toWarehouseId, setToWarehouseId] = useState('')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
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

  // Filter products by source warehouse having stock
  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => p.stocks && p.stocks.length > 0)

    // Filter by source warehouse having stock
    if (fromWarehouseId) {
      result = result.filter((p) =>
        p.stocks.some((s) => s.warehouseId === fromWarehouseId && s.stock > 0)
      )
    }

    return result
  }, [products, fromWarehouseId])

  // Get current stock in source warehouse
  const sourceStock = useMemo(() => {
    if (!productId || !fromWarehouseId) return null
    const product = products.find((p) => p.id === productId)
    if (!product) return null
    return product.stocks.find((s) => s.warehouseId === fromWarehouseId)?.stock ?? 0
  }, [productId, fromWarehouseId, products])

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === productId)
  }, [productId, products])

  const fromWarehouse = useMemo(() => {
    return warehouses.find((w) => w.id === fromWarehouseId)
  }, [fromWarehouseId, warehouses])

  const toWarehouse = useMemo(() => {
    return warehouses.find((w) => w.id === toWarehouseId)
  }, [toWarehouseId, warehouses])

  const resetForm = () => {
    setFromWarehouseId('')
    setToWarehouseId('')
    setProductId('')
    setQuantity('')
    setReason('')
  }

  const handleSubmit = async () => {
    if (!fromWarehouseId) {
      toast.error('Selecciona el depósito de origen')
      return
    }
    if (!toWarehouseId) {
      toast.error('Selecciona el depósito de destino')
      return
    }
    if (fromWarehouseId === toWarehouseId) {
      toast.error('Los depósitos de origen y destino no pueden ser el mismo')
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
    if (sourceStock !== null && parseInt(quantity) > sourceStock) {
      toast.error(`Stock insuficiente. Disponible: ${sourceStock}`)
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/stock-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          fromWarehouseId,
          toWarehouseId,
          quantity: parseInt(quantity),
          reason: reason.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al realizar transferencia')
      }

      toast.success('Stock transferido correctamente')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
      resetForm()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al transferir stock')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Transferir Stock
          </DialogTitle>
          <DialogDescription>
            Transfiere stock entre depósitos
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Source warehouse */}
          <div className="grid gap-2">
            <Label>Depósito de Origen *</Label>
            <CreatableSelect
              options={warehouses.map((wh) => ({ value: wh.id, label: `${wh.name} (${wh.code})` }))}
              value={fromWarehouseId}
              onValueChange={(v) => { setFromWarehouseId(v); setProductId('') }}
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
              placeholder="Seleccionar depósito origen"
              searchPlaceholder="Buscar depósito..."
              createLabel="Crear '{0}'"
            />
          </div>

          {/* Destination warehouse */}
          <div className="grid gap-2">
            <Label>Depósito de Destino *</Label>
            <CreatableSelect
              options={warehouses
                .filter((wh) => wh.id !== fromWarehouseId)
                .map((wh) => ({ value: wh.id, label: `${wh.name} (${wh.code})` }))}
              value={toWarehouseId}
              onValueChange={setToWarehouseId}
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

          {/* Visual indicator */}
          {fromWarehouse && toWarehouse && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm">
              <span className="font-medium text-muted-foreground">{fromWarehouse.name}</span>
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-muted-foreground">{toWarehouse.name}</span>
            </div>
          )}

          {/* Product select */}
          <div className="grid gap-2">
            <Label>Producto *</Label>
            {fromWarehouseId ? (
              <CreatableSelect
                options={filteredProducts.map((p) => {
                  const stockInSource = p.stocks.find((s) => s.warehouseId === fromWarehouseId)?.stock ?? 0
                  return { value: p.id, label: `${p.name} (Stock: ${stockInSource})` }
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
                placeholder={filteredProducts.length === 0 ? 'Sin productos con stock' : 'Seleccionar producto...'}
                searchPlaceholder="Buscar producto..."
                createLabel="Crear '{0}'"
              />
            ) : (
              <p className="text-sm text-muted-foreground py-2">
                Selecciona un depósito de origen primero
              </p>
            )}
          </div>

          {/* Current stock info */}
          {selectedProduct && sourceStock !== null && (
            <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/30 p-3">
              <p className="text-sm text-muted-foreground">
                Stock de <span className="font-medium text-foreground">{selectedProduct.name}</span> en{' '}
                <span className="font-medium text-foreground">{fromWarehouse?.name}</span>:
                <span className={`ml-1 font-bold ${
                  sourceStock === 0
                    ? 'text-red-600'
                    : sourceStock <= 5
                      ? 'text-yellow-600'
                      : 'text-emerald-600'
                }`}>
                  {sourceStock} unidades
                </span>
              </p>
            </div>
          )}

          {/* Quantity */}
          <div className="grid gap-2">
            <Label htmlFor="transfer-qty">Cantidad a transferir *</Label>
            <Input
              id="transfer-qty"
              type="number"
              min="1"
              max={sourceStock ?? undefined}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
            />
            {sourceStock !== null && quantity && parseInt(quantity) > sourceStock && (
              <p className="text-xs text-red-500">
                La cantidad excede el stock disponible ({sourceStock})
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="grid gap-2">
            <Label htmlFor="transfer-reason">Razón (opcional)</Label>
            <Input
              id="transfer-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Razón de la transferencia"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false) }} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-slate-800 hover:bg-slate-700 text-white shadow-sm">
            {saving ? 'Transfiriendo...' : 'Transferir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
