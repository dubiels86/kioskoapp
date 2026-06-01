'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Phone, Calendar, Clock, CheckCircle, AlertCircle, Wrench } from 'lucide-react'
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

interface RepairDetail {
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

interface RepairDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  repair: RepairDetail | null
}

const statusStyles: Record<string, string> = {
  RECIBIDO: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border border-sky-100 dark:border-sky-800/30',
  EN_REPARACION: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30',
  ESPERANDO_REPUESTOS: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-100 dark:border-orange-800/30',
  REPARADO: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30',
  ENTREGADO: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border border-teal-100 dark:border-teal-800/30',
  CANCELADO: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-100 dark:border-rose-800/30',
}

export function RepairDetailDialog({ open, onOpenChange, repair }: RepairDetailDialogProps) {
  if (!repair) return null

  const statusLabel = REPAIR_STATUS_LABELS[repair.status as RepairStatus] || repair.status
  const statusClass = statusStyles[repair.status] || ''

  const timeline = [
    { label: 'Recibido', date: repair.receivedAt, icon: Clock, done: true },
    { label: 'En Reparación', date: null, icon: Wrench, done: ['EN_REPARACION', 'ESPERANDO_REPUESTOS', 'REPARADO', 'ENTREGADO'].includes(repair.status) },
    { label: 'Reparado', date: repair.completedAt, icon: CheckCircle, done: ['REPARADO', 'ENTREGADO'].includes(repair.status) },
    { label: 'Entregado', date: repair.deliveredAt, icon: AlertCircle, done: repair.status === 'ENTREGADO' },
  ].filter((_) => repair.status !== 'CANCELADO' || _.label === 'Recibido')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary" />
            Detalle de Reparación
          </DialogTitle>
          <DialogDescription>
            {repair.customerName} — {repair.device}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status & Device */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className={statusClass}>
              {statusLabel}
            </Badge>
            {repair.brand && (
              <Badge variant="outline">{repair.brand}</Badge>
            )}
            {repair.model && (
              <Badge variant="outline">{repair.model}</Badge>
            )}
          </div>

          {/* Customer Info */}
          <div className="rounded-lg border p-4 space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Cliente
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Nombre: </span>
                <span className="font-medium">{repair.customerName}</span>
              </div>
              {repair.customerPhone && (
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  <span className="font-medium">{repair.customerPhone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Device Info */}
          <div className="rounded-lg border p-4 space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Dispositivo
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Dispositivo: </span>
                <span className="font-medium">{repair.device}</span>
              </div>
              {repair.brand && (
                <div>
                  <span className="text-muted-foreground">Marca: </span>
                  <span className="font-medium">{repair.brand}</span>
                </div>
              )}
              {repair.model && (
                <div>
                  <span className="text-muted-foreground">Modelo: </span>
                  <span className="font-medium">{repair.model}</span>
                </div>
              )}
              {repair.serialNumber && (
                <div>
                  <span className="text-muted-foreground">N° Serie: </span>
                  <span className="font-medium">{repair.serialNumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* Issue */}
          <div className="rounded-lg border p-4 space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Problema Reportado
            </h4>
            <p className="text-sm whitespace-pre-wrap">{repair.issue}</p>
          </div>

          {/* Diagnosis */}
          {repair.diagnosis && (
            <div className="rounded-lg border p-4 space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Diagnóstico
              </h4>
              <p className="text-sm whitespace-pre-wrap">{repair.diagnosis}</p>
            </div>
          )}

          {/* Parts */}
          {repair.parts.length > 0 && (
            <div className="rounded-lg border p-4 space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Repuestos Utilizados
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pieza</TableHead>
                    <TableHead className="text-center">Cant.</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-right">Venta</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repair.parts.map((part) => (
                    <TableRow key={part.id}>
                      <TableCell className="text-sm">
                        {part.partName}
                        {part.product && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({part.product.name})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{part.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(part.costPrice)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(part.salePrice)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(part.costPrice * part.quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Cost Breakdown */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Costos
            </h4>
            <div className="flex justify-between text-sm">
              <span>Mano de Obra:</span>
              <span>{formatCurrency(repair.repairCost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Repuestos:</span>
              <span>{formatCurrency(repair.partsCost)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span>{formatCurrency(repair.totalCost)}</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-lg border p-4 space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Seguimiento
            </h4>
            <div className="space-y-3">
              {timeline.map((step, idx) => {
                const Icon = step.icon
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      step.done
                        ? 'bg-emerald-100 dark:bg-emerald-900/30'
                        : 'bg-slate-100 dark:bg-slate-800'
                    }`}>
                      <Icon className={`w-4 h-4 ${step.done ? 'text-emerald-600' : 'text-slate-400'}`} />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${step.done ? '' : 'text-muted-foreground'}`}>
                        {step.label}
                      </p>
                      {step.date && (
                        <p className="text-xs text-muted-foreground">
                          {formatDate(step.date)}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          {repair.notes && (
            <div className="rounded-lg border p-4 space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Notas
              </h4>
              <p className="text-sm whitespace-pre-wrap">{repair.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
