'use client'

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { formatCurrency, formatDate } from '@/lib/format'
import { PURCHASE_STATUS_LABELS } from '@/lib/types'
import type { PurchaseStatus } from '@/lib/types'

interface PurchaseDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchaseId: string | null
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
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-100'
    case 'RECIBIDA':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100'
    case 'CANCELADA':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100'
    default:
      return ''
  }
}

export function PurchaseDetailDialog({ open, onOpenChange, purchaseId }: PurchaseDetailDialogProps) {
  const queryClient = useQueryClient()

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

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PurchaseStatus }) => {
      const res = await fetch(`/api/purchases/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
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
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
              <span className="font-medium">Total</span>
              <span className="text-xl font-bold text-teal-600 dark:text-teal-400">
                {formatCurrency(purchase.totalAmount)}
              </span>
            </div>

            {/* Status change buttons for PENDIENTE */}
            {purchase.status === 'PENDIENTE' && (
              <>
                <Separator />
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
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() =>
                      updateStatusMutation.mutate({
                        id: purchase.id,
                        status: 'RECIBIDA',
                      })
                    }
                    disabled={updateStatusMutation.isPending}
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
