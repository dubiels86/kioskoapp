'use client'

import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { formatCurrency, convertFromBase, convertToBase, setCachedCurrency, clearCurrencyCache, type CurrencyInfo } from '@/lib/format'
import { useAppStore } from '@/lib/store'

interface CurrencyData {
  id: string
  code: string
  name: string
  symbol: string
  locale: string
  isBase: boolean
  exchangeRate: number
  isActive: boolean
}

export function useCurrencies() {
  const { activeCurrency, setActiveCurrency } = useAppStore()

  const { data: currencies = [], isLoading, refetch } = useQuery({
    queryKey: ['currencies'],
    queryFn: async () => {
      const res = await fetch('/api/currencies')
      if (!res.ok) throw new Error('Error al obtener monedas')
      return res.json() as Promise<CurrencyData[]>
    },
  })

  const { data: baseCurrency } = useQuery({
    queryKey: ['currencies-active'],
    queryFn: async () => {
      const res = await fetch('/api/currencies/active')
      if (!res.ok) throw new Error('Error al obtener moneda activa')
      return res.json() as Promise<CurrencyInfo>
    },
  })

  // Update cached currency when baseCurrency changes
  if (baseCurrency) {
    setCachedCurrency(baseCurrency)
  }

  const active = activeCurrency || (baseCurrency ? {
    code: baseCurrency.code,
    name: baseCurrency.name,
    symbol: baseCurrency.symbol,
    locale: baseCurrency.locale,
    isBase: baseCurrency.isBase,
    exchangeRate: baseCurrency.exchangeRate,
  } : null)

  // Convert from base to display currency
  const convertAmount = useCallback((amountInBase: number, targetCurrency?: CurrencyInfo): number => {
    const target = targetCurrency || active
    if (!target || target.isBase) return amountInBase
    return convertFromBase(amountInBase, target)
  }, [active])

  // Format amount in display currency
  const formatAmount = useCallback((amountInBase: number, targetCurrency?: CurrencyInfo): string => {
    const target = targetCurrency || active
    if (!target) return formatCurrency(amountInBase)
    const converted = convertFromBase(amountInBase, target)
    return formatCurrency(converted, target)
  }, [active])

  // Format in base currency
  const formatBaseAmount = useCallback((amount: number): string => {
    if (!baseCurrency) return formatCurrency(amount)
    return formatCurrency(amount, baseCurrency)
  }, [baseCurrency])

  // Switch display currency
  const switchCurrency = useCallback((code: string) => {
    const found = currencies.find(c => c.code === code && c.isActive)
    if (found) {
      setActiveCurrency({
        code: found.code,
        name: found.name,
        symbol: found.symbol,
        locale: found.locale,
        isBase: found.isBase,
        exchangeRate: found.exchangeRate,
      })
    }
  }, [currencies, setActiveCurrency])

  // Reset to base currency
  const resetToBase = useCallback(() => {
    if (baseCurrency) {
      setActiveCurrency(baseCurrency)
    }
  }, [baseCurrency, setActiveCurrency])

  return {
    currencies,
    baseCurrency: baseCurrency || null,
    activeCurrency: active,
    isLoading,
    refetch,
    convertAmount,
    formatAmount,
    formatBaseAmount,
    switchCurrency,
    resetToBase,
  }
}
