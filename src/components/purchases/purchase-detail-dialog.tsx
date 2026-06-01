'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Warehouse as WarehouseIcon } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatDate } from '@/lib/format'
import { PURCHASE_STATUS_LABELS } from '@/lib/types'
import type { PurchaseStatus } from '@/lib/types'

interface PurchaseDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchaseId: string | null
}

interface WarehouseItem {
  id: string
  name: string
  code: string
  type: string
  isActive: boolean
}

interface PurchaseItem {
  id: string
  productId: string
  quantity: number
  costPrice: number
  subtotal: number
  product: {
    id: string
    name: string
  }
  warehouse?: {
    id: string
    name: string
    code: string
    type: string
  } | null
}

interface Purchase {
  id: string
  supplierId?: string | null
  supplier?: { id: string; name: string } | null
  invoiceNumber?: string | null
  totalAmount: number
  status: PurchaseStatus
  notes?: string | null
  createdAt: string
  items: PurchaseItem[]
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

export function PurchaseDetailDialog({ open, onOpenChange, purchaseId }: PurchaseDetailDialogProps) {
  const queryClient = useQueryClient()
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null)

  const { data: purchase, isLoading } = useQuery({
    queryKey: ['purchase', purchaseId],
    queryFn: async () => {
      if (!purchaseId) return null
      const res = await fetch(`/api/purchases/${purchaseId}`)
      if (!res.ok) throw new Error('Error al obtener compra')
      return res.json() as Promise<Purchase>
    },
    enabled: !!purchaseId && open,
  })

  // Fetch warehouses for the receive selector
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await fetch('/api/warehouses')
      if (!res.ok) throw new Error('Error al obtener depósitos')
      return res.json() as Promise<WarehouseItem[]>
    },
    enabled: open,
  })

  // Compute effective warehouse ID: user selection > PRINCIPAL default > first warehouse
  const defaultWarehouseId = useMemo(() => {
    const principal = warehouses.find((w) => w.type === 'PRINCIPAL')
    return principal?.id ?? warehouses[0]?.id ?? null
  }, [warehouses])

  const receiveWarehouseId = selectedWarehouseId ?? defaultWarehouseId ?? ''

  // Determine the warehouse from the purchase items (all items share the same warehouse when received)
  const purchaseWarehouse = purchase?.items?.[0]?.warehouse ?? null

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, warehouseId: whId }: { id: string; status: PurchaseStatus; warehouseId?: string }) => {
      const body: Record<string, unknown> = { status }
      if (status === 'RECIBIDA' && whId) {
        body.warehouseId = whId
      }
      const res = await fetch(`/api/purchases/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al actualizar estado')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
      toast.success('Estado actualizado correctamente')
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const handleReceive = () => {
    if (!receiveWarehouseId) {
      toast.error('Selecciona un depósito para recibir los productos')
      return
    }
    updateStatusMutation.mutate({
      id: purchase!.id,
      status: 'RECIBIDA',
      warehouseId: receiveWarehouseId,
    })
  }

  const selectedWarehouse = warehouses.find((w) => w.id === receiveWarehouseId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle de Compra</DialogTitle>
          <DialogDescription>
            Información completa de la compra
          </DialogDescription>
        </DialogHeader>

        {isLoading || !purchase ? (
          <div className="py-8 text-center text-muted-foreground">Cargando...</div>
        ) : (
          <div className="space-y-4">
            {/* Purchase info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Proveedor</p>
                <p className="font-medium">{purchase.supplier?.name || 'Sin proveedor'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Factura</p>
                <p className="font-medium">{purchase.invoiceNumber || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fecha</p>
                <p className="font-medium">{formatDate(purchase.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Estado</p>
                <Badge className={getStatusBadgeClass(purchase.status)}>
                  {PURCHASE_STATUS_LABELS[purchase.status]}
                </Badge>
              </div>
            </div>

            {/* Warehouse info for received purchases */}
            {purchaseWarehouse && purchase.status === 'RECIBIDA' && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <WarehouseIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <p className="text-sm">
                  Productos recibidos en: <span className="font-medium text-emerald-700 dark:text-emerald-300">{purchaseWarehouse.name}</span>
                </p>
              </div>
            )}

            {/* Warehouse info for pending purchases (if items have warehouse) */}
            {purchaseWarehouse && purchase.status === 'PENDIENTE' && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <WarehouseIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                <p className="text-sm">
                  Los productos se recibirán en: <span className="font-medium text-yellow-700 dark:text-yellow-300">{purchaseWarehouse.name}</span>
                </p>
              </div>
            )}

            {purchase.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Notas</p>
                <p className="text-sm">{purchase.notes}</p>
              </div>
            )}

            <Separator />

            {/* Items */}
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">P. Costo</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchase.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.product.name}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.costPrice)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <span className="font-medium">Total</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(purchase.totalAmount)}
              </span>
            </div>

            {/* Status change buttons for PENDIENTE */}
            {purchase.status === 'PENDIENTE' && (
              <>
                <Separator />
                {/* Warehouse selector for receiving */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <WarehouseIcon className="h-4 w-4" />
                    Depósito de Recepción
                  </Label>
                  <Select value={receiveWarehouseId} onValueChange={setSelectedWarehouseId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar depósito..." />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedWarehouse && (
                    <p className="text-sm text-muted-foreground">
                      Los productos se recibirán en: <span className="font-medium text-foreground">{selectedWarehouse.name}</span>
                    </p>
                  )}
                </div>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() =>
                      updateStatusMutation.mutate({
                        id: purchase.id,
                        status: 'CANCELADA',
                      })
                    }
                    disabled={updateStatusMutation.isPending}
                  >
                    Cancelar Compra
                  </Button>
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                    onClick={handleReceive}
                    disabled={updateStatusMutation.isPending || !receiveWarehouseId}
                  >
                    Marcar Recibida
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
