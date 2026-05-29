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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PackagePlus, Search } from 'lucide-react'
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
  const [productSearch, setProductSearch] = useState('')
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

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    let result = products

    if (productSearch) {
      const s = productSearch.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          (p.barcode && p.barcode.toLowerCase().includes(s)) ||
          (p.sku && p.sku.toLowerCase().includes(s))
      )
    }

    return result
  }, [products, productSearch])

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
    setProductSearch('')
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
            <PackagePlus className="h-5 w-5 text-emerald-600" />
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
            <Select value={toWarehouseId} onValueChange={(v) => { setToWarehouseId(v); setProductId('') }}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar depósito destino" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.filter((w) => w.isActive).map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.name} ({wh.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product search + select */}
          <div className="grid gap-2">
            <Label>Producto *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, código de barras o SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder={
                  filteredProducts.length === 0
                    ? 'Sin productos encontrados'
                    : 'Seleccionar producto'
                } />
              </SelectTrigger>
              <SelectContent>
                {filteredProducts.map((p) => {
                  const stockInDest = p.stocks.find((s) => s.warehouseId === toWarehouseId)?.stock ?? 0
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{toWarehouseId ? ` (Stock actual: ${stockInDest})` : ''}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Current stock info */}
          {selectedProduct && destinationStock !== null && (
            <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/50 p-3">
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
          <Button onClick={handleSubmit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? 'Recibiendo...' : 'Recibir Stock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
