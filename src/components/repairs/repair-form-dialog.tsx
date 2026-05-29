'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'
import type { RepairStatus } from '@/lib/types'
import { REPAIR_STATUS_LABELS } from '@/lib/types'

interface RepairPart {
  partName: string
  productId?: string
  quantity: number
  costPrice: number
  salePrice: number
}

interface RepairFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  repair?: {
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
    notes: string | null
    parts: Array<{
      id: string
      partName: string
      quantity: number
      costPrice: number
      salePrice: number
      product?: { id: string; name: string } | null
    }>
  } | null
}

const emptyPart: RepairPart = {
  partName: '',
  quantity: 1,
  costPrice: 0,
  salePrice: 0,
}

export function RepairFormDialog({ open, onOpenChange, repair }: RepairFormDialogProps) {
  const isEditing = !!repair
  const queryClient = useQueryClient()

  const [customerName, setCustomerName] = useState(repair?.customerName || '')
  const [customerPhone, setCustomerPhone] = useState(repair?.customerPhone || '')
  const [device, setDevice] = useState(repair?.device || '')
  const [brand, setBrand] = useState(repair?.brand || '')
  const [model, setModel] = useState(repair?.model || '')
  const [serialNumber, setSerialNumber] = useState(repair?.serialNumber || '')
  const [issue, setIssue] = useState(repair?.issue || '')
  const [diagnosis, setDiagnosis] = useState(repair?.diagnosis || '')
  const [repairCost, setRepairCost] = useState(repair?.repairCost?.toString() || '0')
  const [notes, setNotes] = useState(repair?.notes || '')
  const [status, setStatus] = useState<RepairStatus>((repair?.status as RepairStatus) || 'RECIBIDO')
  const [parts, setParts] = useState<RepairPart[]>(
    repair?.parts?.map((p) => ({
      partName: p.partName,
      productId: p.product?.id,
      quantity: p.quantity,
      costPrice: p.costPrice,
      salePrice: p.salePrice,
    })) || []
  )

  const addPart = () => setParts([...parts, { ...emptyPart }])
  const removePart = (idx: number) => setParts(parts.filter((_, i) => i !== idx))
  const updatePart = (idx: number, field: keyof RepairPart, value: string | number) => {
    const updated = [...parts]
    updated[idx] = { ...updated[idx], [field]: value }
    setParts(updated)
  }

  const partsCostTotal = parts.reduce((sum, p) => sum + p.costPrice * p.quantity, 0)
  const totalCost = parseFloat(repairCost || '0') + partsCostTotal

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/repairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al crear reparación')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repairs'] })
      toast.success('Reparación creada correctamente')
      resetForm()
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/repairs/${repair!.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al actualizar reparación')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repairs'] })
      toast.success('Reparación actualizada correctamente')
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const resetForm = () => {
    setCustomerName('')
    setCustomerPhone('')
    setDevice('')
    setBrand('')
    setModel('')
    setSerialNumber('')
    setIssue('')
    setDiagnosis('')
    setRepairCost('0')
    setNotes('')
    setStatus('RECIBIDO')
    setParts([])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName.trim() || !device.trim() || !issue.trim()) {
      toast.error('Complete los campos requeridos: Nombre, Dispositivo y Problema')
      return
    }

    const data: Record<string, unknown> = {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      device: device.trim(),
      brand: brand.trim() || undefined,
      model: model.trim() || undefined,
      serialNumber: serialNumber.trim() || undefined,
      issue: issue.trim(),
      repairCost: parseFloat(repairCost || '0'),
      partsCost: partsCostTotal,
      totalCost,
    }

    if (isEditing) {
      data.diagnosis = diagnosis.trim() || undefined
      data.notes = notes.trim() || undefined
      data.status = status
      updateMutation.mutate(data)
    } else {
      data.notes = notes.trim() || undefined
      data.parts = parts.filter((p) => p.partName.trim()).map((p) => ({
        partName: p.partName.trim(),
        productId: p.productId || undefined,
        quantity: p.quantity,
        costPrice: p.costPrice,
        salePrice: p.salePrice,
      }))
      createMutation.mutate(data)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-emerald-600" />
            {isEditing ? 'Editar Reparación' : 'Nueva Reparación'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Actualice la información de la reparación.' : 'Registre una nueva reparación de dispositivo.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Información del Cliente
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Nombre *</Label>
                <Input
                  id="customerName"
                  placeholder="Nombre del cliente"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Teléfono</Label>
                <Input
                  id="customerPhone"
                  placeholder="Teléfono de contacto"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Device Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Información del Dispositivo
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="device">Dispositivo *</Label>
                <Input
                  id="device"
                  placeholder="Ej: Celular, Notebook, Tablet..."
                  value={device}
                  onChange={(e) => setDevice(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Marca</Label>
                <Input
                  id="brand"
                  placeholder="Ej: Samsung, Apple..."
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Modelo</Label>
                <Input
                  id="model"
                  placeholder="Modelo del dispositivo"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serialNumber">Número de Serie</Label>
                <Input
                  id="serialNumber"
                  placeholder="N° de serie / IMEI"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Issue */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Problema / Diagnóstico
            </h4>
            <div className="space-y-2">
              <Label htmlFor="issue">Problema reportado *</Label>
              <Textarea
                id="issue"
                placeholder="Describa el problema del dispositivo..."
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                rows={3}
                required
              />
            </div>
            {isEditing && (
              <div className="space-y-2">
                <Label htmlFor="diagnosis">Diagnóstico</Label>
                <Textarea
                  id="diagnosis"
                  placeholder="Diagnóstico técnico..."
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  rows={3}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                placeholder="Notas adicionales..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <Separator />

          {/* Status (only when editing) */}
          {isEditing && (
            <>
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Estado
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estado de la Reparación</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as RepairStatus)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(REPAIR_STATUS_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="repairCostEdit">Costo de Reparación (Mano de Obra)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <Input
                        id="repairCostEdit"
                        type="number"
                        step="0.01"
                        min="0"
                        value={repairCost}
                        onChange={(e) => setRepairCost(e.target.value)}
                        className="pl-7"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Repair Cost (new repair) */}
          {!isEditing && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Costos
              </h4>
              <div className="space-y-2">
                <Label htmlFor="repairCostNew">Costo de Reparación (Mano de Obra)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="repairCostNew"
                    type="number"
                    step="0.01"
                    min="0"
                    value={repairCost}
                    onChange={(e) => setRepairCost(e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Parts */}
          {!isEditing && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Repuestos
                  </h4>
                  <Button type="button" size="sm" variant="outline" onClick={addPart} className="gap-1">
                    <Plus className="w-4 h-4" />
                    Agregar Pieza
                  </Button>
                </div>

                {parts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No hay repuestos agregados. Haga clic en &quot;Agregar Pieza&quot; si es necesario.
                  </p>
                )}

                {parts.map((part, idx) => (
                  <div key={idx} className="rounded-lg border p-4 space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Pieza #{idx + 1}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removePart(idx)}
                        className="text-red-500 hover:text-red-700 h-7 w-7 p-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nombre de la Pieza *</Label>
                        <Input
                          placeholder="Ej: Pantalla, Batería..."
                          value={part.partName}
                          onChange={(e) => updatePart(idx, 'partName', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Cantidad</Label>
                        <Input
                          type="number"
                          min="1"
                          value={part.quantity}
                          onChange={(e) => updatePart(idx, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Precio de Costo</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={part.costPrice}
                            onChange={(e) => updatePart(idx, 'costPrice', parseFloat(e.target.value) || 0)}
                            className="pl-7"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Precio de Venta</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={part.salePrice}
                            onChange={(e) => updatePart(idx, 'salePrice', parseFloat(e.target.value) || 0)}
                            className="pl-7"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {parts.length > 0 && (
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Costo de Repuestos:</span>
                      <span>{formatCurrency(partsCostTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Mano de Obra:</span>
                      <span>{formatCurrency(parseFloat(repairCost || '0'))}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold">
                      <span>Total:</span>
                      <span>{formatCurrency(totalCost)}</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Total (editing) */}
          {isEditing && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Costo de Repuestos:</span>
                <span>{formatCurrency(partsCostTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Mano de Obra:</span>
                <span>{formatCurrency(parseFloat(repairCost || '0'))}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total:</span>
                <span>{formatCurrency(totalCost)}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isPending
                ? 'Guardando...'
                : isEditing
                  ? 'Actualizar Reparación'
                  : 'Crear Reparación'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
