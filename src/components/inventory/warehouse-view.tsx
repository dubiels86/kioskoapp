'use client'

import React, { useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Plus,
  Edit,
  Trash2,
  Warehouse as WarehouseIcon,
  ChevronDown,
  Package,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { WAREHOUSE_TYPE_LABELS, type WarehouseType } from '@/lib/types'

interface WarehouseStockSummary {
  totalStock: number
  totalProducts: number
  lowStockCount: number
}

interface Warehouse {
  id: string
  name: string
  code: string
  type: string
  address?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  stockSummary: WarehouseStockSummary
}

interface WarehouseDetail {
  id: string
  name: string
  code: string
  type: string
  address?: string | null
  isActive: boolean
  stocks: Array<{
    id: string
    productId: string
    warehouseId: string
    stock: number
    minStock: number
    product: {
      id: string
      name: string
      category: { id: string; name: string } | null
    }
  }>
  stockSummary: WarehouseStockSummary & {
    totalValue: number
    lowStockItems: Array<{
      productId: string
      productName: string
      currentStock: number
      minStock: number
    }>
  }
}

const WAREHOUSE_TYPES: { value: WarehouseType; label: string }[] = [
  { value: 'PRINCIPAL', label: 'Depósito Principal' },
  { value: 'VENTAS', label: 'Local de Ventas' },
  { value: 'SECUNDARIO', label: 'Secundario' },
]

function WarehouseFormDialog({
  open,
  onOpenChange,
  warehouse,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  warehouse?: Warehouse | null
}) {
  const queryClient = useQueryClient()
  const isEditing = !!warehouse

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [type, setType] = useState<WarehouseType>('PRINCIPAL')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset form when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      if (warehouse) {
        setName(warehouse.name)
        setCode(warehouse.code)
        setType(warehouse.type as WarehouseType)
        setAddress(warehouse.address || '')
      } else {
        setName('')
        setCode('')
        setType('PRINCIPAL')
        setAddress('')
      }
    }
    onOpenChange(newOpen)
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    if (!code.trim()) {
      toast.error('El código es requerido')
      return
    }

    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        type,
        address: address.trim() || undefined,
      }

      if (isEditing) {
        const res = await fetch(`/api/warehouses/${warehouse!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Error al actualizar depósito')
        }
        toast.success('Depósito actualizado correctamente')
      } else {
        const res = await fetch('/api/warehouses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Error al crear depósito')
        }
        toast.success('Depósito creado correctamente')
      }

      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar depósito')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Depósito' : 'Nuevo Depósito'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifica los datos del depósito' : 'Completa los datos del nuevo depósito'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="wh-name">Nombre *</Label>
            <Input
              id="wh-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Depósito Principal"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="wh-code">Código *</Label>
              <Input
                id="wh-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ej: DP"
                className="uppercase"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="wh-type">Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as WarehouseType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_TYPES.map((wt) => (
                    <SelectItem key={wt.value} value={wt.value}>
                      {wt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="wh-address">Dirección</Label>
            <Input
              id="wh-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Dirección del depósito (opcional)"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-slate-800 hover:bg-slate-700 text-white shadow-sm">
            {saving ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear Depósito'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function WarehouseView() {
  const queryClient = useQueryClient()

  const [formOpen, setFormOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse | null>(null)
  const [expandedWarehouse, setExpandedWarehouse] = useState<string | null>(null)

  // Fetch warehouses
  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await fetch('/api/warehouses')
      if (!res.ok) throw new Error('Error al obtener depósitos')
      return res.json() as Promise<Warehouse[]>
    },
  })

  // Fetch warehouse detail when expanded
  const { data: warehouseDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['warehouse-detail', expandedWarehouse],
    queryFn: async () => {
      if (!expandedWarehouse) return null
      const res = await fetch(`/api/warehouses/${expandedWarehouse}`)
      if (!res.ok) throw new Error('Error al obtener detalle del depósito')
      return res.json() as Promise<WarehouseDetail>
    },
    enabled: !!expandedWarehouse,
  })

  // Delete warehouse mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/warehouses/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al desactivar depósito')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Depósito desactivado correctamente')
      setDeleteConfirmOpen(false)
      setDeletingWarehouse(null)
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const getTypeBadge = (type: string) => {
    const label = WAREHOUSE_TYPE_LABELS[type as WarehouseType] || type
    switch (type) {
      case 'PRINCIPAL':
        return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300 hover:bg-slate-100">{label}</Badge>
      case 'VENTAS':
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100">{label}</Badge>
      case 'SECUNDARIO':
        return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400 hover:bg-slate-100">{label}</Badge>
      default:
        return <Badge variant="secondary">{label}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {warehouses.length} depósito{warehouses.length !== 1 ? 's' : ''} activo{warehouses.length !== 1 ? 's' : ''}
        </p>
        <Button
          onClick={() => {
            setEditingWarehouse(null)
            setFormOpen(true)
          }}
          className="bg-slate-800 hover:bg-slate-700 text-white shadow-sm gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Nuevo Depósito
        </Button>
      </div>

      {/* Warehouses table */}
      <div className="rounded-md border bg-white dark:bg-slate-950 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead className="text-right">Productos</TableHead>
              <TableHead className="text-right">Stock Total</TableHead>
              <TableHead className="text-right">Bajo Stock</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Cargando depósitos...
                </TableCell>
              </TableRow>
            ) : warehouses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No hay depósitos creados
                </TableCell>
              </TableRow>
            ) : (
              warehouses.map((wh) => (
                <React.Fragment key={wh.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    onClick={() => setExpandedWarehouse(expandedWarehouse === wh.id ? null : wh.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <WarehouseIcon className="h-4 w-4 text-muted-foreground" />
                        {wh.name}
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform ${
                            expandedWarehouse === wh.id ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">
                      {wh.code}
                    </TableCell>
                    <TableCell>{getTypeBadge(wh.type)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                      {wh.address || '—'}
                    </TableCell>
                    <TableCell className="text-right">{wh.stockSummary.totalProducts}</TableCell>
                    <TableCell className="text-right font-medium">{wh.stockSummary.totalStock}</TableCell>
                    <TableCell className="text-right">
                      {wh.stockSummary.lowStockCount > 0 ? (
                        <span className="text-yellow-600 dark:text-yellow-400 font-semibold flex items-center justify-end gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {wh.stockSummary.lowStockCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingWarehouse(wh)
                            setFormOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeletingWarehouse(wh)
                            setDeleteConfirmOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {/* Expanded warehouse detail */}
                  {expandedWarehouse === wh.id && (
                    <TableRow key={`${wh.id}-detail`}>
                      <TableCell colSpan={8} className="bg-slate-50 dark:bg-slate-900/30 p-0">
                        {detailLoading ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            Cargando detalle...
                          </div>
                        ) : warehouseDetail ? (
                          <div className="p-4 space-y-3">
                            {/* Summary cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <Card className="py-3">
                                <CardContent className="p-3 text-center">
                                  <p className="text-2xl font-bold">{warehouseDetail.stockSummary.totalProducts}</p>
                                  <p className="text-xs text-muted-foreground">Productos</p>
                                </CardContent>
                              </Card>
                              <Card className="py-3">
                                <CardContent className="p-3 text-center">
                                  <p className="text-2xl font-bold">{warehouseDetail.stockSummary.totalStock}</p>
                                  <p className="text-xs text-muted-foreground">Unidades</p>
                                </CardContent>
                              </Card>
                              <Card className="py-3">
                                <CardContent className="p-3 text-center">
                                  <p className="text-2xl font-bold text-yellow-600">{warehouseDetail.stockSummary.lowStockCount}</p>
                                  <p className="text-xs text-muted-foreground">Bajo Stock</p>
                                </CardContent>
                              </Card>
                              <Card className="py-3">
                                <CardContent className="p-3 text-center">
                                  <p className="text-2xl font-bold">${warehouseDetail.stockSummary.totalValue.toLocaleString('es-AR')}</p>
                                  <p className="text-xs text-muted-foreground">Valor Total</p>
                                </CardContent>
                              </Card>
                            </div>

                            {/* Stock per product */}
                            {warehouseDetail.stocks.length > 0 ? (
                              <div className="rounded-md border bg-white dark:bg-slate-950 overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Producto</TableHead>
                                      <TableHead>Categoría</TableHead>
                                      <TableHead className="text-right">Stock</TableHead>
                                      <TableHead className="text-right">Mínimo</TableHead>
                                      <TableHead>Estado</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {warehouseDetail.stocks.map((s) => (
                                      <TableRow key={s.id}>
                                        <TableCell className="font-medium">{s.product.name}</TableCell>
                                        <TableCell>
                                          {s.product.category ? (
                                            <Badge variant="secondary" className="text-xs">
                                              {s.product.category.name}
                                            </Badge>
                                          ) : (
                                            <span className="text-muted-foreground">—</span>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                          <span className={
                                            s.stock === 0
                                              ? 'text-red-600 dark:text-red-400 font-bold'
                                              : s.stock <= s.minStock
                                                ? 'text-yellow-600 dark:text-yellow-400 font-semibold'
                                                : 'text-emerald-600 dark:text-emerald-400'
                                          }>
                                            {s.stock}
                                          </span>
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">{s.minStock}</TableCell>
                                        <TableCell>
                                          {s.stock === 0 ? (
                                            <Badge variant="secondary" className="bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-100 dark:border-rose-800/30 text-xs">
                                              Sin Stock
                                            </Badge>
                                          ) : s.stock <= s.minStock ? (
                                            <Badge variant="secondary" className="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30 text-xs">
                                              Bajo Stock
                                            </Badge>
                                          ) : (
                                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">
                                              Normal
                                            </Badge>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                <Package className="h-8 w-8 mb-2" />
                                <p className="text-sm">Sin productos en este depósito</p>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Warehouse Form Dialog */}
      <WarehouseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        warehouse={editingWarehouse}
      />

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Desactivar Depósito</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas desactivar &quot;{deletingWarehouse?.name}&quot;?
              El depósito no se eliminará permanentemente, pero no estará disponible para operaciones.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingWarehouse && deleteMutation.mutate(deletingWarehouse.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Desactivando...' : 'Desactivar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
