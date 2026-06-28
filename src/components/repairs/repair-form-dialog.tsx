'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { CreatableSelect } from '@/components/ui/creatable-select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2, Wrench, User, Smartphone, AlertTriangle } from 'lucide-react'
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
    notes: string | null
    internalNotes?: string | null
    parts: Array<{
      id: string; partName: string; quantity: number
      costPrice: number; salePrice: number
      product?: { id: string; name: string } | null
    }>
  } | null
}

const PRIORITY_OPTIONS = [
  { value: 'BAJA', label: 'Baja', color: 'text-slate-600' },
  { value: 'NORMAL', label: 'Normal', color: 'text-blue-600' },
  { value: 'URGENTE', label: 'Urgente', color: 'text-red-600' },
]

export function RepairFormDialog({ open, onOpenChange, repair }: RepairFormDialogProps) {
  const isEditing = !!repair
  const queryClient = useQueryClient()

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Error')
      return res.json() as Record<string, { key: string; value: string; label: string }[]>
    },
  })

  const { data: repairs = [] } = useQuery({
    queryKey: ['repairs'],
    queryFn: async () => {
      const res = await fetch('/api/repairs')
      if (!res.ok) throw new Error('Error')
      return res.json() as Array<{ brand: string | null; device: string }>
    },
  })

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await fetch('/api/products?active=true')
      if (!res.ok) throw new Error('Error')
      return res.json() as Array<{ id: string; name: string; costPrice: number; salePrice: number; stock: number }>
    },
  })

  const customBrands: string[] = settings?.custom_options?.find(s => s.key === 'custom_repair_brands')?.value
    ? JSON.parse(settings.custom_options.find(s => s.key === 'custom_repair_brands')!.value) : []
  const customDevices: string[] = settings?.custom_options?.find(s => s.key === 'custom_repair_devices')?.value
    ? JSON.parse(settings.custom_options.find(s => s.key === 'custom_repair_devices')!.value) : []

  const ALL_BRANDS = [...new Set([
    ...repairs.map(r => r.brand).filter(Boolean) as string[],
    ...customBrands,
  ])].sort()
  const ALL_DEVICES = [...new Set([
    ...repairs.map(r => r.device).filter(Boolean) as string[],
    ...customDevices,
  ])].sort()

  // Form state
  const [customerName, setCustomerName] = useState(repair?.customerName || '')
  const [customerPhone, setCustomerPhone] = useState(repair?.customerPhone || '')
  const [customerEmail, setCustomerEmail] = useState(repair?.customerEmail || '')
  const [device, setDevice] = useState(repair?.device || '')
  const [brand, setBrand] = useState(repair?.brand || '')
  const [model, setModel] = useState(repair?.model || '')
  const [serialNumber, setSerialNumber] = useState(repair?.serialNumber || '')
  const [condition, setCondition] = useState(repair?.condition || '')
  const [issue, setIssue] = useState(repair?.issue || '')
  const [diagnosis, setDiagnosis] = useState(repair?.diagnosis || '')
  const [priority, setPriority] = useState(repair?.priority || 'NORMAL')
  const [repairCost, setRepairCost] = useState(repair?.repairCost?.toString() || '0')
  const [deposit, setDeposit] = useState(repair?.deposit?.toString() || '0')
  const [estimatedDate, setEstimatedDate] = useState(
    repair?.estimatedDate ? new Date(repair.estimatedDate).toISOString().split('T')[0] : ''
  )
  const [status, setStatus] = useState<RepairStatus>((repair?.status as RepairStatus) || 'RECIBIDO')
  const [notes, setNotes] = useState(repair?.notes || '')
  const [internalNotes, setInternalNotes] = useState(repair?.internalNotes || '')
  const [parts, setParts] = useState<RepairPart[]>(
    repair?.parts?.map(p => ({
      partName: p.partName,
      productId: p.product?.id,
      quantity: p.quantity,
      costPrice: p.costPrice,
      salePrice: p.salePrice,
    })) || []
  )

  const partsCostTotal = parts.reduce((sum, p) => sum + p.costPrice * p.quantity, 0)
  const totalCost = (parseFloat(repairCost) || 0) + partsCostTotal
  const balance = totalCost - (parseFloat(deposit) || 0)

  const addPart = () => setParts([...parts, { partName: '', quantity: 1, costPrice: 0, salePrice: 0 }])
  const removePart = (i: number) => setParts(parts.filter((_, idx) => idx !== i))
  const updatePart = (i: number, field: keyof RepairPart, value: unknown) => {
    const updated = [...parts]
    updated[i] = { ...updated[i], [field]: value }
    setParts(updated)
  }

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const url = isEditing ? `/api/repairs/${repair!.id}` : '/api/repairs'
      const method = isEditing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al guardar')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repairs'] })
      toast.success(isEditing ? 'Reparación actualizada' : 'Reparación creada correctamente')
      if (!isEditing) resetForm()
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const resetForm = () => {
    setCustomerName(''); setCustomerPhone(''); setCustomerEmail('')
    setDevice(''); setBrand(''); setModel(''); setSerialNumber(''); setCondition('')
    setIssue(''); setDiagnosis(''); setPriority('NORMAL')
    setRepairCost('0'); setDeposit('0'); setEstimatedDate('')
    setStatus('RECIBIDO'); setNotes(''); setInternalNotes(''); setParts([])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName.trim() || !device.trim() || !issue.trim()) {
      toast.error('Nombre del cliente, dispositivo y problema son requeridos')
      return
    }
    saveMutation.mutate({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      customerEmail: customerEmail.trim() || undefined,
      device: device.trim(),
      brand: brand.trim() || undefined,
      model: model.trim() || undefined,
      serialNumber: serialNumber.trim() || undefined,
      condition: condition.trim() || undefined,
      issue: issue.trim(),
      diagnosis: diagnosis.trim() || undefined,
      priority,
      repairCost: parseFloat(repairCost) || 0,
      partsCost: partsCostTotal,
      totalCost,
      deposit: parseFloat(deposit) || 0,
      estimatedDate: estimatedDate || undefined,
      status,
      notes: notes.trim() || undefined,
      internalNotes: internalNotes.trim() || undefined,
      parts: parts.filter(p => p.partName.trim()).map(p => ({
        partName: p.partName.trim(),
        productId: p.productId || undefined,
        quantity: p.quantity,
        costPrice: p.costPrice,
        salePrice: p.salePrice,
      })),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary" />
            {isEditing ? `Editar Reparación ${repair.id ? `— ${(repair as any).ticketNumber || ''}` : ''}` : 'Nueva Orden de Reparación'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="cliente" className="space-y-4">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="cliente" className="gap-1 text-xs">
                <User className="w-3.5 h-3.5" />Cliente
              </TabsTrigger>
              <TabsTrigger value="dispositivo" className="gap-1 text-xs">
                <Smartphone className="w-3.5 h-3.5" />Dispositivo
              </TabsTrigger>
              <TabsTrigger value="repuestos" className="gap-1 text-xs">
                <Wrench className="w-3.5 h-3.5" />Repuestos
              </TabsTrigger>
              <TabsTrigger value="costos" className="gap-1 text-xs">
                <AlertTriangle className="w-3.5 h-3.5" />Costos
              </TabsTrigger>
            </TabsList>

            {/* Tab: Cliente */}
            <TabsContent value="cliente" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre del cliente *</Label>
                  <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nombre completo" required />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Número de contacto" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Email</Label>
                  <Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="correo@ejemplo.com" />
                </div>
              </div>
            </TabsContent>

            {/* Tab: Dispositivo */}
            <TabsContent value="dispositivo" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de dispositivo *</Label>
                  <CreatableSelect
                    options={ALL_DEVICES.map(d => ({ value: d, label: d }))}
                    value={device}
                    onValueChange={setDevice}
                    onCreate={async name => {
                      const updated = [...customDevices, name]
                      await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ custom_repair_devices: JSON.stringify(updated) }) })
                      return name
                    }}
                    placeholder="Celular, Notebook, Tablet..."
                    searchPlaceholder="Buscar..."
                    createLabel="Crear '{0}'"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Marca</Label>
                  <CreatableSelect
                    options={ALL_BRANDS.map(b => ({ value: b, label: b }))}
                    value={brand}
                    onValueChange={setBrand}
                    onCreate={async name => {
                      const updated = [...customBrands, name]
                      await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ custom_repair_brands: JSON.stringify(updated) }) })
                      return name
                    }}
                    placeholder="Samsung, Apple, Motorola..."
                    searchPlaceholder="Buscar..."
                    createLabel="Crear '{0}'"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <Input value={model} onChange={e => setModel(e.target.value)} placeholder="Galaxy S21, iPhone 14..." />
                </div>
                <div className="space-y-2">
                  <Label>N° Serie / IMEI</Label>
                  <Input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder="IMEI o número de serie" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Condición al ingreso</Label>
                  <Textarea value={condition} onChange={e => setCondition(e.target.value)} placeholder="Ej: Pantalla rajada en esquina, sin cargador, carcasa rayada..." rows={2} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Problema reportado *</Label>
                  <Textarea value={issue} onChange={e => setIssue(e.target.value)} placeholder="¿Qué problema tiene el dispositivo?" rows={3} required />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Diagnóstico técnico</Label>
                  <Textarea value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Diagnóstico del técnico..." rows={2} />
                </div>
              </div>
            </TabsContent>

            {/* Tab: Repuestos */}
            <TabsContent value="repuestos" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Agregá las piezas usadas en la reparación</p>
                <Button type="button" size="sm" variant="outline" onClick={addPart} className="gap-1">
                  <Plus className="w-4 h-4" />Agregar pieza
                </Button>
              </div>

              {parts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg">
                  No hay repuestos cargados
                </div>
              ) : (
                <div className="space-y-3">
                  {parts.map((part, idx) => (
                    <div key={idx} className="rounded-lg border p-3 space-y-3 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Pieza #{idx + 1}</span>
                        <Button type="button" size="icon" variant="ghost" onClick={() => removePart(idx)} className="h-6 w-6 text-red-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Producto del inventario</Label>
                          <Select
                            value={part.productId || 'none'}
                            onValueChange={val => {
                              if (val === 'none') {
                                updatePart(idx, 'productId', undefined)
                              } else {
                                const p = products.find(p => p.id === val)
                                if (p) {
                                  updatePart(idx, 'productId', p.id)
                                  updatePart(idx, 'partName', p.name)
                                  updatePart(idx, 'costPrice', p.costPrice)
                                  updatePart(idx, 'salePrice', p.salePrice)
                                }
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Seleccionar del inventario (opcional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Ingresar manualmente —</SelectItem>
                              {products.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} · Stock: {p.stock}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Nombre de la pieza *</Label>
                          <Input
                            placeholder="Ej: Pantalla, Batería..."
                            value={part.partName}
                            onChange={e => updatePart(idx, 'partName', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Cantidad</Label>
                          <Input type="number" min="1" value={part.quantity} onChange={e => updatePart(idx, 'quantity', parseInt(e.target.value) || 1)} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Precio costo</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                            <Input type="number" step="0.01" min="0" value={part.costPrice} onChange={e => updatePart(idx, 'costPrice', parseFloat(e.target.value) || 0)} className="h-8 text-sm pl-5" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Precio venta</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                            <Input type="number" step="0.01" min="0" value={part.salePrice} onChange={e => updatePart(idx, 'salePrice', parseFloat(e.target.value) || 0)} className="h-8 text-sm pl-5" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Subtotal</Label>
                          <div className="h-8 flex items-center text-sm font-medium px-2 bg-muted rounded border">
                            {formatCurrency(part.costPrice * part.quantity)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {parts.length > 0 && (
                <div className="flex justify-between text-sm font-semibold bg-muted/50 rounded-lg px-4 py-2">
                  <span>Total repuestos:</span>
                  <span>{formatCurrency(partsCostTotal)}</span>
                </div>
              )}
            </TabsContent>

            {/* Tab: Costos y Estado */}
            <TabsContent value="costos" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={status} onValueChange={v => setStatus(v as RepairStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REPAIR_STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Fecha estimada de entrega</Label>
                  <Input type="date" value={estimatedDate} onChange={e => setEstimatedDate(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Mano de obra</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input type="number" step="0.01" min="0" value={repairCost} onChange={e => setRepairCost(e.target.value)} className="pl-7" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Seña / Adelanto</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input type="number" step="0.01" min="0" value={deposit} onChange={e => setDeposit(e.target.value)} className="pl-7" />
                  </div>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label>Notas para el cliente</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones visibles al cliente..." rows={2} />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label>Notas internas</Label>
                  <Textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} placeholder="Notas privadas del técnico..." rows={2} />
                </div>
              </div>

              <Separator />

              <div className="space-y-2 rounded-lg bg-muted/40 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Mano de obra:</span>
                  <span>{formatCurrency(parseFloat(repairCost) || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Repuestos:</span>
                  <span>{formatCurrency(partsCostTotal)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>{formatCurrency(totalCost)}</span>
                </div>
                {parseFloat(deposit) > 0 && (
                  <div className="flex justify-between text-sm font-medium text-amber-600">
                    <span>Saldo a cobrar:</span>
                    <span>{formatCurrency(balance)}</span>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saveMutation.isPending} className="min-w-[140px]">
              {saveMutation.isPending ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear Orden'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
