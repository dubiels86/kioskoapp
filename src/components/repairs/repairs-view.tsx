'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Wrench,
  Plus,
  Search,
  Phone,
  Eye,
  Edit,
  Clock,
} from 'lucide-react'
import { RepairFormDialog } from './repair-form-dialog'
import { RepairDetailDialog } from './repair-detail-dialog'
import { formatCurrency, formatDate } from '@/lib/format'
import { REPAIR_STATUS_LABELS } from '@/lib/types'
import type { RepairStatus } from '@/lib/types'

interface RepairPart {
  id: string
  partName: string
  quantity: number
  costPrice: number
  salePrice: number
  product?: { id: string; name: string } | null
}

interface Repair {
  id: string
  customerName: string
  customerPhone: string | null
  device: string
  brand: string | null
  model: string | null
  serialNumber: string | null
  issue: string
  diagnosis: string | null
  repairCost: number
  partsCost: number
  totalCost: number
  status: string
  receivedAt: string
  completedAt: string | null
  deliveredAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  parts: RepairPart[]
}

const statusStyles: Record<string, string> = {
  RECIBIDO: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border border-sky-100 dark:border-sky-800/30',
  EN_REPARACION: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30',
  ESPERANDO_REPUESTOS: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-100 dark:border-orange-800/30',
  REPARADO: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30',
  ENTREGADO: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border border-teal-100 dark:border-teal-800/30',
  CANCELADO: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-100 dark:border-rose-800/30',
}

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'RECIBIDO', label: 'Recibido' },
  { value: 'EN_REPARACION', label: 'En Reparación' },
  { value: 'ESPERANDO_REPUESTOS', label: 'Esperando Rep.' },
  { value: 'REPARADO', label: 'Reparado' },
  { value: 'ENTREGADO', label: 'Entregado' },
]

export function RepairsView() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [formDialog, setFormDialog] = useState(false)
  const [editingRepair, setEditingRepair] = useState<Repair | null>(null)
  const [detailRepair, setDetailRepair] = useState<Repair | null>(null)

  const { data: repairs = [], isLoading } = useQuery<Repair[]>({
    queryKey: ['repairs', statusFilter === 'all' ? '' : statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/repairs?${params.toString()}`)
      if (!res.ok) throw new Error('Error al obtener reparaciones')
      return res.json()
    },
  })

  const filteredRepairs = repairs.filter((r) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      r.customerName.toLowerCase().includes(q) ||
      r.device.toLowerCase().includes(q) ||
      (r.brand && r.brand.toLowerCase().includes(q)) ||
      (r.model && r.model.toLowerCase().includes(q)) ||
      (r.customerPhone && r.customerPhone.includes(q))
    )
  })

  const handleEdit = (repair: Repair) => {
    setEditingRepair(repair)
    setFormDialog(true)
  }

  const handleCloseForm = (open: boolean) => {
    setFormDialog(open)
    if (!open) setEditingRepair(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Cargando reparaciones...</div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, dispositivo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Button
            onClick={() => { setEditingRepair(null); setFormDialog(true) }}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nueva Reparación
          </Button>
        </div>

        {/* Status filter tabs */}
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="flex-wrap h-auto gap-1">
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Repairs list */}
        {filteredRepairs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-muted border rounded-2xl flex items-center justify-center mb-4">
                <Wrench className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Sin reparaciones
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery
                  ? 'No se encontraron resultados para la búsqueda.'
                  : statusFilter !== 'all'
                    ? `No hay reparaciones con estado "${REPAIR_STATUS_LABELS[statusFilter as RepairStatus] || statusFilter}".`
                    : 'Registre una nueva reparación para comenzar.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredRepairs.map((repair) => (
              <Card key={repair.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-sm truncate">{repair.customerName}</h4>
                      {repair.customerPhone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          {repair.customerPhone}
                        </div>
                      )}
                    </div>
                    <Badge variant="secondary" className={statusStyles[repair.status] || ''}>
                      {REPAIR_STATUS_LABELS[repair.status as RepairStatus] || repair.status}
                    </Badge>
                  </div>

                  {/* Device info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {[repair.device, repair.brand, repair.model].filter(Boolean).join(' ')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{repair.issue}</p>
                  </div>

                  {/* Cost & Date */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatDate(repair.receivedAt)}
                    </div>
                    <span className="font-semibold text-sm text-primary">
                      {formatCurrency(repair.totalCost)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1"
                      onClick={() => setDetailRepair(repair)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Ver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1"
                      onClick={() => handleEdit(repair)}
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <RepairFormDialog
        open={formDialog}
        onOpenChange={handleCloseForm}
        repair={editingRepair}
      />
      <RepairDetailDialog
        open={!!detailRepair}
        onOpenChange={(open) => !open && setDetailRepair(null)}
        repair={detailRepair}
      />
    </>
  )
}
