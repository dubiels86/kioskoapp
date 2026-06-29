import { CurrencyBadge } from './currency-badge'
import { formatCurrencyWithCode } from '@/lib/format'

interface CurrencySummaryProps {
  price: number
  currencyCode: string
  exchangeRate?: number
  targetCurrency?: string
  showConverted?: boolean
}

export function CurrencySummary({ 
  price, 
  currencyCode, 
  exchangeRate = 1, 
  targetCurrency = 'ARS',
  showConverted = false
}: CurrencySummaryProps) {
  const needsConversion = currencyCode !== targetCurrency && exchangeRate !== 1
  
  return (
    <div className="flex items-center gap-2">
      <CurrencyBadge currencyCode={currencyCode} />
      <span className="font-medium">{formatCurrencyWithCode(price, currencyCode)}</span>
      
      {needsConversion && showConverted && (
        <>
          <span className="text-muted-foreground text-sm">→</span>
          <CurrencyBadge currencyCode={targetCurrency} />
          <span className="font-medium text-primary">
            {formatCurrencyWithCode(price * exchangeRate, targetCurrency)}
          </span>
        </>
      )}
      
      {needsConversion && !showConverted && (
        <span className="text-xs text-muted-foreground ml-1">
          (TC: {exchangeRate.toFixed(4)})
        </span>
      )}
    </div>
  )
}

interface PurchaseCurrencySummaryProps {
  totalAmount: number
  currencyCode: string
  exchangeRate: number
  showFull?: boolean
}

export function PurchaseCurrencySummary({ 
  totalAmount, 
  currencyCode, 
  exchangeRate, 
  showFull = false
}: PurchaseCurrencySummaryProps) {
  const baseCurrency = 'ARS'
  const needsConversion = currencyCode !== baseCurrency && exchangeRate !== 1
  
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <CurrencyBadge currencyCode={currencyCode} />
        <span className="text-xl font-bold">{formatCurrencyWithCode(totalAmount, currencyCode)}</span>
      </div>
      
      {needsConversion && showFull && (
        <div className="text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>Tipo de cambio: {exchangeRate.toFixed(4)}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <CurrencyBadge currencyCode={baseCurrency} />
            <span className="font-medium">{formatCurrencyWithCode(totalAmount * exchangeRate, baseCurrency)}</span>
          </div>
        </div>
      )}
    </div>
  )
}