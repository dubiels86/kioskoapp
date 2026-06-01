'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Eye, Truck, ChevronLeft, ChevronRight, Warehouse } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'
import { PURCHASE_STATUS_LABELS } from '@/lib/types'
import type { PurchaseStatus } from '@/lib/types'
import { PurchaseFormDialog } from './purchase-form-dialog'
import { PurchaseDetailDialog } from './purchase-detail-dialog'
import { SupplierDialog } from './supplier-dialog'

interface Purchase {
  id: string
  supplierId?: string | null
  supplier?: { id: string; name: string } | null
  invoiceNumber?: string | null
  totalAmount: number
  status: PurchaseStatus
  notes?: string | null
  createdAt: string
  items: {
    id: string
    productId: string
    quantity: number
    costPrice: number
    subtotal: number
    product: { id: string; name: string }
    warehouse?: {
      id: string
      name: string
      code: string
      type: string
    } | null
  }[]
}

function getStatusBadgeClass(status: PurchaseStatus) {
  switch (status) {
    case 'PENDIENTE':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30 hover:bg-amber-50'
    case 'RECIBIDA':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30 hover:bg-emerald-50'
    case 'CANCELADA':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-100 dark:border-rose-800/30 hover:bg-rose-50'
    default:
      return ''
  }
}

const PAGE_SIZE = 10

export function PurchasesView() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  // Dialogs
  const [newPurchaseOpen, setNewPurchaseOpen] = useState(false)
  const [detailPurchaseId, setDetailPurchaseId] = useState<string | null>(null)
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)

  // Fetch purchases
  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: async () => {
      const res = await fetch('/api/purchases')
      if (!res.ok) throw new Error('Error al obtener compras')
      return res.json() as Promise<Purchase[]>
    },
  })

  // Filter
  const filteredPurchases = useMemo(() => {
    if (statusFilter === 'all') return purchases
    return purchases.filter((p) => p.status === statusFilter)
  }, [purchases, statusFilter])

  // Pagination
  const totalPages = Math.ceil(filteredPurchases.length / PAGE_SIZE)
  const paginatedPurchases = filteredPurchases.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  )

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => setNewPurchaseOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Nueva Compra
          </Button>
          <Button
            variant="outline"
            onClick={() => setSupplierDialogOpen(true)}
            className="gap-1.5"
          >
            <Truck className="h-4 w-4" />
            Proveedores
          </Button>
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="PENDIENTE">Pendiente</SelectItem>
            <SelectItem value="RECIBIDA">Recibida</SelectItem>
            <SelectItem value="CANCELADA">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Purchases table */}
      <div className="rounded-md border border-border bg-white dark:bg-slate-950 shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">#</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Depósito</TableHead>
              <TableHead>Factura</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Cargando compras...
                </TableCell>
              </TableRow>
            ) : paginatedPurchases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No se encontraron compras
                </TableCell>
              </TableRow>
            ) : (
              paginatedPurchases.map((purchase, idx) => {
                // Get warehouse from first item (all items share same warehouse)
                const warehouse = purchase.items?.[0]?.warehouse
                return (
                  <TableRow key={purchase.id}>
                    <TableCell className="text-muted-foreground text-sm">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      {purchase.supplier?.name || 'Sin proveedor'}
                    </TableCell>
                    <TableCell>
                      {warehouse ? (
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
                          {warehouse.name}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {purchase.invoiceNumber || '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(purchase.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={getStatusBadgeClass(purchase.status)}
                      >
                        {PURCHASE_STATUS_LABELS[purchase.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(purchase.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailPurchaseId(purchase.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredPurchases.length} compra{filteredPurchases.length !== 1 ? 's' : ''}
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

      {/* Dialogs */}
      <PurchaseFormDialog
        open={newPurchaseOpen}
        onOpenChange={setNewPurchaseOpen}
      />

      <PurchaseDetailDialog
        open={!!detailPurchaseId}
        onOpenChange={(open) => {
          if (!open) setDetailPurchaseId(null)
        }}
        purchaseId={detailPurchaseId}
      />

      <SupplierDialog
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
      />
    </div>
  )
}
