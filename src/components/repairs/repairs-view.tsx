'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Wrench, Plus, Search, Phone, Eye, Edit, Clock, MoreVertical,
  Trash2, CheckCircle, Package, AlertTriangle, TrendingUp, Mail,
} from 'lucide-react'
import { RepairFormDialog } from './repair-form-dialog'
import { RepairDetailDialog } from './repair-detail-dialog'
import { formatCurrency, formatDate } from '@/lib/format'
import { REPAIR_STATUS_LABELS } from '@/lib/types'
import type { RepairStatus } from '@/lib/types'
import { toast } from 'sonner'

interface RepairPart {
  id: string; partName: string; quantity: number
  costPrice: number; salePrice: number
  product?: { id: string; name: string } | null
}

interface Repair {
  id: string
  ticketNumber?: string
  customerName: string
  customerPhone: string | null
  customerEmail?: string | null
  device: string
  brand: string | null
  model: string | null
  serialNumber: string | null
  condition?: string | null
  issue: string
  diagnosis: string | null
  priority?: string
  repairCost: number
  partsCost: number
  totalCost: number
  deposit?: number
  estimatedDate?: string | null
  status: string
  receivedAt: string
  completedAt: string | null
  deliveredAt: string | null
  notes: string | null
  internalNotes?: string | null
  parts: RepairPart[]
}

const STATUS_STYLES: Record<string, string> = {
  RECIBIDO: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800/30',
  EN_REPARACION: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/30',
  ESPERANDO_REPUESTOS: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/30',
  REPARADO: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30',
  ENTREGADO: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800/30',
  CANCELADO: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/30',
}

const PRIORITY_DOT: Record<string, string> = {
  URGENTE: 'bg-red-500',
  NORMAL: 'bg-blue-400',
  BAJA: 'bg-slate-300',
}

const STATUS_NEXT: Record<string, RepairStatus | null> = {
  RECIBIDO: 'EN_REPARACION',
  EN_REPARACION: 'REPARADO',
  ESPERANDO_REPUESTOS: 'REPARADO',
  REPARADO: 'ENTREGADO',
  ENTREGADO: null,
  CANCELADO: null,
}

const STATUS_NEXT_LABEL: Record<string, string> = {
  RECIBIDO: 'Iniciar reparación',
  EN_REPARACION: 'Marcar como reparado',
  ESPERANDO_REPUESTOS: 'Marcar como reparado',
  REPARADO: 'Marcar como entregado',
}

export function RepairsView() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingRepair, setEditingRepair] = useState<Repair | null>(null)
  const [detailRepair, setDetailRepair] = useState<Repair | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const queryClient = useQueryClient()

  const { data: repairs = [], isLoading } = useQuery<Repair[]>({
    queryKey: ['repairs', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (searchQuery) params.set('search', searchQuery)
      const res = await fetch(`/api/repairs?${params}`)
      if (!res.ok) throw new Error('Error')
      return res.json()
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/repairs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Error al actualizar estado')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repairs'] })
      toast.success('Estado actualizado')
    },
    onError: () => toast.error('Error al actualizar estado'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/repairs/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repairs'] })
      toast.success('Reparación eliminada')
      setDeleteId(null)
    },
    onError: () => toast.error('Error al eliminar'),
  })

  const filtered = repairs.filter(r => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      r.customerName.toLowerCase().includes(q) ||
      r.device.toLowerCase().includes(q) ||
      (r.brand?.toLowerCase().includes(q)) ||
      (r.model?.toLowerCase().includes(q)) ||
      (r.customerPhone?.includes(q)) ||
      (r.ticketNumber?.toLowerCase().includes(q))
    )
  })

  // Metrics
  const active = repairs.filter(r => !['ENTREGADO', 'CANCELADO'].includes(r.status))
  const urgent = repairs.filter(r => r.priority === 'URGENTE' && !['ENTREGADO', 'CANCELADO'].includes(r.status))
  const pending = repairs.filter(r => r.status === 'REPARADO')
  const totalRevenue = repairs.filter(r => r.status === 'ENTREGADO').reduce((s, r) => s + r.totalCost, 0)

  return (
    <>
      <div className="space-y-5">
        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'En proceso', value: active.length, icon: Wrench, color: 'text-blue-600' },
            { label: 'Urgentes', value: urgent.length, icon: AlertTriangle, color: 'text-red-500' },
            { label: 'Listas p/ entregar', value: pending.length, icon: CheckCircle, color: 'text-emerald-600' },
            { label: 'Facturado (total)', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'text-primary' },
          ].map(m => (
            <Card key={m.label} className="border shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted border flex items-center justify-center shrink-0">
                  <m.icon className={`w-4 h-4 ${m.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-lg font-bold">{m.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-1 w-full sm:max-w-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, ticket, dispositivo..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(REPAIR_STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditingRepair(null); setFormOpen(true) }} className="gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              Nueva Orden
            </Button>
          </div>
        </div>

        {/* Repairs grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-muted border flex items-center justify-center mb-4">
                <Wrench className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-lg font-semibold">Sin reparaciones</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery ? 'No se encontraron resultados' : 'Registrá una nueva orden para comenzar'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(repair => {
              const nextStatus = STATUS_NEXT[repair.status]
              const balance = repair.totalCost - (repair.deposit || 0)
              const isOverdue = repair.estimatedDate && new Date(repair.estimatedDate) < new Date() && !['ENTREGADO', 'CANCELADO'].includes(repair.status)

              return (
                <Card key={repair.id} className={`hover:shadow-md transition-shadow ${isOverdue ? 'border-red-300' : ''}`}>
                  <CardContent className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {repair.priority && repair.priority !== 'NORMAL' && (
                            <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[repair.priority]}`} />
                          )}
                          <span className="text-xs font-mono text-muted-foreground">{repair.ticketNumber || repair.id.slice(0, 8)}</span>
                          {isOverdue && (
                            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200 px-1 py-0">
                              Vencido
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-semibold text-sm">{repair.customerName}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {repair.customerPhone && (
                            <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{repair.customerPhone}</span>
                          )}
                          {repair.customerEmail && (
                            <span className="flex items-center gap-0.5"><Mail className="w-3 h-3" />email</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline" className={`text-xs ${STATUS_STYLES[repair.status]}`}>
                          {REPAIR_STATUS_LABELS[repair.status as RepairStatus]}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7">
                              <MoreVertical className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailRepair(repair)}>
                              <Eye className="w-4 h-4 mr-2" />Ver detalle
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditingRepair(repair); setFormOpen(true) }}>
                              <Edit className="w-4 h-4 mr-2" />Editar
                            </DropdownMenuItem>
                            {nextStatus && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: repair.id, status: nextStatus })}>
                                  <CheckCircle className="w-4 h-4 mr-2 text-emerald-600" />
                                  {STATUS_NEXT_LABEL[repair.status]}
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleteId(repair.id)} className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" />Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Device */}
                    <div className="flex items-center gap-1.5 text-sm">
                      <Wrench className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">
                        {[repair.device, repair.brand, repair.model].filter(Boolean).join(' ')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{repair.issue}</p>

                    {/* Parts badge */}
                    {repair.parts.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Package className="w-3 h-3" />
                        {repair.parts.length} {repair.parts.length === 1 ? 'repuesto' : 'repuestos'}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t gap-2">
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(repair.receivedAt)}
                        {repair.estimatedDate && (
                          <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                            · Entrega: {formatDate(repair.estimatedDate)}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-primary">{formatCurrency(repair.totalCost)}</div>
                        {balance > 0 && balance < repair.totalCost && (
                          <div className="text-[10px] text-amber-600">Saldo: {formatCurrency(balance)}</div>
                        )}
                      </div>
                    </div>

                    {/* Quick action */}
                    {nextStatus && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-7 text-xs gap-1"
                        onClick={() => updateStatusMutation.mutate({ id: repair.id, status: nextStatus })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <CheckCircle className="w-3 h-3" />
                        {STATUS_NEXT_LABEL[repair.status]}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <RepairFormDialog
        open={formOpen}
        onOpenChange={open => { setFormOpen(open); if (!open) setEditingRepair(null) }}
        repair={editingRepair}
      />
      <RepairDetailDialog
        open={!!detailRepair}
        onOpenChange={open => !open && setDetailRepair(null)}
        repair={detailRepair}
      />

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar reparación?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
