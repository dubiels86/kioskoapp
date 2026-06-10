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

  const toWarehouse = useMemo(() => {
    return warehouses.find((w) => w.id === toWarehouseId)
  }, [toWarehouseId, warehouses])

  const resetForm = () => {
    setToWarehouseId('')
    setProductId('')
    setQuantity('')
    setReason('Recepción de stock')
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
