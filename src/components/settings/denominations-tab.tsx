'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Banknote, Plus, Trash2, Save } from 'lucide-react'
import { toast } from 'sonner'

interface DenominationItem {
  value: number
  label: string
}

function formatDenomLabel(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(value % 1000 !== 0 ? 1 : 0).replace('.0', '')}.000`
  }
  return `$${value}`
}

function parseDenominations(
  settings: Record<string, { key: string; value: string; label: string }[]> | undefined
) {
  const result = { bills: [] as DenominationItem[], coins: [] as DenominationItem[] }
  if (!settings?.denominations) return result
  for (const s of settings.denominations) {
    try {
      const vals: number[] = JSON.parse(s.value)
      if (s.key === 'bill_denominations') {
        result.bills = vals.sort((a, b) => b - a).map((v) => ({ value: v, label: formatDenomLabel(v) }))
      }
      if (s.key === 'coin_denominations') {
        result.coins = vals.sort((a, b) => b - a).map((v) => ({ value: v, label: formatDenomLabel(v) }))
      }
    } catch {
      // ignore
    }
  }
  return result
}

export function DenominationsTab() {
  const queryClient = useQueryClient()
  const [bills, setBills] = useState<DenominationItem[]>([])
  const [coins, setCoins] = useState<DenominationItem[]>([])
  const [newBillValue, setNewBillValue] = useState('')
  const [newCoinValue, setNewCoinValue] = useState('')

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Error al obtener configuración')
      return res.json() as Record<string, { key: string; value: string; label: string }[]>
    },
  })

  const parsed = useMemo(() => parseDenominations(settings), [settings])

  // Sync from query data
  const [prevBillsLen, setPrevBillsLen] = useState(-1)
  const [prevCoinsLen, setPrevCoinsLen] = useState(-1)
  if (parsed.bills.length !== prevBillsLen || parsed.coins.length !== prevCoinsLen) {
    setBills(parsed.bills)
    setCoins(parsed.coins)
    setPrevBillsLen(parsed.bills.length)
    setPrevCoinsLen(parsed.coins.length)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bill_denominations: JSON.stringify(bills.map((b) => b.value)),
          coin_denominations: JSON.stringify(coins.map((c) => c.value)),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Denominaciones guardadas correctamente')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const addBill = () => {
    const val = parseInt(newBillValue)
    if (!val || val <= 0) {
      toast.error('Ingrese un valor válido')
      return
    }
    if (bills.some((b) => b.value === val)) {
      toast.error('Esta denominación ya existe')
      return
    }
    setBills((prev) =>
      [...prev, { value: val, label: formatDenomLabel(val) }].sort((a, b) => b.value - a.value)
    )
    setNewBillValue('')
  }

  const addCoin = () => {
    const val = parseInt(newCoinValue)
    if (!val || val <= 0) {
      toast.error('Ingrese un valor válido')
      return
    }
    if (coins.some((c) => c.value === val)) {
      toast.error('Esta denominación ya existe')
      return
    }
    setCoins((prev) =>
      [...prev, { value: val, label: formatDenomLabel(val) }].sort((a, b) => b.value - a.value)
    )
    setNewCoinValue('')
  }

  const removeBill = (value: number) => {
    setBills((prev) => prev.filter((b) => b.value !== value))
  }

  const removeCoin = (value: number) => {
    setCoins((prev) => prev.filter((c) => c.value !== value))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Banknote className="h-5 w-5" />
          Denominaciones de Billetes y Monedas
        </CardTitle>
        <CardDescription>
          Configure las denominaciones disponibles para el conteo de efectivo al abrir/cerrar caja
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Cargando configuración...</p>
        ) : (
          <>
            {/* Bills */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Billetes</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {bills.map((bill) => (
                  <div
                    key={bill.value}
                    className="flex items-center gap-2 rounded-lg border bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 px-3 py-2.5"
                  >
                    <Banknote className="h-4 w-4 text-slate-600 dark:text-slate-400 shrink-0" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 flex-1">
                      {bill.label}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => removeBill(bill.value)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-[200px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    value={newBillValue}
                    onChange={(e) => setNewBillValue(e.target.value)}
                    placeholder="Ej: 500"
                    className="pl-7"
                    onKeyDown={(e) => e.key === 'Enter' && addBill()}
                  />
                </div>
                <Button variant="outline" onClick={addBill} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Agregar Billete
                </Button>
              </div>
            </div>

            <Separator />

            {/* Coins */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Monedas</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {coins.map((coin) => (
                  <div
                    key={coin.value}
                    className="flex items-center gap-2 rounded-lg border bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2.5"
                  >
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-400 flex-1">
                      {coin.label}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => removeCoin(coin.value)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-[200px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    value={newCoinValue}
                    onChange={(e) => setNewCoinValue(e.target.value)}
                    placeholder="Ej: 5"
                    className="pl-7"
                    onKeyDown={(e) => e.key === 'Enter' && addCoin()}
                  />
                </div>
                <Button variant="outline" onClick={addCoin} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Agregar Moneda
                </Button>
              </div>
            </div>

            <Separator />

            {/* Summary */}
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm font-semibold text-muted-foreground mb-2">Resumen de denominaciones</p>
              <div className="flex gap-4 text-sm">
                <span>{bills.length} billete{bills.length !== 1 ? 's' : ''}</span>
                <span>{coins.length} moneda{coins.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-sm"
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? 'Guardando...' : 'Guardar Denominaciones'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
