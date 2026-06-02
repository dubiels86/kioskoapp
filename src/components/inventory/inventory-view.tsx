'use client'

import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowRightLeft,
  Warehouse as WarehouseIcon,
  Expand,
  PackagePlus,
  Camera,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'
import { ProductFormDialog } from './product-form-dialog'
import { CategoryFormDialog } from './category-form-dialog'
import { MovementTable } from './movement-table'
import { WarehouseView } from './warehouse-view'
import { StockTransferDialog } from './stock-transfer-dialog'
import { StockReceivingDialog } from './stock-receiving-dialog'
import { ProductImageDialog } from './product-image-dialog'

interface Category {
  id: string
  name: string
  description?: string | null
  productCount: number
}

interface ProductStock {
  warehouseId: string
  warehouse: {
    id: string
    name: string
    code: string
    type: string
  }
  stock: number
  minStock: number
}

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
  stocks?: ProductStock[]
}

const PAGE_SIZE = 10

export function InventoryView() {
  const queryClient = useQueryClient()

  // Products state
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortField, setSortField] = useState<'name' | 'stock'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  // Dialog state
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [deleteCategoryConfirmOpen, setDeleteCategoryConfirmOpen] = useState(false)
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [receivingDialogOpen, setReceivingDialogOpen] = useState(false)
  const [imageDialogOpen, setImageDialogOpen] = useState(false)
  const [imageProduct, setImageProduct] = useState<Product | null>(null)

  // Stock expansion
  const [expandedStock, setExpandedStock] = useState<string | null>(null)

  // Categories collapsible
  const [categoriesOpen, setCategoriesOpen] = useState(false)

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await fetch('/api/products')
      if (!res.ok) throw new Error('Error al obtener productos')
      return res.json() as Promise<Product[]>
    },
  })

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories')
      if (!res.ok) throw new Error('Error al obtener categorías')
      return res.json() as Promise<Category[]>
    },
  })

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al eliminar producto')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Producto eliminado correctamente')
      setDeleteConfirmOpen(false)
      setDeletingProduct(null)
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al eliminar categoría')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Categoría eliminada correctamente')
      setDeleteCategoryConfirmOpen(false)
      setDeletingCategory(null)
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...products]

    // Search filter
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          (p.barcode && p.barcode.toLowerCase().includes(s)) ||
          (p.sku && p.sku.toLowerCase().includes(s))
      )
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter((p) => p.categoryId === categoryFilter)
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else if (sortField === 'stock') {
        cmp = a.stock - b.stock
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [products, search, categoryFilter, sortField, sortDir])

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE)
  const paginatedProducts = filteredProducts.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  )

  // Reset page when filters change
  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }
  const handleCategoryFilterChange = (value: string) => {
    setCategoryFilter(value)
    setPage(1)
  }

  const toggleSort = (field: 'name' | 'stock') => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const getStockColor = (stock: number, minStock: number) => {
    if (stock === 0) return 'text-red-600 dark:text-red-400 font-bold'
    if (stock < minStock) return 'text-yellow-600 dark:text-yellow-400 font-semibold'
    return 'text-emerald-600 dark:text-emerald-400 font-medium'
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="products" className="w-full">
        <TabsList>
          <TabsTrigger value="products" className="gap-1.5">
            <Package className="h-4 w-4" />
            Productos
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-1.5">
            <ChevronDown className="h-4 w-4" />
            Movimientos
          </TabsTrigger>
          <TabsTrigger value="warehouses" className="gap-1.5">
            <WarehouseIcon className="h-4 w-4" />
            Almacenes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          {/* Top bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, código, SKU..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => {
                  setEditingProduct(null)
                  setProductDialogOpen(true)
                }}
                className="bg-slate-800 hover:bg-slate-700 text-white shadow-sm gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Nuevo Producto
              </Button>
              <Button
                variant="outline"
                onClick={() => setReceivingDialogOpen(true)}
                className="gap-1.5"
              >
                <PackagePlus className="h-4 w-4" />
                Recibir Stock
              </Button>
              <Button
                variant="outline"
                onClick={() => setTransferDialogOpen(true)}
                className="gap-1.5"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Transferir
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingCategory(null)
                  setCategoryDialogOpen(true)
                }}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Nueva Categoría
              </Button>
            </div>
          </div>

          {/* Products table */}
          <div className="rounded-md border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => toggleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Nombre
                      {sortField === 'name' && (
                        <span className="text-xs">
                          {sortDir === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Código/SKU</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">P. Costo</TableHead>
                  <TableHead className="text-right">P. Venta</TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none"
                    onClick={() => toggleSort('stock')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Stock
                      {sortField === 'stock' && (
                        <span className="text-xs">
                          {sortDir === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      Cargando productos...
                    </TableCell>
                  </TableRow>
                ) : paginatedProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      No se encontraron productos
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedProducts.map((product) => (
                    <React.Fragment key={product.id}>
                      <TableRow
                        className={`cursor-pointer ${!product.isActive ? 'opacity-60' : ''}`}
                        onClick={() => setExpandedStock(expandedStock === product.id ? null : product.id)}
                      >
                        {/* Image thumbnail - clickable to update */}
                        <TableCell>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setImageProduct(product)
                              setImageDialogOpen(true)
                            }}
                            className="relative group/thumb block"
                          >
                            {product.image ? (
                              <div className="relative">
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="w-10 h-10 rounded-md object-cover border"
                                />
                                <div className="absolute inset-0 rounded-md bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                  <Camera className="h-4 w-4 text-white" />
                                </div>
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover/thumb:bg-slate-200 dark:group-hover/thumb:bg-slate-700 transition-colors">
                                <Camera className="h-4 w-4 text-muted-foreground/40 group-hover/thumb:text-muted-foreground/70 transition-colors" />
                              </div>
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            {product.name}
                            {product.stocks && product.stocks.length > 1 && (
                              <Expand className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {product.barcode || product.sku || '—'}
                        </TableCell>
                        <TableCell>
                          {product.category ? (
                            <Badge variant="secondary" className="text-xs">
                              {product.category.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(product.costPrice)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(product.salePrice)}</TableCell>
                        <TableCell className={`text-right ${getStockColor(product.stock, product.minStock)}`}>
                          <div className="flex items-center justify-end gap-1">
                            {product.stock}
                            {product.stock < product.minStock && product.stock > 0 && (
                              <span className="text-xs">⚠</span>
                            )}
                            {product.stocks && product.stocks.length > 1 && (
                              <ChevronDown
                                className={`h-3.5 w-3.5 transition-transform ${
                                  expandedStock === product.id ? 'rotate-180' : ''
                                }`}
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {product.isActive ? (
                            <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30 hover:bg-emerald-50">
                              Activo
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-100 dark:border-rose-800/30 hover:bg-rose-50">
                              Inactivo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingProduct(product)
                                setProductDialogOpen(true)
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {product.isActive && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeletingProduct(product)
                                  setDeleteConfirmOpen(true)
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Expanded stock breakdown */}
                      {expandedStock === product.id && product.stocks && product.stocks.length > 1 && (
                        <TableRow key={`${product.id}-stock`}>
                          <TableCell colSpan={9} className="bg-slate-50 dark:bg-slate-900/30 p-0">
                            <div className="p-3 px-6">
                              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                                Stock por depósito
                              </p>
                              <div className="flex flex-wrap gap-3">
                                {product.stocks.map((s) => (
                                  <div
                                    key={s.warehouseId}
                                    className="flex items-center gap-2 rounded-lg border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 px-3 py-2"
                                  >
                                    <WarehouseIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-xs text-muted-foreground">{s.warehouse.name}:</span>
                                    <span className={`text-sm font-semibold ${
                                      s.stock === 0
                                        ? 'text-red-600 dark:text-red-400'
                                        : s.stock <= s.minStock
                                          ? 'text-yellow-600 dark:text-yellow-400'
                                          : 'text-emerald-600 dark:text-emerald-400'
                                    }`}>
                                      {s.stock}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Category Management Section */}
          <Collapsible open={categoriesOpen} onOpenChange={setCategoriesOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/30 border-slate-200 dark:border-slate-800 transition-colors rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Gestión de Categorías</CardTitle>
                    {categoriesOpen ? (
                      <ChevronDown className="h-5 w-5 rotate-180 transition-transform" />
                    ) : (
                      <ChevronDown className="h-5 w-5 transition-transform" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <Separator className="mb-4" />
                  {categoriesLoading ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Cargando categorías...</p>
                  ) : categories.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No hay categorías creadas</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {categories.map((cat) => (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800"
                        >
                          <div>
                            <p className="font-medium text-sm">{cat.name}</p>
                            {cat.description && (
                              <p className="text-xs text-muted-foreground">{cat.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {cat.productCount} producto{cat.productCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingCategory(cat)
                                setCategoryDialogOpen(true)
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeletingCategory(cat)
                                setDeleteCategoryConfirmOpen(true)
                              }}
                              disabled={cat.productCount > 0}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </TabsContent>

        <TabsContent value="movements">
          <MovementTable />
        </TabsContent>

        <TabsContent value="warehouses">
          <WarehouseView />
        </TabsContent>
      </Tabs>

      {/* Product Form Dialog */}
      <ProductFormDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={editingProduct}
        categories={categories}
      />

      {/* Category Form Dialog */}
      <CategoryFormDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        category={editingCategory}
      />

      {/* Stock Receiving Dialog */}
      <StockReceivingDialog
        open={receivingDialogOpen}
        onOpenChange={setReceivingDialogOpen}
      />

      {/* Product Image Dialog */}
      <ProductImageDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        product={imageProduct}
      />

      {/* Stock Transfer Dialog */}
      <StockTransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
      />

      {/* Delete Product Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Eliminar Producto</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas desactivar &quot;{deletingProduct?.name}&quot;? El producto no se eliminará permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingProduct && deleteProductMutation.mutate(deletingProduct.id)}
              disabled={deleteProductMutation.isPending}
            >
              {deleteProductMutation.isPending ? 'Eliminando...' : 'Desactivar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation */}
      <Dialog open={deleteCategoryConfirmOpen} onOpenChange={setDeleteCategoryConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Eliminar Categoría</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar la categoría &quot;{deletingCategory?.name}&quot;?
              {deletingCategory && deletingCategory.productCount > 0 && (
                <span className="block mt-2 text-red-600 font-medium">
                  Esta categoría tiene {deletingCategory.productCount} producto{deletingCategory.productCount !== 1 ? 's' : ''} asociado{deletingCategory.productCount !== 1 ? 's' : ''} y no se puede eliminar.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCategoryConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingCategory && deleteCategoryMutation.mutate(deletingCategory.id)}
              disabled={deleteCategoryMutation.isPending || (deletingCategory?.productCount ?? 0) > 0}
            >
              {deleteCategoryMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
