'use client'

import { useCurrencies } from '@/hooks/use-currencies'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Coins } from 'lucide-react'

export function CurrencySelector() {
  const { currencies, activeCurrency, switchCurrency, resetToBase } = useCurrencies()

  const activeCurrencies = currencies.filter(c => c.isActive)
  const currentValue = activeCurrency?.code || ''

  if (activeCurrencies.length <= 1) return null

  return (
    <div className="flex items-center gap-1.5">
      <Coins className="h-3.5 w-3.5 text-muted-foreground" />
      <Select value={currentValue} onValueChange={(code) => {
        if (code === currencies.find(c => c.isBase)?.code) {
          resetToBase()
        } else {
          switchCurrency(code)
        }
      }}>
        <SelectTrigger className="h-7 w-auto min-w-[80px] max-w-[130px] text-xs border-dashed">
          <SelectValue placeholder="Moneda" />
        </SelectTrigger>
        <SelectContent>
          {activeCurrencies.map(c => (
            <SelectItem key={c.id} value={c.code} className="text-xs">
              {c.symbol} {c.code}
              {c.isBase ? ' ★' : ` (1:${c.exchangeRate.toFixed(c.exchangeRate < 10 ? 4 : 2)})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
