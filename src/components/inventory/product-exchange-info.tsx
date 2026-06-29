'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { DollarSign, TrendingUp, Clock } from 'lucide-react'
import { formatDate } from '@/lib/format'

interface ProductExchangeInfoProps {
  product: {
    id: string
    name: string
    costPrice: number
    costCurrency: string
    salePrice: number
    saleCurrency: string
    costExchangeRate?: number | null
    saleExchangeRate?: number | null
    updatedAt: string
  }
  currentExchangeRate: number
}

export function ProductExchangeInfo({ product, currentExchangeRate }: ProductExchangeInfoProps) {
  const hasCostExchangeInfo = product.costExchangeRate && product.costCurrency === 'CUP'
  const hasSaleExchangeInfo = product.saleExchangeRate && product.saleCurrency === 'CUP'

  const calculateCurrentUsdEquivalent = (price: number, currency: string) => {
    if (currency === 'USD') return price
    return price / currentExchangeRate
  }

  const getExchangeRateDifference = (productRate?: number | null) => {
    if (!productRate) return null
    const difference = currentExchangeRate - productRate
    const percent = (difference / productRate) * 100
    return { difference, percent }
  }

  const costRateDiff = getExchangeRateDifference(product.costExchangeRate)
  const saleRateDiff = getExchangeRateDifference(product.saleExchangeRate)

  return (
    <Card className="border-blue-200 dark:border-blue-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-blue-700 dark:text-blue-300">
              Información de Tipo de Cambio
            </h3>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Actualizado: {formatDate(product.updatedAt)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cost Price Information */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Precio de Costo</span>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {product.costCurrency}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                <p className="text-xs text-muted-foreground">Precio original</p>
                <p className="text-lg font-bold">
                  {product.costPrice.toFixed(2)} {product.costCurrency}
                </p>
              </div>
              
              <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                <p className="text-xs text-muted-foreground">Equivalente actual</p>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                  {calculateCurrentUsdEquivalent(product.costPrice, product.costCurrency).toFixed(2)} USD
                </p>
              </div>
            </div>

            {hasCostExchangeInfo && (
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">TC usado:</span>
                  <span className="font-medium">1 USD = {product.costExchangeRate} CUP</span>
                </div>
                
                {costRateDiff && (
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Variación:</span>
                    <div className={`flex items-center gap-1 ${costRateDiff.difference > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {costRateDiff.difference > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingUp className="h-3 w-3 rotate-180" />
                      )}
                      <span>
                        {costRateDiff.difference > 0 ? '+' : ''}
                        {costRateDiff.difference.toFixed(2)} CUP ({costRateDiff.percent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sale Price Information */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Precio de Venta</span>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                {product.saleCurrency}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                <p className="text-xs text-muted-foreground">Precio original</p>
                <p className="text-lg font-bold">
                  {product.salePrice.toFixed(2)} {product.saleCurrency}
                </p>
              </div>
              
              <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                <p className="text-xs text-muted-foreground">Equivalente actual</p>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                  {calculateCurrentUsdEquivalent(product.salePrice, product.saleCurrency).toFixed(2)} USD
                </p>
              </div>
            </div>

            {hasSaleExchangeInfo && (
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">TC usado:</span>
                  <span className="font-medium">1 USD = {product.saleExchangeRate} CUP</span>
                </div>
                
                {saleRateDiff && (
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Variación:</span>
                    <div className={`flex items-center gap-1 ${saleRateDiff.difference > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {saleRateDiff.difference > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingUp className="h-3 w-3 rotate-180" />
                      )}
                      <span>
                        {saleRateDiff.difference > 0 ? '+' : ''}
                        {saleRateDiff.difference.toFixed(2)} CUP ({saleRateDiff.percent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium">Tipo de cambio actual</p>
              <p className="text-xs text-muted-foreground">1 USD = {currentExchangeRate.toFixed(2)} CUP</p>
            </div>
            
            <div className="text-right">
              <p className="font-medium">Impacto en márgenes</p>
              <p className="text-xs text-muted-foreground">
                {costRateDiff?.difference && costRateDiff.difference > 0 ? (
                  <span className="text-red-600 dark:text-red-400">Costos aumentaron</span>
                ) : costRateDiff?.difference && costRateDiff.difference < 0 ? (
                  <span className="text-green-600 dark:text-green-400">Costos disminuyeron</span>
                ) : (
                  <span className="text-muted-foreground">Costos estables</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}