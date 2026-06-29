'use client'

import { useUsdExchangeRate, getExchangeRateDisplay } from '@/lib/currency'
import { Badge } from '@/components/ui/badge'
import { RefreshCw } from 'lucide-react'

export function ExchangeRateBanner() {
  const { data: exchangeRate, isLoading, refetch } = useUsdExchangeRate()

  return (
    <div className="bg-gradient-to-r from-blue-50 to-emerald-50 dark:from-blue-900/20 dark:to-emerald-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white dark:bg-slate-800 p-2 rounded-md border shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">US$</span>
              <span className="text-2xl font-bold">1</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 text-2xl font-bold">
            <span className="text-blue-600 dark:text-blue-400">=</span>
            <div className="bg-white dark:bg-slate-800 p-2 rounded-md border shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">$MN</span>
                <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {isLoading ? '...' : exchangeRate?.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <Badge variant="outline" className="bg-white dark:bg-slate-800">
            {isLoading ? 'Cargando...' : getExchangeRateDisplay(exchangeRate || 240)}
          </Badge>
          <p className="text-xs text-muted-foreground mt-1">
            Tipo de cambio USD/CUP del día
          </p>
        </div>
      </div>
      
      <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between text-sm">
          <div>
            <p className="text-muted-foreground">
              <span className="font-medium">Nota:</span> Los precios en CUP se convierten automáticamente a USD
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs"
          >
            <RefreshCw className="h-3 w-3" />
            Actualizar
          </button>
        </div>
      </div>
    </div>
  )
}