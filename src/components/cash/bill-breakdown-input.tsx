'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Banknote, Coins } from 'lucide-react'
import { formatCurrency } from '@/lib/format'

// Argentine Peso bill denominations
export const BILL_DENOMINATIONS = [
  { value: 10000, label: '$10.000', type: 'bill' as const },
  { value: 2000, label: '$2.000', type: 'bill' as const },
  { value: 1000, label: '$1.000', type: 'bill' as const },
  { value: 500, label: '$500', type: 'bill' as const },
  { value: 200, label: '$200', type: 'bill' as const },
  { value: 100, label: '$100', type: 'bill' as const },
  { value: 50, label: '$50', type: 'bill' as const },
  { value: 20, label: '$20', type: 'bill' as const },
] as const

export const COIN_DENOMINATIONS = [
  { value: 10, label: '$10', type: 'coin' as const },
  { value: 5, label: '$5', type: 'coin' as const },
  { value: 2, label: '$2', type: 'coin' as const },
  { value: 1, label: '$1', type: 'coin' as const },
] as const

export const ALL_DENOMINATIONS = [...BILL_DENOMINATIONS, ...COIN_DENOMINATIONS]

export type BillBreakdown = Record<number, number>

export function breakdownToJSON(breakdown: BillBreakdown): string {
  return JSON.stringify(breakdown)
}

export function jsonToBreakdown(json: string | null | undefined): BillBreakdown {
  if (!json) return {}
  try {
    return JSON.parse(json)
  } catch {
    return {}
  }
}

export function calculateBreakdownTotal(breakdown: BillBreakdown): number {
  return Object.entries(breakdown).reduce((sum, [denom, count]) => {
    return sum + parseFloat(denom) * count
  }, 0)
}

interface BillBreakdownInputProps {
  value: BillBreakdown
  onChange: (breakdown: BillBreakdown) => void
  showTotal?: boolean
  label?: string
  compact?: boolean
}

export function BillBreakdownInput({
  value,
  onChange,
  showTotal = true,
  label = 'Conteo por Denominación',
  compact = false,
}: BillBreakdownInputProps) {
  const handleCountChange = useCallback(
    (denomination: number, countStr: string) => {
      const count = parseInt(countStr) || 0
      const newBreakdown = { ...value }
      if (count > 0) {
        newBreakdown[denomination] = count
      } else {
        delete newBreakdown[denomination]
      }
      onChange(newBreakdown)
    },
    [value, onChange]
  )

  const total = useMemo(() => calculateBreakdownTotal(value), [value])

  const billsTotal = useMemo(() => {
    return BILL_DENOMINATIONS.reduce((sum, d) => {
      const count = value[d.value] || 0
      return sum + d.value * count
    }, 0)
  }, [value])

  const coinsTotal = useMemo(() => {
    return COIN_DENOMINATIONS.reduce((sum, d) => {
      const count = value[d.value] || 0
      return sum + d.value * count
    }, 0)
  }, [value])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Banknote className="w-4 h-4 text-primary" />
        <Label className="text-sm font-semibold">{label}</Label>
      </div>

      {/* Bills */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Billetes</p>
        <div className="grid grid-cols-2 gap-2">
          {BILL_DENOMINATIONS.map((denom) => {
            const count = value[denom.value] || 0
            const subtotal = denom.value * count
            return (
              <div
                key={denom.value}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                  count > 0
                    ? 'bg-slate-50 border-slate-300 dark:bg-slate-800 dark:border-slate-700'
                    : 'bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800'
                }`}
              >
                <span className={`text-sm font-bold min-w-[60px] ${
                  count > 0 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500'
                }`}>
                  {denom.label}
                </span>
                <span className="text-slate-400 text-xs">×</span>
                <Input
                  type="number"
                  min={0}
                  value={count || ''}
                  onChange={(e) => handleCountChange(denom.value, e.target.value)}
                  placeholder="0"
                  className="h-8 w-16 text-center text-sm font-medium p-1"
                />
                {count > 0 && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatCurrency(subtotal)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        {billsTotal > 0 && (
          <div className="flex justify-end pr-1">
            <span className="text-xs text-muted-foreground">
              Subtotal billetes: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(billsTotal)}</span>
            </span>
          </div>
        )}
      </div>

      <Separator />

      {/* Coins */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
          <Coins className="w-3 h-3" /> Monedas
        </p>
        <div className="grid grid-cols-2 gap-2">
          {COIN_DENOMINATIONS.map((denom) => {
            const count = value[denom.value] || 0
            const subtotal = denom.value * count
            return (
              <div
                key={denom.value}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                  count > 0
                    ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
                    : 'bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800'
                }`}
              >
                <span className={`text-sm font-bold min-w-[60px] ${
                  count > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500'
                }`}>
                  {denom.label}
                </span>
                <span className="text-slate-400 text-xs">×</span>
                <Input
                  type="number"
                  min={0}
                  value={count || ''}
                  onChange={(e) => handleCountChange(denom.value, e.target.value)}
                  placeholder="0"
                  className="h-8 w-16 text-center text-sm font-medium p-1"
                />
                {count > 0 && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatCurrency(subtotal)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        {coinsTotal > 0 && (
          <div className="flex justify-end pr-1">
            <span className="text-xs text-muted-foreground">
              Subtotal monedas: <span className="font-semibold text-amber-700 dark:text-amber-400">{formatCurrency(coinsTotal)}</span>
            </span>
          </div>
        )}
      </div>

      {/* Total */}
      {showTotal && (
        <>
          <Separator />
          <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
            <span className="text-sm font-semibold">Total Contado</span>
            <span className="text-lg font-bold text-primary">
              {formatCurrency(total)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

// Read-only display for viewing saved breakdowns
interface BillBreakdownDisplayProps {
  breakdown: BillBreakdown
  label?: string
}

export function BillBreakdownDisplay({ breakdown, label = 'Desglose de Efectivo' }: BillBreakdownDisplayProps) {
  const total = useMemo(() => calculateBreakdownTotal(breakdown), [breakdown])

  const hasAny = Object.keys(breakdown).length > 0

  if (!hasAny) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Banknote className="w-4 h-4 text-primary" />
        <Label className="text-sm font-semibold">{label}</Label>
      </div>
      <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 space-y-1">
        {ALL_DENOMINATIONS.map((denom) => {
          const count = breakdown[denom.value] || 0
          if (count === 0) return null
          const subtotal = denom.value * count
          return (
            <div key={denom.value} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {denom.label} × {count}
              </span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
          )
        })}
        <Separator className="my-1" />
        <div className="flex items-center justify-between font-bold text-sm">
          <span>Total</span>
          <span className="text-primary">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  )
}
