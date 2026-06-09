'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Store, Save, Coffee, ShoppingBag, Info, RefreshCw, Download } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import type { PosType } from '@/lib/store'

function parseGeneralSettings(settings: Record<string, { key: string; value: string; label: string }[]> | undefined) {
  const result = { name: '', address: '', phone: '', prefix: 'FAC', nextNumber: '1' }
  if (!settings?.general) return result
  for (const s of settings.general) {
    try {
      const val = JSON.parse(s.value)
      if (s.key === 'business_name') result.name = val
      if (s.key === 'business_address') result.address = val
      if (s.key === 'business_phone') result.phone = val
      if (s.key === 'invoice_prefix') result.prefix = val
      if (s.key === 'invoice_next_number') result.nextNumber = String(val)
    } catch {
      // ignore
    }
  }
  return result
}

function parsePosSettings(settings: Record<string, { key: string; value: string; label: string }[]> | undefined) {
  const result = { posType: 'kiosko' as PosType, posTables: 10 }
  if (!settings?.pos) return result
  for (const s of settings.pos) {
    try {
      const val = JSON.parse(s.value)
      if (s.key === 'pos_type') result.posType = val === 'cafeteria' ? 'cafeteria' : 'kiosko'
      if (s.key === 'pos_tables') result.posTables = typeof val === 'number' ? val : parseInt(val) || 10
    } catch {
      // ignore
    }
  }
  return result
}

export function GeneralTab() {
  const queryClient = useQueryClient()
  const { setPosType, setPosTables } = useAppStore()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Error al obtener configuración')
      return res.json() as Record<string, { key: string; value: string; label: string }[]>
    },
  })

  const parsed = useMemo(() => parseGeneralSettings(settings), [settings])
  const parsedPos = useMemo(() => parsePosSettings(settings), [settings])

  const [businessName, setBusinessName] = useState(parsed.name)
  const [businessAddress, setBusinessAddress] = useState(parsed.address)
  const [businessPhone, setBusinessPhone] = useState(parsed.phone)
  const [invoicePrefix, setInvoicePrefix] = useState(parsed.prefix)
  const [invoiceNextNumber, setInvoiceNextNumber] = useState(parsed.nextNumber)
  const [posType, setPosTypeLocal] = useState<PosType>(parsedPos.posType)
  const [posTables, setPosTablesLocal] = useState(String(parsedPos.posTables))

  // Sync from query data
  const [prevName, setPrevName] = useState(parsed.name)
  const [prevAddr, setPrevAddr] = useState(parsed.address)
  const [prevPhone, setPrevPhone] = useState(parsed.phone)
  const [prevPrefix, setPrevPrefix] = useState(parsed.prefix)
  const [prevNum, setPrevNum] = useState(parsed.nextNumber)
  const [prevPosType, setPrevPosType] = useState(parsedPos.posType)
  const [prevPosTables, setPrevPosTables] = useState(String(parsedPos.posTables))

  if (parsed.name !== prevName) { setBusinessName(parsed.name); setPrevName(parsed.name) }
  if (parsed.address !== prevAddr) { setBusinessAddress(parsed.address); setPrevAddr(parsed.address) }
  if (parsed.phone !== prevPhone) { setBusinessPhone(parsed.phone); setPrevPhone(parsed.phone) }
  if (parsed.prefix !== prevPrefix) { setInvoicePrefix(parsed.prefix); setPrevPrefix(parsed.prefix) }
  if (parsed.nextNumber !== prevNum) { setInvoiceNextNumber(parsed.nextNumber); setPrevNum(parsed.nextNumber) }
  if (parsedPos.posType !== prevPosType) { setPosTypeLocal(parsedPos.posType); setPrevPosType(parsedPos.posType) }
  if (String(parsedPos.posTables) !== prevPosTables) { setPosTablesLocal(String(parsedPos.posTables)); setPrevPosTables(String(parsedPos.posTables)) }

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      // Sync store with new settings
      setPosType(posType)
      const tables = parseInt(posTables) || 10
      setPosTables(tables)
      toast.success('Configuración guardada correctamente')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSave = () => {
    const nextNum = parseInt(invoiceNextNumber)
    if (isNaN(nextNum) || nextNum < 1) {
      toast.error('El número de factura debe ser un número positivo')
      return
    }
    const tables = parseInt(posTables)
    if (posType === 'cafeteria' && (isNaN(tables) || tables < 1)) {
      toast.error('La cantidad de mesas debe ser un número positivo')
      return
    }

    saveMutation.mutate({
      business_name: JSON.stringify(businessName),
      business_address: JSON.stringify(businessAddress),
      business_phone: JSON.stringify(businessPhone),
      invoice_prefix: JSON.stringify(invoicePrefix),
      invoice_next_number: JSON.stringify(nextNum),
      pos_type: JSON.stringify(posType),
      pos_tables: JSON.stringify(tables || 10),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Store className="h-5 w-5" />
          Configuración General
        </CardTitle>
        <CardDescription>Datos del negocio, tipo de POS y facturación</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Cargando configuración...</p>
        ) : (
          <>
            {/* Business Info */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Datos del Negocio</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-name">Nombre del Negocio</Label>
                  <Input
                    id="business-name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Mi Kiosko"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-phone">Teléfono</Label>
                  <Input
                    id="business-phone"
                    value={businessPhone}
                    onChange={(e) => setBusinessPhone(e.target.value)}
                    placeholder="+54 11 1234-5678"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-address">Dirección</Label>
                <Input
                  id="business-address"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  placeholder="Av. Siempre Viva 742"
                />
              </div>
            </div>

            <Separator />

            {/* POS Mode Config */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Modo de POS</Label>
              <p className="text-sm text-muted-foreground">
                Elegí el tipo de negocio. En modo <strong>Cafetería</strong> las facturas se asocian a mesas.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* POS Type Selector */}
                <div className="space-y-3">
                  <Label>Tipo de POS</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPosTypeLocal('kiosko')}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        posType === 'kiosko'
                          ? 'border-slate-500 bg-slate-50 dark:bg-slate-800 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <ShoppingBag className={`w-7 h-7 ${posType === 'kiosko' ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`} />
                      <span className={`text-sm font-semibold ${posType === 'kiosko' ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}>
                        Kiosko
                      </span>
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">
                        Venta directa sin mesas
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosTypeLocal('cafeteria')}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        posType === 'cafeteria'
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-amber-300'
                      }`}
                    >
                      <Coffee className={`w-7 h-7 ${posType === 'cafeteria' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} />
                      <span className={`text-sm font-semibold ${posType === 'cafeteria' ? 'text-amber-900 dark:text-amber-100' : 'text-slate-500'}`}>
                        Cafetería
                      </span>
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">
                        Facturas por mesa
                      </span>
                    </button>
                  </div>
                </div>

                {/* Tables count - only for cafeteria */}
                <div className="space-y-3">
                  <Label htmlFor="pos-tables">Cantidad de Mesas</Label>
                  <Input
                    id="pos-tables"
                    type="number"
                    min={1}
                    max={200}
                    value={posTables}
                    onChange={(e) => setPosTablesLocal(e.target.value)}
                    disabled={posType !== 'cafeteria'}
                    className={posType === 'cafeteria' ? '' : 'opacity-50'}
                  />
                  <p className="text-xs text-muted-foreground">
                    {posType === 'cafeteria'
                      ? `Se crearán ${parseInt(posTables) || 10} mesas para asignar a las facturas`
                      : 'Solo disponible en modo Cafetería'}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Invoice Config */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Facturación</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice-prefix">Prefijo de Factura</Label>
                  <Input
                    id="invoice-prefix"
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                    placeholder="FAC"
                    maxLength={6}
                  />
                  <p className="text-xs text-muted-foreground">Prefijo que aparece en los números de factura</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice-next">Próximo Número de Factura</Label>
                  <Input
                    id="invoice-next"
                    type="number"
                    value={invoiceNextNumber}
                    onChange={(e) => setInvoiceNextNumber(e.target.value)}
                    min={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Próxima factura: {invoicePrefix || 'FAC'}-{String(invoiceNextNumber).padStart(6, '0')}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* System Info */}
            <div className="space-y-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Info className="h-4 w-4" />
                Información del Sistema
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Versión del Sistema</p>
                  <p className="text-sm font-medium">v{settings?.system?.find(s => s.key === 'app_version') ? JSON.parse(settings.system.find(s => s.key === 'app_version')!.value) : '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Última Actualización</p>
                  <p className="text-sm font-medium">
                    {settings?.system?.find(s => s.key === 'last_updated')
                      ? new Date(JSON.parse(settings.system.find(s => s.key === 'last_updated')!.value)).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/version')
                      if (res.ok) {
                        const data = await res.json()
                        toast.info(`KioskoApp v${data.version}`)
                      }
                    } catch {
                      toast.error('No se pudo verificar la versión')
                    }
                  }}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Verificar Versión
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.open('/api/download', '_blank')
                  }}
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Descargar Sistema
                </Button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-sm"
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
