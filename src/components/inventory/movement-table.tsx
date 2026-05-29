'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import { formatDate } from '@/lib/format'
import type { MovementType } from '@/lib/types'
import { MOVEMENT_TYPE_LABELS } from '@/lib/types'

interface InventoryMovement {
  id: string
  productId: string
  type: MovementType
  quantity: number
  previousStock: number
  newStock: number
  reason?: string | null
  createdAt: string
  product: {
    id: string
    name: string
  }
  fromWarehouse?: {
    id: string
    name: string
    code: string
    type: string
  } | null
  toWarehouse?: {
    id: string
    name: string
    code: string
    type: string
  } | null
}

function getMovementBadgeVariant(type: MovementType) {
  switch (type) {
    case 'ENTRADA':
    case 'COMPRA':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30 hover:bg-emerald-50'
    case 'SALIDA':
    case 'VENTA':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-100 dark:border-rose-800/30 hover:bg-rose-50'
    case 'AJUSTE':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30 hover:bg-amber-50'
    case 'MERMA':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-100'
    case 'TRANSFERENCIA':
      return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 hover:bg-teal-100'
    default:
      return ''
  }
}

const MOVEMENT_TYPES: MovementType[] = ['ENTRADA', 'SALIDA', 'AJUSTE', 'COMPRA', 'VENTA', 'MERMA', 'TRANSFERENCIA']

function getWarehouseLabel(movement: InventoryMovement): string | null {
  if (movement.type === 'TRANSFERENCIA' && movement.fromWarehouse && movement.toWarehouse) {
    return `${movement.fromWarehouse.name} → ${movement.toWarehouse.name}`
  }
  if (movement.toWarehouse) {
    return `→ ${movement.toWarehouse.name}`
  }
  if (movement.fromWarehouse) {
    return `${movement.fromWarehouse.name} →`
  }
  return null
}

export function MovementTable() {
  const [productSearch, setProductSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const limit = 15

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-movements', page],
    queryFn: async () => {
      const res = await fetch(`/api/inventory?page=${page}&limit=${limit}`)
      if (!res.ok) throw new Error('Error al obtener movimientos')
      return res.json()
    },
  })

  const movements: InventoryMovement[] = data?.movements || []
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 }

  // Client-side filtering
  const filteredMovements = movements.filter((m) => {
    if (typeFilter !== 'all' && m.type !== typeFilter) return false
    if (productSearch && !m.product.name.toLowerCase().includes(productSearch.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar producto..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tipo de movimiento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {MOVEMENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {MOVEMENT_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-white dark:bg-slate-950 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Depósito</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Stock Anterior</TableHead>
              <TableHead className="text-right">Stock Nuevo</TableHead>
              <TableHead>Razón</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Cargando movimientos...
                </TableCell>
              </TableRow>
            ) : filteredMovements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No se encontraron movimientos
                </TableCell>
              </TableRow>
            ) : (
              filteredMovements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatDate(movement.createdAt)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {movement.product.name}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={getMovementBadgeVariant(movement.type)}
                    >
                      {MOVEMENT_TYPE_LABELS[movement.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {movement.type === 'TRANSFERENCIA' && movement.fromWarehouse && movement.toWarehouse ? (
                      <span className="text-xs flex items-center gap-1 whitespace-nowrap">
                        <span className="text-muted-foreground">{movement.fromWarehouse.name}</span>
                        <ArrowRight className="h-3 w-3 text-teal-500 shrink-0" />
                        <span className="text-muted-foreground">{movement.toWarehouse.name}</span>
                      </span>
                    ) : movement.toWarehouse ? (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        → {movement.toWarehouse.name}
                      </span>
                    ) : movement.fromWarehouse ? (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {movement.fromWarehouse.name} →
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {movement.type === 'SALIDA' || movement.type === 'VENTA' || movement.type === 'MERMA'
                      ? `-${movement.quantity}`
                      : `+${movement.quantity}`}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {movement.previousStock}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {movement.newStock}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {movement.reason || '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {pagination.total} movimiento{pagination.total !== 1 ? 's' : ''} en total
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
              Página {page} de {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
