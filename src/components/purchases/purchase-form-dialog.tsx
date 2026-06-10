'use client'

import { useState, useMemo } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { CreatableSelect } from '@/components/ui/creatable-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Search, Trash2, Warehouse } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'

interface Product {
  id: string
  name: string
  barcode?: string | null
  sku?: string | null
  costPrice: number
  salePrice: number
  stock: number
  unit: string
  isActive: boolean
}

interface Supplier {
  id: string
  name: string
}

interface WarehouseItem {
  id: string
  name: string
  code: string
  type: string
  isActive: boolean
}

interface PurchaseItem {
  productId: string
  productName: string
  quantity: number
  costPrice: number
}

interface PurchaseFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PurchaseFormDialog({ open, onOpenChange }: PurchaseFormDialogProps) {
  const queryClient = useQueryClient()

  // Form state
  const [supplierId, setSupplierId] = useState('')
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [saving, setSaving] = useState(false)

  // Fetch products for search
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await fetch('/api/products?active=true')
      if (!res.ok) throw new Error('Error al obtener productos')
      return res.json() as Promise<Product[]>
    },
  })

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await fetch('/api/suppliers')
      if (!res.ok) throw new Error('Error al obtener proveedores')
      return res.json() as Promise<Supplier[]>
    },
  })

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await fetch('/api/warehouses')
      if (!res.ok) throw new Error('Error al obtener depósitos')
      return res.json() as Promise<WarehouseItem[]>
    },
  })

  // Compute effective warehouse ID: user selection > PRINCIPAL default > first warehouse
  const defaultWarehouseId = useMemo(() => {
    const principal = warehouses.find((w) => w.type === 'PRINCIPAL')
    return principal?.id ?? warehouses[0]?.id ?? null
  }, [warehouses])

  const warehouseId = selectedWarehouseId ?? defaultWarehouseId ?? ''

  // Filtered products for search dropdown
  const searchResults = useMemo(() => {
    if (!productSearch.trim()) return []
    const s = productSearch.toLowerCase()
    return products
      .filter(
        (p) =>
          (p.name.toLowerCase().includes(s) ||
            (p.barcode && p.barcode.toLowerCase().includes(s)) ||
            (p.sku && p.sku.toLowerCase().includes(s))) &&
          !items.find((i) => i.productId === p.id)
      )
      .slice(0, 10)
  }, [productSearch, products, items])

  const total = items.reduce((sum, item) => sum + item.quantity * item.costPrice, 0)

  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId)

  const addProduct = (product: Product) => {
    if (items.find((i) => i.productId === product.id)) {
      toast.error('Este producto ya fue agregado')
      return
    }
    setItems([
      ...items,
      {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        costPrice: product.costPrice,
      },
    ])
    setProductSearch('')
  }

  const updateItem = (index: number, field: 'quantity' | 'costPrice', value: string) => {
    const newItems = [...items]
    const numValue = parseFloat(value) || 0
    if (field === 'quantity') {
      newItems[index] = { ...newItems[index], quantity: Math.max(1, Math.round(numValue)) }
    } else {
      newItems[index] = { ...newItems[index], costPrice: Math.max(0, numValue) }
    }
    setItems(newItems)
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error('Agrega al menos un producto a la compra')
      return
    }

    if (!warehouseId) {
      toast.error('Selecciona un depósito para recibir los productos')
      return
    }

    setSaving(true)
    try {
      const body = {
        supplierId: supplierId === 'none' ? undefined : supplierId || undefined,
        warehouseId,
        invoiceNumber: invoiceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          costPrice: item.costPrice,
        })),
      }

      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al crear compra')
      }

      toast.success('Compra registrada correctamente')
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })

      // Reset form
      setSupplierId('')
      setInvoiceNumber('')
      setNotes('')
      setItems([])
      setProductSearch('')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar compra')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Compra</DialogTitle>
          <DialogDescription>
            Registra una nueva compra de productos al inventario
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Proveedor</Label>
              <CreatableSelect
                options={[
                  { value: 'none', label: 'Sin proveedor' },
                  ...suppliers.map((s) => ({ value: s.id, label: s.name })),
                ]}
                value={supplierId}
                onValueChange={setSupplierId}
                onCreate={async (name) => {
                  const res = await fetch('/api/suppliers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name }),
                  })
                  if (!res.ok) throw new Error('Error al crear proveedor')
                  const supplier = await res.json()
                  queryClient.invalidateQueries({ queryKey: ['suppliers'] })
                  return supplier.id
                }}
                placeholder="Sin proveedor"
                searchPlaceholder="Buscar proveedor..."
                createLabel="Crear '{0}'"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invoice">Factura</Label>
              <Input
                id="invoice"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="N° de factura (opcional)"
              />
            </div>
          </div>

          {/* Warehouse selector */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <Warehouse className="h-4 w-4" />
              Depósito de Recepción
            </Label>
            <CreatableSelect
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
              value={warehouseId}
              onValueChange={setSelectedWarehouseId}
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
              placeholder="Seleccionar depósito..."
              searchPlaceholder="Buscar depósito..."
              createLabel="Crear '{0}'"
            />
            {selectedWarehouse && (
              <p className="text-sm text-muted-foreground">
                Los productos se recibirán en: <span className="font-medium text-foreground">{selectedWarehouse.name}</span>
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="purchase-notes">Notas</Label>
            <Textarea
              id="purchase-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales (opcional)"
              rows={2}
            />
          </div>

          <Separator />

          {/* Product search */}
          <div className="space-y-3">
            <Label>Agregar Productos</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar producto por nombre, código o SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-950 border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {searchResults.map((product) => (
                    <button
                      key={product.id}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-sm"
                      onClick={() => addProduct(product)}
                    >
                      <span className="font-medium">{product.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {formatCurrency(product.costPrice)} · Stock: {product.stock}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Items table */}
          {items.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="w-[100px]">Cantidad</TableHead>
                    <TableHead className="w-[130px]">P. Costo</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium text-sm">{item.productName}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                          className="h-8 w-20 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.costPrice}
                          onChange={(e) => updateItem(index, 'costPrice', e.target.value)}
                          className="h-8 w-28 text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.quantity * item.costPrice)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Summary */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <span className="text-sm font-medium">Total de la Compra</span>
            <span className="text-xl font-bold text-primary">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || items.length === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            {saving ? 'Registrando...' : 'Registrar Compra'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
