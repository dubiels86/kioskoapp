import { Badge } from '@/components/ui/badge'
import { getCurrencyInfo } from '@/lib/format'

interface CurrencyBadgeProps {
  currencyCode: string
  showName?: boolean
  className?: string
}

export function CurrencyBadge({ currencyCode, showName = false, className = '' }: CurrencyBadgeProps) {
  const currencyInfo = getCurrencyInfo(currencyCode)
  
  const getCurrencyColor = (code: string) => {
    switch (code) {
      case 'ARS': return 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800/30'
      case 'USD': return 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-100 dark:border-green-800/30'
      case 'EUR': return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-100 dark:border-yellow-800/30'
      case 'CUP': return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-100 dark:border-red-800/30'
      case 'BRL': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30'
      default: return 'bg-gray-50 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 border border-gray-100 dark:border-gray-800/30'
    }
  }
  
  const displayText = showName ? `${currencyInfo.name} (${currencyInfo.symbol})` : currencyInfo.symbol
  
  return (
    <Badge 
      variant="outline" 
      className={`${getCurrencyColor(currencyCode)} ${className}`}
      title={`${currencyInfo.name} (${currencyCode})`}
    >
      {displayText}
    </Badge>
  )
}