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
import Image from 'next/image'

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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500/50" />
          <Input
            placeholder="Buscar por nombre o código..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9 h-11 bg-white dark:bg-slate-900 border-emerald-200/60 dark:border-emerald-900/30 focus:border-emerald-400 focus:ring-emerald-400/20"
          />
        </div>
        <Select
          value={posCategoryFilter}
          onValueChange={setPosCategoryFilter}
        >
          <SelectTrigger className="w-full sm:w-52 h-11 bg-white dark:bg-slate-900 border-emerald-200/60 dark:border-emerald-900/30">
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
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
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
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
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
        group relative flex flex-col items-start p-3 rounded-xl border transition-all duration-200 text-left
        ${
          isOutOfStock
            ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
            : 'bg-white dark:bg-slate-900 border-emerald-100 dark:border-emerald-900/20 hover:border-teal-300 dark:hover:border-teal-600 hover:shadow-lg hover:shadow-emerald-500/8 hover:scale-[1.02] cursor-pointer active:scale-[0.98]'
        }
      `}
    >
      {/* Badges */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {product.category && (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 h-5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-100 dark:border-emerald-900/30"
          >
            {product.category.name}
          </Badge>
        )}
        {isOutOfStock && (
          <Badge
            variant="destructive"
            className="text-[10px] px-1.5 py-0 h-5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/30"
          >
            Agotado
          </Badge>
        )}
        {isLowStock && (
          <Badge className="text-[10px] px-1.5 py-0 h-5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30">
            Bajo stock
          </Badge>
        )}
      </div>

      {/* Product Image & Name */}
      <div className="flex items-start gap-2.5 w-full mb-1">
        {/* Product Image Thumbnail */}
        <div className="w-12 h-12 rounded-lg border border-emerald-100 dark:border-emerald-900/30 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 shrink-0 overflow-hidden flex items-center justify-center">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              width={48}
              height={48}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            <ImageIcon className="w-5 h-5 text-emerald-300 dark:text-emerald-700" />
          )}
        </div>

        <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 leading-tight line-clamp-2 flex-1">
          {product.name}
        </h3>
      </div>

      {/* Price */}
      <p className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent mt-auto ml-0">
        {formatCurrency(product.salePrice)}
      </p>

      {/* Stock indicator */}
      <div className="flex items-center gap-1.5 mt-2">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isOutOfStock
              ? 'bg-rose-400'
              : isLowStock
                ? 'bg-amber-400'
                : 'bg-emerald-400'
          }`}
        />
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {isOutOfStock
            ? 'Sin stock'
            : `${displayStock} ${displayStock === 1 ? product.unit : product.unit + 's'}`}
        </span>
      </div>
    </button>
  )
}

function ProductCardSkeleton() {
  return (
    <div className="flex flex-col p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/20 bg-white dark:bg-slate-900">
      <Skeleton className="h-5 w-16 mb-2" />
      <div className="flex items-start gap-2.5 mb-1">
        <Skeleton className="w-12 h-12 rounded-lg shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <Skeleton className="h-7 w-24 mb-2 mt-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}
