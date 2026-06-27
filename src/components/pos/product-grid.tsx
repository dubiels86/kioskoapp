'use client'

import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/format'
import type { CartItem } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Package, ImageIcon } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

interface Product {
  id: string
  name: string
  barcode?: string | null
  sku?: string | null
  categoryId?: string | null
  category?: { id: string; name: string } | null
  costPrice: number
  salePrice: number
  stock: number
  minStock: number
  unit: string
  isActive: boolean
  showInPos: boolean
  image?: string | null
  warehouseStock?: number
  warehouseMinStock?: number
}

interface Category {
  id: string
  name: string
  productCount: number
}

interface ProductGridProps {
  warehouseId: string | null
}

export function ProductGrid({ warehouseId }: ProductGridProps) {
  const {
    posSearch,
    setPosSearch,
    posCategoryFilter,
    setPosCategoryFilter,
    addToCart,
  } = useAppStore()

  const [debouncedSearch, setDebouncedSearch] = useState(posSearch)
  const [localSearch, setLocalSearch] = useState(posSearch)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(localSearch)
      setPosSearch(localSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [localSearch, setPosSearch])

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories')
      if (!res.ok) throw new Error('Error cargando categorías')
      return res.json()
    },
  })

  // Fetch products with warehouse context
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', debouncedSearch, posCategoryFilter, warehouseId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (posCategoryFilter && posCategoryFilter !== 'all') {
        params.set('categoryId', posCategoryFilter)
      }
      params.set('active', 'true')
      params.set('showInPos', 'true')
      if (warehouseId) {
        params.set('warehouseId', warehouseId)
      }
      const res = await fetch(`/api/products?${params.toString()}`)
      if (!res.ok) throw new Error('Error cargando productos')
      return res.json()
    },
    enabled: !!warehouseId,
  })

  const handleAddToCart = useCallback(
    (product: Product) => {
      if (!warehouseId) return
      // Use warehouseStock if available, otherwise fall back to total stock
      const availableStock = warehouseId && product.warehouseStock !== undefined
        ? product.warehouseStock
        : product.stock
      if (availableStock <= 0) return

      const cartItem: CartItem = {
        productId: product.id,
        productName: product.name,
        barcode: product.barcode || undefined,
        image: product.image || undefined,
        quantity: 1,
        costPrice: product.costPrice,
        salePrice: product.salePrice,
        subtotal: product.salePrice,
        costSubtotal: product.costPrice,
        stock: availableStock,
        warehouseId: warehouseId,
      }
      addToCart(cartItem)
    },
    [addToCart, warehouseId]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 pb-4 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input
            placeholder="Buscar por nombre o código..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9 h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-ring/20"
          />
        </div>
        <Select
          value={posCategoryFilter}
          onValueChange={setPosCategoryFilter}
        >
          <SelectTrigger className="w-full sm:w-52 h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* No warehouse selected message */}
      {!warehouseId && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Package className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">Seleccioná un almacén</p>
          <p className="text-sm mt-1">
            Elegí un almacén en la parte superior para ver los productos disponibles
          </p>
        </div>
      )}

      {/* Product Grid */}
      {warehouseId && (
        <ScrollArea className="flex-1 -mx-1">
          <div className="px-1">
            {isLoading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Package className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-lg font-medium">No se encontraron productos</p>
                <p className="text-sm mt-1">
                  Intentá con otra búsqueda o categoría
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    warehouseId={warehouseId}
                    onAdd={handleAddToCart}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

function ProductCard({
  product,
  warehouseId,
  onAdd,
}: {
  product: Product
  warehouseId: string | null
  onAdd: (product: Product) => void
}) {
  // Use warehouse-specific stock when available
  const displayStock = warehouseId && product.warehouseStock !== undefined
    ? product.warehouseStock
    : product.stock
  const displayMinStock = warehouseId && product.warehouseMinStock !== undefined
    ? product.warehouseMinStock
    : product.minStock
  const isOutOfStock = displayStock <= 0
  const isLowStock = !isOutOfStock && displayStock <= displayMinStock

  return (
    <button
      onClick={() => onAdd(product)}
      disabled={isOutOfStock}
      className={`
        group relative flex flex-col rounded-xl border transition-all duration-200 text-left overflow-hidden
        ${
          isOutOfStock
            ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-lg hover:scale-[1.02] cursor-pointer active:scale-[0.98]'
        }
      `}
    >
      {/* Image Area */}
      <div className="relative w-full aspect-[4/3] bg-slate-50 dark:bg-slate-800 overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-7 h-7 text-slate-200 dark:text-slate-700" />
          </div>
        )}

        {/* Out of stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              Agotado
            </span>
          </div>
        )}

        {/* Badges over image */}
        <div className="absolute top-1 left-1 flex items-center gap-0.5 flex-wrap">
          {product.category && (
            <Badge
              variant="secondary"
              className="text-[9px] px-1 py-0 h-4 bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-medium backdrop-blur-sm border-0 shadow-sm"
            >
              {product.category.name}
            </Badge>
          )}
          {isLowStock && (
            <Badge className="text-[9px] px-1 py-0 h-4 bg-amber-500/90 text-white border-0 shadow-sm backdrop-blur-sm">
              Bajo stock
            </Badge>
          )}
        </div>

        {/* Stock dot */}
        {!isOutOfStock && (
          <div className="absolute top-1 right-1">
            <span className={`flex h-2.5 w-2.5 rounded-full border-2 border-white shadow-sm ${
              isLowStock ? 'bg-amber-400' : 'bg-emerald-400'
            }`} />
          </div>
        )}
      </div>

      {/* Info at bottom */}
      <div className="p-1.5 space-y-0">
        <h3 className="font-medium text-xs text-slate-800 dark:text-slate-100 leading-tight line-clamp-1">
          {product.name}
        </h3>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {formatCurrency(product.salePrice)}
          </p>
          {!isOutOfStock && (
            <span className="text-[9px] text-slate-400 dark:text-slate-500">
              {displayStock}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function ProductCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <Skeleton className="w-full aspect-[4/3]" />
      <div className="p-1.5 space-y-0.5">
        <Skeleton className="h-3 w-3/4" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-2.5 w-6" />
        </div>
      </div>
    </div>
  )
}
