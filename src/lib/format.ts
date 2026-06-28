import { formatCurrency as formatCurrencyWithCode } from './currency'

export function formatCurrency(amount: number): string {
  return formatCurrencyWithCode(amount, 'ARS')
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

// Alias for backward compatibility
export { formatCurrency as formatCurrencyWithCode } from './currency'
export { getCurrencyInfo, convertPrice, calculateConvertedPrice } from './currency'
