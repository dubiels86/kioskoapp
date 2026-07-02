'use client'

import { useAppStore } from '@/lib/store'
import { formatCurrency as _formatCurrency, convertFromBase, type CurrencyInfo } from '@/lib/format'

/**
 * Hook that provides currency formatting functions that react to the active display currency.
 * Use this in components that need to display prices in the user-selected currency.
 * 
 * - formatAmount(amountInBase): Formats an amount, converting from base to display currency if needed
 * - formatBase(amount): Formats in base currency (always the same, no conversion)
 * - activeCurrency: The currently selected display currency
 */
export function useCurrencyFormat() {
  const activeCurrency = useAppStore(s => s.activeCurrency)

  const formatAmount = (amountInBase: number, overrideCurrency?: CurrencyInfo): string => {
    const target = overrideCurrency || activeCurrency
    if (!target || target.isBase) {
      return _formatCurrency(amountInBase)
    }
    const converted = convertFromBase(amountInBase, target)
    return _formatCurrency(converted, target)
  }

  const formatBase = (amount: number): string => {
    return _formatCurrency(amount)
  }

  return {
    formatAmount,
    formatBase,
    activeCurrency,
    isActiveCurrencyBase: !activeCurrency || activeCurrency.isBase,
  }
}
