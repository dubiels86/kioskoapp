// Currency info type
export interface CurrencyInfo {
  code: string
  name: string
  symbol: string
  locale: string
  isBase: boolean
  exchangeRate: number // 1 base = X of this currency
}

// Cached currency settings
let cachedCurrency: CurrencyInfo | null = null
let cacheExpiry = 0
const CACHE_TTL = 60000 // 1 minute

// Get current currency from API (cached)
export async function getCurrencySettings(): Promise<CurrencyInfo> {
  const now = Date.now()
  if (cachedCurrency && now < cacheExpiry) return cachedCurrency

  try {
    const res = await fetch('/api/currencies/active')
    if (res.ok) {
      cachedCurrency = await res.json()
      cacheExpiry = now + CACHE_TTL
      return cachedCurrency!
    }
  } catch {
    // fallback
  }

  // Fallback to defaults
  return {
    code: 'ARS',
    name: 'Peso Argentino',
    symbol: '$',
    locale: 'es-AR',
    isBase: true,
    exchangeRate: 1,
  }
}

// Sync version using stored settings (for components that can't be async)
export function formatCurrency(amount: number, currency?: CurrencyInfo): string {
  const cur = currency || cachedCurrency || {
    code: 'ARS', name: 'Peso Argentino', symbol: '$', locale: 'es-AR', isBase: true, exchangeRate: 1,
  }

  try {
    return new Intl.NumberFormat(cur.locale, {
      style: 'currency',
      currency: cur.code,
      minimumFractionDigits: cur.code === 'COP' || cur.code === 'CLP' || cur.code === 'PYG' ? 0 : 2,
    }).format(amount)
  } catch {
    return `${cur.symbol}${amount.toLocaleString(cur.locale, { minimumFractionDigits: 2 })}`
  }
}

// Format amount in a specific currency (converts from base)
export function formatCurrencyIn(amount: number, targetCurrency: CurrencyInfo): string {
  const converted = targetCurrency.isBase ? amount : amount * targetCurrency.exchangeRate
  return formatCurrency(converted, targetCurrency)
}

// Convert amount from base currency to target
export function convertFromBase(amount: number, targetCurrency: CurrencyInfo): number {
  if (targetCurrency.isBase) return amount
  return amount * targetCurrency.exchangeRate
}

// Convert amount from target currency to base
export function convertToBase(amount: number, fromCurrency: CurrencyInfo): number {
  if (fromCurrency.isBase) return amount
  if (fromCurrency.exchangeRate === 0) return amount
  return amount / fromCurrency.exchangeRate
}

// Get the symbol for current currency
export function getCurrencySymbol(): string {
  return cachedCurrency?.symbol || '$'
}

// Set cached currency (called when settings load)
export function setCachedCurrency(currency: CurrencyInfo): void {
  cachedCurrency = currency
  cacheExpiry = Date.now() + CACHE_TTL
}

// Clear cache
export function clearCurrencyCache(): void {
  cachedCurrency = null
  cacheExpiry = 0
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date))
}

export function formatDateOnly(date: string | Date): string {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' }).format(new Date(date))
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('es-AR', { timeStyle: 'short' }).format(new Date(date))
}
