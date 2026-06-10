'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Coins, Plus, Pencil, Trash2, Star, ArrowRightLeft, RefreshCw, Check } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, setCachedCurrency, clearCurrencyCache, type CurrencyInfo } from '@/lib/format'

interface Currency {
  id: string
  code: string
  name: string
  symbol: string
  locale: string
  isBase: boolean
  exchangeRate: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface ExchangeRateEntry {
  id: string
  fromCurrency: string
  toCurrency: string
  rate: number
  source: string
  createdAt: string
}

const PRESET_CURRENCIES = [
  { code: 'ARS', name: 'Peso Argentino', symbol: '$', locale: 'es-AR' },
  { code: 'USD', name: 'Dólar Estadounidense', symbol: 'US$', locale: 'en-US' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE' },
  { code: 'BRL', name: 'Real Brasileño', symbol: 'R$', locale: 'pt-BR' },
  { code: 'MXN', name: 'Peso Mexicano', symbol: 'MX$', locale: 'es-MX' },
  { code: 'COP', name: 'Peso Colombiano', symbol: 'COL$', locale: 'es-CO' },
  { code: 'CLP', name: 'Peso Chileno', symbol: 'CLP$', locale: 'es-CL' },
  { code: 'PEN', name: 'Sol Peruano', symbol: 'S/', locale: 'es-PE' },
  { code: 'UYU', name: 'Peso Uruguayo', symbol: '$U', locale: 'es-UY' },
  { code: 'VES', name: 'Bolívar Venezolano', symbol: 'Bs.', locale: 'es-VE' },
  { code: 'BOB', name: 'Boliviano', symbol: 'Bs', locale: 'es-BO' },
  { code: 'PYG', name: 'Guaraní Paraguayo', symbol: '₲', locale: 'es-PY' },
  { code: 'CUP', name: 'Peso Cubano', symbol: '$MN', locale: 'es-CU' },
  { code: 'GBP', name: 'Libra Esterlina', symbol: '£', locale: 'en-GB' },
  { code: 'CNY', name: 'Yuan Chino', symbol: '¥', locale: 'zh-CN' },
  { code: 'JPY', name: 'Yen Japonés', symbol: '¥', locale: 'ja-JP' },
]

export function CurrencyTab() {
  const queryClient = useQueryClient()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editCurrency, setEditCurrency] = useState<Currency | null>(null)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)
  const [historyForCurrency, setHistoryForCurrency] = useState<string | null>(null)

  // Form state
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formSymbol, setFormSymbol] = useState('')
  const [formLocale, setFormLocale] = useState('es-AR')
  const [formIsBase, setFormIsBase] = useState(false)
  const [formExchangeRate, setFormExchangeRate] = useState('1')

  // Quick rate update
  const [quickRateId, setQuickRateId] = useState<string | null>(null)
  const [quickRateValue, setQuickRateValue] = useState('')

  const { data: currencies = [], isLoading } = useQuery({
    queryKey: ['currencies'],
    queryFn: async () => {
      const res = await fetch('/api/currencies')
      if (!res.ok) throw new Error('Error al obtener monedas')
      return res.json() as Promise<Currency[]>
    },
  })

  const { data: exchangeHistory = [] } = useQuery({
    queryKey: ['exchange-rates', historyForCurrency],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (historyForCurrency) params.set('to', historyForCurrency)
      params.set('limit', '30')
      const res = await fetch(`/api/currencies/exchange-rates?${params}`)
      if (!res.ok) throw new Error('Error al obtener historial')
      return res.json() as Promise<ExchangeRateEntry[]>
    },
    enabled: !!historyForCurrency,
  })

  // Update cached currency when currencies change
  useEffect(() => {
    const base = currencies.find(c => c.isBase && c.isActive)
    if (base) {
      setCachedCurrency({
        code: base.code,
        name: base.name,
        symbol: base.symbol,
        locale: base.locale,
        isBase: base.isBase,
        exchangeRate: base.exchangeRate,
      })
    }
  }, [currencies])

  const baseCurrency = useMemo(() => currencies.find(c => c.isBase), [currencies])

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/currencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al crear moneda')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currencies'] })
      clearCurrencyCache()
      toast.success('Moneda creada correctamente')
      closeDialog()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/currencies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al actualizar moneda')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currencies'] })
      clearCurrencyCache()
      toast.success('Moneda actualizada correctamente')
      closeDialog()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/currencies/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al eliminar moneda')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currencies'] })
      clearCurrencyCache()
      toast.success('Moneda eliminada correctamente')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const closeDialog = () => {
    setShowAddDialog(false)
    setEditCurrency(null)
    resetForm()
  }

  const resetForm = () => {
    setFormCode('')
    setFormName('')
    setFormSymbol('')
    setFormLocale('es-AR')
    setFormIsBase(false)
    setFormExchangeRate('1')
  }

  const openAddDialog = () => {
    resetForm()
    setShowAddDialog(true)
  }

  const openEditDialog = (currency: Currency) => {
    setFormCode(currency.code)
    setFormName(currency.name)
    setFormSymbol(currency.symbol)
    setFormLocale(currency.locale)
    setFormIsBase(currency.isBase)
    setFormExchangeRate(String(currency.exchangeRate))
    setEditCurrency(currency)
    setShowAddDialog(true)
  }

  const handlePresetSelect = (code: string) => {
    const preset = PRESET_CURRENCIES.find(p => p.code === code)
    if (preset) {
      setFormCode(preset.code)
      setFormName(preset.name)
      setFormSymbol(preset.symbol)
      setFormLocale(preset.locale)
    }
  }

  const handleSave = () => {
    if (!formCode || !formName || !formSymbol) {
      toast.error('Código, nombre y símbolo son requeridos')
      return
    }

    const data = {
      code: formCode.toUpperCase(),
      name: formName,
      symbol: formSymbol,
      locale: formLocale,
      isBase: formIsBase,
      exchangeRate: formIsBase ? 1 : parseFloat(formExchangeRate) || 1,
    }

    if (editCurrency) {
      updateMutation.mutate({ id: editCurrency.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleSetAsBase = (currency: Currency) => {
    updateMutation.mutate({
      id: currency.id,
      data: { isBase: true, exchangeRate: 1 },
    })
  }

  const handleQuickRateUpdate = (currencyId: string, rate: string) => {
    const rateNum = parseFloat(rate)
    if (isNaN(rateNum) || rateNum <= 0) {
      toast.error('El tipo de cambio debe ser un número positivo')
      return
    }
    updateMutation.mutate({
      id: currencyId,
      data: { exchangeRate: rateNum },
    })
    setQuickRateId(null)
  }

  const formatPreview = (code: string, locale: string, symbol: string) => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code,
        minimumFractionDigits: code === 'COP' || code === 'CLP' || code === 'PYG' ? 0 : 2,
      }).format(1234.56)
    } catch {
      return `${symbol}1.234,56`
    }
  }

  const getConversionExample = (currency: Currency) => {
    if (currency.isBase || !baseCurrency) return '—'
    const amount = 1000
    const converted = amount * currency.exchangeRate
    try {
      return `${formatCurrency(amount, { code: baseCurrency.code, name: baseCurrency.name, symbol: baseCurrency.symbol, locale: baseCurrency.locale, isBase: true, exchangeRate: 1 })} = ${formatCurrency(converted, { code: currency.code, name: currency.name, symbol: currency.symbol, locale: currency.locale, isBase: false, exchangeRate: currency.exchangeRate })}`
    } catch {
      return `${baseCurrency.symbol}${amount} = ${currency.symbol}${converted.toFixed(2)}`
    }
  }

  return (
    <div className="space-y-6">
      {/* Main Currency Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Monedas y Tipos de Cambio
              </CardTitle>
              <CardDescription>
                Administrá las monedas del sistema y sus tipos de cambio respecto a la moneda principal
              </CardDescription>
            </div>
            <Button onClick={openAddDialog} className="gap-1.5" size="sm">
              <Plus className="h-4 w-4" />
              Agregar Moneda
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Cargando monedas...</p>
          ) : currencies.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <Coins className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">No hay monedas configuradas</p>
              <Button onClick={openAddDialog} variant="outline" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Agregar primera moneda
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Símbolo</TableHead>
                    <TableHead>Tipo de Cambio</TableHead>
                    <TableHead>Conversión (ej.)</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currencies.map((currency) => (
                    <TableRow key={currency.id} className={currency.isBase ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {currency.isBase && (
                            <Badge variant="default" className="text-xs gap-1">
                              <Star className="h-3 w-3" />
                              Principal
                            </Badge>
                          )}
                          <span className="font-medium">{currency.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="bg-muted px-1.5 py-0.5 rounded text-sm">{currency.code}</code>
                      </TableCell>
                      <TableCell className="text-lg">{currency.symbol}</TableCell>
                      <TableCell>
                        {currency.isBase ? (
                          <span className="text-sm text-muted-foreground">1.00 (base)</span>
                        ) : quickRateId === currency.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">1 {baseCurrency?.code} =</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={quickRateValue}
                              onChange={(e) => setQuickRateValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleQuickRateUpdate(currency.id, quickRateValue)
                                if (e.key === 'Escape') setQuickRateId(null)
                              }}
                              className="w-24 h-7 text-sm"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => handleQuickRateUpdate(currency.id, quickRateValue)}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setQuickRateId(currency.id)
                              setQuickRateValue(String(currency.exchangeRate))
                            }}
                            className="flex items-center gap-1 text-sm hover:bg-muted px-2 py-1 rounded transition-colors cursor-pointer"
                            title="Clic para editar tipo de cambio"
                          >
                            <span className="text-xs text-muted-foreground">1 {baseCurrency?.code} =</span>
                            <span className="font-medium">{currency.exchangeRate.toFixed(4)}</span>
                            <span className="text-xs text-muted-foreground">{currency.code}</span>
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {getConversionExample(currency)}
                      </TableCell>
                      <TableCell>
                        {currency.isActive ? (
                          <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Activa
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-500">
                            Inactiva
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!currency.isBase && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => handleSetAsBase(currency)}
                              title="Establecer como moneda principal"
                            >
                              <Star className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => {
                              setHistoryForCurrency(currency.code)
                              setShowHistoryDialog(true)
                            }}
                            title="Ver historial de tipo de cambio"
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            onClick={() => openEditDialog(currency)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {!currency.isBase && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm(`¿Eliminar la moneda ${currency.name} (${currency.code})?`)) {
                                  deleteMutation.mutate(currency.id)
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {baseCurrency && currencies.length > 1 && (
            <>
              <Separator className="my-4" />
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm font-semibold text-muted-foreground mb-3">
                  Tabla de Conversión Rápida
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {currencies.filter(c => !c.isBase && c.isActive).map(currency => (
                    <div key={currency.id} className="bg-background rounded-lg p-3 border">
                      <p className="text-xs text-muted-foreground">{currency.code} - {currency.name}</p>
                      <p className="text-lg font-bold">
                        1 <span className="text-muted-foreground text-sm">{baseCurrency.code}</span> = {currency.exchangeRate.toFixed(currency.exchangeRate < 10 ? 4 : 2)} <span className="text-sm">{currency.symbol}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatPreview(currency.code, currency.locale, currency.symbol)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Currency Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editCurrency ? 'Editar Moneda' : 'Agregar Moneda'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Preset selector for new currencies */}
            {!editCurrency && (
              <div className="space-y-2">
                <Label>Monedas Predefinidas</Label>
                <Select onValueChange={handlePresetSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar moneda del listado..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_CURRENCIES.filter(p => !currencies.some(c => c.code === p.code)).map(preset => (
                      <SelectItem key={preset.code} value={preset.code}>
                        {preset.code} - {preset.name} ({preset.symbol})
                      </SelectItem>
                    ))}
                    <SelectItem value="CUSTOM">Personalizada...</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Seleccioná una moneda del listado o creá una personalizada</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency-code">Código ISO</Label>
                <Input
                  id="currency-code"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="ARS"
                  maxLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency-symbol">Símbolo</Label>
                <Input
                  id="currency-symbol"
                  value={formSymbol}
                  onChange={(e) => setFormSymbol(e.target.value)}
                  placeholder="$"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency-name">Nombre</Label>
              <Input
                id="currency-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Peso Argentino"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency-locale">Formato Regional</Label>
              <Select value={formLocale} onValueChange={setFormLocale}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_CURRENCIES.map(p => (
                    <SelectItem key={p.locale} value={p.locale}>
                      {p.locale} ({p.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Base currency toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Moneda Principal</Label>
                <p className="text-xs text-muted-foreground">
                  Todas las operaciones se registran en esta moneda. Los tipos de cambio se expresan respecto a ella.
                </p>
              </div>
              <Switch
                checked={formIsBase}
                onCheckedChange={setFormIsBase}
              />
            </div>

            {/* Exchange rate (only for non-base) */}
            {!formIsBase && baseCurrency && (
              <div className="rounded-lg border p-3 space-y-3">
                <Label className="text-sm font-medium">Tipo de Cambio</Label>
                <p className="text-xs text-muted-foreground">
                  ¿Cuántos {formCode || '???'} equivale 1 {baseCurrency.code}?
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">1 {baseCurrency.code} =</span>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={formExchangeRate}
                    onChange={(e) => setFormExchangeRate(e.target.value)}
                    className="w-32"
                    placeholder="1.00"
                  />
                  <span className="text-sm text-muted-foreground">{formCode || '???'}</span>
                </div>
                {formExchangeRate && parseFloat(formExchangeRate) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Ejemplo: {baseCurrency.symbol}1.000 = {formSymbol}{(1000 * parseFloat(formExchangeRate)).toLocaleString(formLocale)}
                  </p>
                )}
              </div>
            )}

            {/* Preview */}
            {formCode && (
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Vista Previa</p>
                <p className="text-lg font-bold">{formatPreview(formCode, formLocale, formSymbol)}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="gap-1.5"
            >
              {(createMutation.isPending || updateMutation.isPending) ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exchange Rate History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Historial de Tipo de Cambio - {historyForCurrency}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {exchangeHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No hay historial de cambios</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Desde</TableHead>
                    <TableHead>Hacia</TableHead>
                    <TableHead>Tasa</TableHead>
                    <TableHead>Fuente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exchangeHistory.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs">
                        {new Date(entry.createdAt).toLocaleDateString('es-AR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell><code className="text-xs bg-muted px-1 rounded">{entry.fromCurrency}</code></TableCell>
                      <TableCell><code className="text-xs bg-muted px-1 rounded">{entry.toCurrency}</code></TableCell>
                      <TableCell className="font-medium">{entry.rate.toFixed(4)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{entry.source}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
