'use client'

import { useState, useEffect, useRef } from 'react'
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
import { ImagePlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'

interface Category {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  barcode?: string | null
  sku?: string | null
  categoryId?: string | null
  costPrice: number
  salePrice: number
  costCurrency: string
  saleCurrency: string
  stock: number
  minStock: number
  unit: string
  isActive: boolean
  image?: string | null
}

interface ProductFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product | null
  categories: Category[]
}

const UNITS = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'kg', label: 'Kilogramo' },
  { value: 'lt', label: 'Litro' },
  { value: 'paquete', label: 'Paquete' },
]

export function ProductFormDialog({ open, onOpenChange, product, categories }: ProductFormDialogProps) {
  const queryClient = useQueryClient()
  const isEditing = !!product

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Error al obtener configuración')
      return res.json() as Promise<Record<string, { key: string; value: string; label: string }[]>>
    },
  })

  const customUnits: string[] = settings?.custom_options?.find(s => s.key === 'custom_units')?.value
    ? JSON.parse(settings.custom_options.find(s => s.key === 'custom_units')!.value)
    : []
  const ALL_UNITS = [
    ...UNITS,
    ...customUnits.filter(u => !UNITS.some(u2 => u2.value === u)).map(u => ({ value: u, label: u.charAt(0).toUpperCase() + u.slice(1) })),
  ]
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [barcode, setBarcode] = useState('')
  const [sku, setSku] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [costCurrency, setCostCurrency] = useState('ARS')
  const [saleCurrency, setSaleCurrency] = useState('ARS')
  const [stock, setStock] = useState('')
  const [minStock, setMinStock] = useState('')
  const [unit, setUnit] = useState('unidad')
  const [isPosProduct, setIsPosProduct] = useState(false)
  const [image, setImage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (product) {
      setName(product.name)
      setBarcode(product.barcode || '')
      setSku(product.sku || '')
      setCategoryId(product.categoryId || '')
      setCostPrice(String(product.costPrice))
      setSalePrice(String(product.salePrice))
      setCostCurrency(product.costCurrency || 'ARS')
      setSaleCurrency(product.saleCurrency || 'ARS')
      setStock(String(product.stock))
      setMinStock(String(product.minStock))
      setUnit(product.unit)
      setIsPosProduct(product.isPosProduct || false)
      setImage(product.image || null)
    } else {
      setName('')
      setBarcode('')
      setSku('')
      setCategoryId('')
      setCostPrice('')
      setSalePrice('')
      setCostCurrency('ARS')
      setSaleCurrency('ARS')
      setStock('')
      setMinStock('5')
      setUnit('unidad')
      setIsPosProduct(false)
      setImage(null)
    }
  }, [product, open])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten archivos de imagen')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no puede superar los 2MB')
      return
    }

    // Convert to base64 data URL
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      setImage(result)
    }
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    if (!costPrice || parseFloat(costPrice) < 0) {
      toast.error('El precio de costo es requerido')
      return
    }
    if (!salePrice || parseFloat(salePrice) < 0) {
      toast.error('El precio de venta es requerido')
      return
    }

    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        barcode: barcode.trim() || undefined,
        sku: sku.trim() || undefined,
        categoryId: categoryId || undefined,
        costPrice: parseFloat(costPrice),
        salePrice: parseFloat(salePrice),
        costCurrency,
        saleCurrency,
        stock: stock ? parseInt(stock) : undefined,
        minStock: minStock ? parseInt(minStock) : undefined,
        unit,
        isPosProduct,
        image: image || undefined,
      }

      if (isEditing) {
        const res = await fetch(`/api/products/${product!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Error al actualizar producto')
        }
        toast.success('Producto actualizado correctamente')
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Error al crear producto')
        }
        toast.success('Producto creado correctamente')
      }

      queryClient.invalidateQueries({ queryKey: ['products'] })
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar producto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifica los datos del producto' : 'Completa los datos del nuevo producto'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Image upload */}
          <div className="grid gap-2">
            <Label>Imagen del producto</Label>
            <div className="flex items-start gap-4">
              {image ? (
                <div className="relative group">
                  <img
                    src={image}
                    alt="Vista previa"
                    className="w-20 h-20 rounded-lg object-cover border"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center cursor-pointer hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-6 w-6 text-muted-foreground/50" />
                </div>
              )}
              <div className="flex-1 space-y-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  {image ? 'Cambiar imagen' : 'Subir imagen'}
                </Button>
                {image && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeImage}
                    className="gap-1.5 text-red-500 hover:text-red-600"
                  >
                    <X className="h-3.5 w-3.5" />
                    Eliminar
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  JPG, PNG o WebP. Máximo 2MB.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del producto"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="barcode">Código de barras</Label>
              <Input
                id="barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Ej: 7791234567890"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Ej: PROD-001"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category">Categoría</Label>
            <CreatableSelect
              options={[
                { value: 'none', label: 'Sin categoría' },
                ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
              ]}
              value={categoryId}
              onValueChange={setCategoryId}
              onCreate={async (name) => {
                const res = await fetch('/api/categories', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name }),
                })
                if (!res.ok) throw new Error('Error al crear categoría')
                const cat = await res.json()
                queryClient.invalidateQueries({ queryKey: ['categories'] })
                return cat.id
              }}
              placeholder="Sin categoría"
              searchPlaceholder="Buscar categoría..."
              createLabel="Crear '{0}'"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="costPrice">Precio de costo *</Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="salePrice">Precio de venta *</Label>
              <Input
                id="salePrice"
                type="number"
                step="0.01"
                min="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="costCurrency">Moneda costo</Label>
              <Input
                id="costCurrency"
                value={costCurrency}
                onChange={(e) => setCostCurrency(e.target.value.toUpperCase())}
                placeholder="ARS"
                maxLength={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="saleCurrency">Moneda venta</Label>
              <Input
                id="saleCurrency"
                value={saleCurrency}
                onChange={(e) => setSaleCurrency(e.target.value.toUpperCase())}
                placeholder="ARS"
                maxLength={3}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="stock">Stock</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="minStock">Stock mínimo</Label>
              <Input
                id="minStock"
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                placeholder="5"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isPosProduct"
                checked={isPosProduct}
                onChange={(e) => setIsPosProduct(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-slate-600 focus:ring-slate-600"
              />
              <Label htmlFor="isPosProduct" className="text-sm font-normal text-gray-700 cursor-pointer">
                Producto para POS
              </Label>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="unit">Unidad</Label>
            <CreatableSelect
              options={ALL_UNITS.map((u) => ({ value: u.value, label: u.label }))}
              value={unit}
              onValueChange={setUnit}
              onCreate={async (newUnit) => {
                // Save custom unit to settings
                const currentCustomUnits = customUnits
                const updated = [...currentCustomUnits, newUnit]
                await fetch('/api/settings', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ custom_units: JSON.stringify(updated) }),
                })
                queryClient.invalidateQueries({ queryKey: ['settings'] })
                return newUnit
              }}
              placeholder="Seleccionar unidad..."
              searchPlaceholder="Buscar unidad..."
              createLabel="Crear '{0}'"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-slate-800 hover:bg-slate-700 text-white shadow-sm">
            {saving ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear Producto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
