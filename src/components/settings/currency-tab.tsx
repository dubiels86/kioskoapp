'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Coins, Save } from 'lucide-react'
import { toast } from 'sonner'

const LOCALE_OPTIONS = [
  { value: 'es-AR', label: 'Argentina (es-AR)', symbol: '$', code: 'ARS' },
  { value: 'es-MX', label: 'México (es-MX)', symbol: '$', code: 'MXN' },
  { value: 'es-CO', label: 'Colombia (es-CO)', symbol: '$', code: 'COP' },
  { value: 'es-CL', label: 'Chile (es-CL)', symbol: '$', code: 'CLP' },
  { value: 'es-PE', label: 'Perú (es-PE)', symbol: 'S/', code: 'PEN' },
  { value: 'es-UY', label: 'Uruguay (es-UY)', symbol: '$U', code: 'UYU' },
  { value: 'es-EC', label: 'Ecuador (es-EC)', symbol: '$', code: 'USD' },
  { value: 'es-VE', label: 'Venezuela (es-VE)', symbol: 'Bs.', code: 'VES' },
  { value: 'es-BO', label: 'Bolivia (es-BO)', symbol: 'Bs', code: 'BOB' },
  { value: 'es-PY', label: 'Paraguay (es-PY)', symbol: '₲', code: 'PYG' },
  { value: 'es-CU', label: 'Cuba (es-CU)', symbol: '$MN', code: 'CUP' },
  { value: 'pt-BR', label: 'Brasil (pt-BR)', symbol: 'R$', code: 'BRL' },
  { value: 'en-US', label: 'Estados Unidos (en-US)', symbol: '$', code: 'USD' },
  { value: 'en-GB', label: 'Reino Unido (en-GB)', symbol: '£', code: 'GBP' },
  { value: 'de-DE', label: 'Alemania (de-DE)', symbol: '€', code: 'EUR' },
]

function parseSettingsCurrency(settings: Record<string, { key: string; value: string; label: string }[]> | undefined) {
  const result = { code: 'ARS', symbol: '$', locale: 'es-AR', decimals: '2' }
  if (!settings?.currency) return result
  for (const s of settings.currency) {
    try {
      const val = JSON.parse(s.value)
      if (s.key === 'currency_code') result.code = val
      if (s.key === 'currency_symbol') result.symbol = val
      if (s.key === 'currency_locale') result.locale = val
      if (s.key === 'currency_decimals') result.decimals = String(val)
    } catch {
      // ignore parse errors
    }
  }
  return result
}

export function CurrencyTab() {
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Error al obtener configuración')
      return res.json() as Record<string, { key: string; value: string; label: string }[]>
    },
  })

  const parsed = useMemo(() => parseSettingsCurrency(settings), [settings])

  const [currencyCode, setCurrencyCode] = useState(parsed.code)
  const [currencySymbol, setCurrencySymbol] = useState(parsed.symbol)
  const [currencyLocale, setCurrencyLocale] = useState(parsed.locale)
  const [currencyDecimals, setCurrencyDecimals] = useState(parsed.decimals)

  // Sync from query data
  const [prevCode, setPrevCode] = useState(parsed.code)
  const [prevSymbol, setPrevSymbol] = useState(parsed.symbol)
  const [prevLocale, setPrevLocale] = useState(parsed.locale)
  const [prevDecimals, setPrevDecimals] = useState(parsed.decimals)

  if (parsed.code !== prevCode) { setCurrencyCode(parsed.code); setPrevCode(parsed.code) }
  if (parsed.symbol !== prevSymbol) { setCurrencySymbol(parsed.symbol); setPrevSymbol(parsed.symbol) }
  if (parsed.locale !== prevLocale) { setCurrencyLocale(parsed.locale); setPrevLocale(parsed.locale) }
  if (parsed.decimals !== prevDecimals) { setCurrencyDecimals(parsed.decimals); setPrevDecimals(parsed.decimals) }

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
      toast.success('Configuración de moneda guardada correctamente')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleLocaleChange = (locale: string) => {
    setCurrencyLocale(locale)
    const option = LOCALE_OPTIONS.find((o) => o.value === locale)
    if (option) {
      setCurrencyCode(option.code)
      setCurrencySymbol(option.symbol)
    }
  }

  const handleSave = () => {
    saveMutation.mutate({
      currency_code: JSON.stringify(currencyCode),
      currency_symbol: JSON.stringify(currencySymbol),
      currency_locale: JSON.stringify(currencyLocale),
      currency_decimals: JSON.stringify(parseInt(currencyDecimals) || 2),
    })
  }

  const previewFormat = () => {
    try {
      return new Intl.NumberFormat(currencyLocale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: parseInt(currencyDecimals) || 2,
      }).format(1234.56)
    } catch {
      return `${currencySymbol}1.234,56`
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Configuración de Moneda
        </CardTitle>
        <CardDescription>Configure la moneda y el formato de visualización de precios</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Cargando configuración...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="locale">Formato Regional</Label>
                <Select value={currencyLocale} onValueChange={handleLocaleChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar formato" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label} ({opt.symbol} - {opt.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Al seleccionar un formato se autocompletan símbolo y código</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="decimals">Decimales</Label>
                <Select value={currencyDecimals} onValueChange={setCurrencyDecimals}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 decimales</SelectItem>
                    <SelectItem value="2">2 decimales</SelectItem>
                    <SelectItem value="3">3 decimales</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="symbol">Símbolo</Label>
                <Input
                  id="symbol"
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  placeholder="$"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Código ISO</Label>
                <Input
                  id="code"
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                  placeholder="ARS"
                  maxLength={3}
                />
              </div>
            </div>

            <Separator />

            {/* Preview */}
            <div className="rounded-lg border bg-gradient-to-r from-emerald-50/50 to-teal-50/30 dark:from-emerald-950/20 dark:to-teal-950/10 p-4 space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">Vista Previa</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Formato seleccionado</p>
                  <p className="text-lg font-bold">{previewFormat()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ejemplos</p>
                  <div className="space-y-0.5 text-sm">
                    <p>{currencySymbol}0 = Cero</p>
                    <p>{currencySymbol}150 = Producto económico</p>
                    <p>{currencySymbol}25.000 = Producto medio</p>
                    <p>{currencySymbol}150.000 = Producto caro</p>
                  </div>
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
