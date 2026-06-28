'use client'

import { useRef } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Phone, Mail, Calendar, Clock, CheckCircle, Wrench, Printer,
  AlertTriangle, Package, StickyNote,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'
import { REPAIR_STATUS_LABELS } from '@/lib/types'
import type { RepairStatus } from '@/lib/types'

interface RepairDetail {
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
  parts: Array<{
    id: string; partName: string; quantity: number
    costPrice: number; salePrice: number
    product?: { id: string; name: string } | null
  }>
}

const STATUS_STYLES: Record<string, string> = {
  RECIBIDO: 'bg-sky-50 text-sky-700 border-sky-200',
  EN_REPARACION: 'bg-amber-50 text-amber-700 border-amber-200',
  ESPERANDO_REPUESTOS: 'bg-orange-50 text-orange-700 border-orange-200',
  REPARADO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ENTREGADO: 'bg-teal-50 text-teal-700 border-teal-200',
  CANCELADO: 'bg-rose-50 text-rose-700 border-rose-200',
}

const PRIORITY_STYLES: Record<string, string> = {
  URGENTE: 'bg-red-50 text-red-700 border-red-200',
  NORMAL: 'bg-blue-50 text-blue-700 border-blue-200',
  BAJA: 'bg-slate-50 text-slate-600 border-slate-200',
}

const PRIORITY_LABELS: Record<string, string> = {
  URGENTE: '🔴 Urgente',
  NORMAL: '🔵 Normal',
  BAJA: '⚪ Baja',
}

export function RepairDetailDialog({
  open, onOpenChange, repair,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  repair: RepairDetail | null
}) {
  const printRef = useRef<HTMLDivElement>(null)

  if (!repair) return null

  const balance = repair.totalCost - (repair.deposit || 0)

  const TIMELINE = [
    { label: 'Recibido', date: repair.receivedAt, done: true },
    {
      label: 'En Reparación', date: null,
      done: ['EN_REPARACION', 'ESPERANDO_REPUESTOS', 'REPARADO', 'ENTREGADO'].includes(repair.status),
    },
    { label: 'Completado', date: repair.completedAt, done: ['REPARADO', 'ENTREGADO'].includes(repair.status) },
    { label: 'Entregado', date: repair.deliveredAt, done: repair.status === 'ENTREGADO' },
  ]

  const handlePrint = () => {
    const content = printRef.current?.innerHTML || ''
    const win = window.open('', '_blank', 'width=400,height=600')
    if (!win) return
    win.document.write(`
      <html><head><title>Ticket ${repair.ticketNumber || repair.id}</title>
      <style>
        body { font-family: monospace; font-size: 12px; padding: 16px; max-width: 300px; margin: 0 auto; }
        h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; }
        .total { font-size: 14px; font-weight: bold; }
      </style></head>
      <body>
        <h1>ORDEN DE REPARACIÓN</h1>
        <p class="center bold">${repair.ticketNumber || repair.id}</p>
        <div class="line"></div>
        <p><b>Cliente:</b> ${repair.customerName}</p>
        ${repair.customerPhone ? `<p><b>Tel:</b> ${repair.customerPhone}</p>` : ''}
        <div class="line"></div>
        <p><b>Dispositivo:</b> ${repair.device}${repair.brand ? ` ${repair.brand}` : ''}${repair.model ? ` ${repair.model}` : ''}</p>
        ${repair.serialNumber ? `<p><b>IMEI/Serie:</b> ${repair.serialNumber}</p>` : ''}
        ${repair.condition ? `<p><b>Condición:</b> ${repair.condition}</p>` : ''}
        <div class="line"></div>
        <p><b>Problema:</b> ${repair.issue}</p>
        ${repair.estimatedDate ? `<p><b>Entrega estimada:</b> ${formatDate(repair.estimatedDate)}</p>` : ''}
        <div class="line"></div>
        ${repair.parts.length > 0 ? `
          <p class="bold">Repuestos:</p>
          ${repair.parts.map(p => `<div class="row"><span>${p.partName} x${p.quantity}</span><span>$${(p.salePrice * p.quantity).toFixed(2)}</span></div>`).join('')}
          <div class="line"></div>
        ` : ''}
        <div class="row"><span>Mano de obra:</span><span>$${repair.repairCost.toFixed(2)}</span></div>
        <div class="row total"><span>TOTAL:</span><span>$${repair.totalCost.toFixed(2)}</span></div>
        ${(repair.deposit || 0) > 0 ? `<div class="row"><span>Seña:</span><span>$${repair.deposit!.toFixed(2)}</span></div><div class="row bold"><span>Saldo:</span><span>$${balance.toFixed(2)}</span></div>` : ''}
        <div class="line"></div>
        <p class="center">Recibido: ${formatDate(repair.receivedAt)}</p>
        ${repair.notes ? `<p><b>Notas:</b> ${repair.notes}</p>` : ''}
      </body></html>
    `)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              {repair.ticketNumber || 'Detalle de Reparación'}
            </DialogTitle>
            <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1 mr-6">
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4" ref={printRef}>
          {/* Status row */}
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline" className={STATUS_STYLES[repair.status]}>
              {REPAIR_STATUS_LABELS[repair.status as RepairStatus] || repair.status}
            </Badge>
            {repair.priority && repair.priority !== 'NORMAL' && (
              <Badge variant="outline" className={PRIORITY_STYLES[repair.priority]}>
                {PRIORITY_LABELS[repair.priority] || repair.priority}
              </Badge>
            )}
            {repair.estimatedDate && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Entrega est.: {formatDate(repair.estimatedDate)}
              </span>
            )}
          </div>

          {/* Customer + Device */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border p-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Cliente</p>
              <p className="font-medium">{repair.customerName}</p>
              {repair.customerPhone && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />{repair.customerPhone}
                </p>
              )}
              {repair.customerEmail && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3" />{repair.customerEmail}
                </p>
              )}
            </div>
            <div className="rounded-lg border p-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Dispositivo</p>
              <p className="font-medium">{[repair.device, repair.brand, repair.model].filter(Boolean).join(' ')}</p>
              {repair.serialNumber && (
                <p className="text-sm text-muted-foreground">IMEI: {repair.serialNumber}</p>
              )}
              {repair.condition && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">{repair.condition}</p>
              )}
            </div>
          </div>

          {/* Problem & Diagnosis */}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Problema reportado</p>
            <p className="text-sm">{repair.issue}</p>
            {repair.diagnosis && (
              <>
                <Separator />
                <p className="text-xs font-semibold text-muted-foreground uppercase">Diagnóstico</p>
                <p className="text-sm">{repair.diagnosis}</p>
              </>
            )}
          </div>

          {/* Parts */}
          {repair.parts.length > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <Package className="w-3.5 h-3.5" />Repuestos
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pieza</TableHead>
                    <TableHead className="text-center">Cant.</TableHead>
                    <TableHead className="text-right">P. Costo</TableHead>
                    <TableHead className="text-right">P. Venta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repair.parts.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{p.partName}</TableCell>
                      <TableCell className="text-center">{p.quantity}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(p.costPrice)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(p.salePrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Costs */}
          <div className="rounded-lg bg-muted/40 p-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mano de obra:</span>
              <span>{formatCurrency(repair.repairCost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Repuestos:</span>
              <span>{formatCurrency(repair.partsCost)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>Total:</span>
              <span>{formatCurrency(repair.totalCost)}</span>
            </div>
            {(repair.deposit || 0) > 0 && (
              <>
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Seña recibida:</span>
                  <span>{formatCurrency(repair.deposit!)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-amber-600">
                  <span>Saldo a cobrar:</span>
                  <span>{formatCurrency(balance)}</span>
                </div>
              </>
            )}
          </div>

          {/* Timeline */}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />Seguimiento
            </p>
            <div className="flex items-center gap-0">
              {TIMELINE.map((step, idx) => (
                <div key={idx} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      step.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                    }`}>
                      {step.done ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                    </div>
                    <p className={`text-[10px] mt-1 text-center leading-tight ${step.done ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                      {step.label}
                    </p>
                    {step.date && <p className="text-[9px] text-muted-foreground">{formatDate(step.date)}</p>}
                  </div>
                  {idx < TIMELINE.length - 1 && (
                    <div className={`flex-1 h-0.5 mb-5 ${step.done && TIMELINE[idx + 1].done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {repair.notes && (
            <div className="rounded-lg border p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <StickyNote className="w-3.5 h-3.5" />Notas para el cliente
              </p>
              <p className="text-sm">{repair.notes}</p>
            </div>
          )}
          {repair.internalNotes && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-700 uppercase flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />Notas internas
              </p>
              <p className="text-sm text-amber-800">{repair.internalNotes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
