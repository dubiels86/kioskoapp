import { useQuery } from '@tanstack/react-query'

// Interface for currency data
export interface Currency {
  id: string
  code: string
  name: string
  symbol: string
  locale: string
  isBase: boolean
  exchangeRate: number
  isActive: boolean
}

// Hook to fetch currencies
export function useCurrencies() {
  return useQuery({
    queryKey: ['currencies'],
    queryFn: async () => {
      const res = await fetch('/api/currencies')
      if (!res.ok) throw new Error('Error al obtener monedas')
      return res.json() as Promise<Currency[]>
    },
  })
}

// Hook to fetch active currencies (for dropdowns)
export function useActiveCurrencies() {
  return useQuery({
    queryKey: ['active-currencies'],
    queryFn: async () => {
      const res = await fetch('/api/currencies/active')
      if (!res.ok) throw new Error('Error al obtener monedas activas')
      return res.json() as Promise<Currency[]>
    },
  })
}

// Hook to fetch base currency
export function useBaseCurrency() {
  return useQuery({
    queryKey: ['base-currency'],
    queryFn: async () => {
      const res = await fetch('/api/currencies')
      if (!res.ok) throw new Error('Error al obtener monedas')
      const currencies = await res.json() as Currency[]
      return currencies.find(c => c.isBase) || currencies[0]
    },
  })
}

// Function to convert price between currencies
export function convertPrice(price: number, fromCurrency: string, toCurrency: string, exchangeRate: number = 1): number {
  // If same currency, no conversion needed
  if (fromCurrency === toCurrency) return price
  
  // For now, using the exchangeRate parameter (1 base = X of other currency)
  // In a real app, you'd fetch current exchange rates
  return price * exchangeRate
}

// Function to format currency with symbol
export function formatCurrency(amount: number, currencyCode: string = 'CUP'): string {
  try {
    // Get appropriate locale based on currency
    let locale = 'es-CU'
    let currency = currencyCode
    
    // Set locale based on currency
    switch (currencyCode) {
      case 'USD':
        locale = 'en-US'
        break
      case 'EUR':
        locale = 'de-DE'
        break
      case 'BRL':
        locale = 'pt-BR'
        break
      case 'ARS':
        locale = 'es-AR'
        break
      default:
        locale = 'es-CU'
    }
    
    return new Intl.NumberFormat(locale, { 
      style: 'currency', 
      currency: currency 
    }).format(amount)
  } catch {
    // Fallback format
    return `${currencyCode} ${amount.toFixed(2)}`
  }
}

// Function to get currency display info
export function getCurrencyInfo(currencyCode: string): { symbol: string; name: string } {
  const currencies: Record<string, { symbol: string; name: string }> = {
    'CUP': { symbol: '$MN', name: 'Peso Cubano' },
    'USD': { symbol: 'US$', name: 'Dólar Estadounidense' },
    'ARS': { symbol: '$', name: 'Peso Argentino' },
    'EUR': { symbol: '€', name: 'Euro' },
    'BRL': { symbol: 'R$', name: 'Real Brasileño' },
    'MXN': { symbol: '$', name: 'Peso Mexicano' },
    'COP': { symbol: '$', name: 'Peso Colombiano' },
    'CLP': { symbol: '$', name: 'Peso Chileno' },
    'PEN': { symbol: 'S/', name: 'Sol Peruano' },
    'UYU': { symbol: '$U', name: 'Peso Uruguayo' },
  }
  
  return currencies[currencyCode] || { symbol: currencyCode, name: currencyCode }
}

// Hook to fetch current USD/CUP exchange rate
export function useUsdExchangeRate() {
  return useQuery({
    queryKey: ['usd-exchange-rate'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/currencies/exchange-rates/current?from=USD&to=CUP')
        if (!res.ok) {
          // Fallback to exchange rate history if current endpoint fails
          const fallbackRes = await fetch('/api/currencies/exchange-rates?from=USD&to=CUP&limit=1')
          if (!fallbackRes.ok) throw new Error('Error al obtener tipo de cambio')
          const rates = await fallbackRes.json()
          return rates && rates.length > 0 ? rates[0].rate : 240 // Default fallback
        }
        const rateData = await res.json()
        return rateData.rate || 240 // Default fallback
      } catch {
        return 240 // Default fallback on any error
      }
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  })
}

// Function to calculate price in USD based on CUP price
export function calculateUsdPrice(cupPrice: number, exchangeRate: number): number {
  if (exchangeRate <= 0) return 0
  return cupPrice / exchangeRate
}

// Function to get current exchange rate for display
export function getExchangeRateDisplay(exchangeRate: number): string {
  return `1 USD = ${exchangeRate.toFixed(2)} CUP`
}

// Function to calculate converted price with fallback
export function calculateConvertedPrice(
  price: number, 
  priceCurrency: string, 
  targetCurrency: string,
  exchangeRate: number = 1
): { convertedPrice: number; needsConversion: boolean } {
  const needsConversion = priceCurrency !== targetCurrency
  const convertedPrice = needsConversion ? price * exchangeRate : price
  
  return { convertedPrice, needsConversion }
}