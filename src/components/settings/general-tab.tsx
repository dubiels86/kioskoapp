'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Store, Save } from 'lucide-react'
import { toast } from 'sonner'

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

export function GeneralTab() {
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Error al obtener configuración')
      return res.json() as Record<string, { key: string; value: string; label: string }[]>
    },
  })

  const parsed = useMemo(() => parseGeneralSettings(settings), [settings])

  const [businessName, setBusinessName] = useState(parsed.name)
  const [businessAddress, setBusinessAddress] = useState(parsed.address)
  const [businessPhone, setBusinessPhone] = useState(parsed.phone)
  const [invoicePrefix, setInvoicePrefix] = useState(parsed.prefix)
  const [invoiceNextNumber, setInvoiceNextNumber] = useState(parsed.nextNumber)

  // Sync from query data
  const [prevName, setPrevName] = useState(parsed.name)
  const [prevAddr, setPrevAddr] = useState(parsed.address)
  const [prevPhone, setPrevPhone] = useState(parsed.phone)
  const [prevPrefix, setPrevPrefix] = useState(parsed.prefix)
  const [prevNum, setPrevNum] = useState(parsed.nextNumber)

  if (parsed.name !== prevName) { setBusinessName(parsed.name); setPrevName(parsed.name) }
  if (parsed.address !== prevAddr) { setBusinessAddress(parsed.address); setPrevAddr(parsed.address) }
  if (parsed.phone !== prevPhone) { setBusinessPhone(parsed.phone); setPrevPhone(parsed.phone) }
  if (parsed.prefix !== prevPrefix) { setInvoicePrefix(parsed.prefix); setPrevPrefix(parsed.prefix) }
  if (parsed.nextNumber !== prevNum) { setInvoiceNextNumber(parsed.nextNumber); setPrevNum(parsed.nextNumber) }

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
      toast.success('Configuración general guardada correctamente')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSave = () => {
    const nextNum = parseInt(invoiceNextNumber)
    if (isNaN(nextNum) || nextNum < 1) {
      toast.error('El número de factura debe ser un número positivo')
      return
    }

    saveMutation.mutate({
      business_name: JSON.stringify(businessName),
      business_address: JSON.stringify(businessAddress),
      business_phone: JSON.stringify(businessPhone),
      invoice_prefix: JSON.stringify(invoicePrefix),
      invoice_next_number: JSON.stringify(nextNum),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Store className="h-5 w-5" />
          Configuración General
        </CardTitle>
        <CardDescription>Datos del negocio y configuración de facturación</CardDescription>
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

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 gap-1.5 shadow-sm"
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
