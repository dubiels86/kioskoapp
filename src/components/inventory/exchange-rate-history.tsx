'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { History, TrendingUp, TrendingDown } from 'lucide-react'

interface ExchangeRateHistory {
  id: string
  fromCurrency: string
  toCurrency: string
  rate: number
  source: string
  createdAt: string
}

export function ExchangeRateHistory() {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['exchange-rate-history'],
    queryFn: async () => {
      const res = await fetch('/api/currencies/exchange-rates?from=USD&to=CUP&limit=20')
      if (!res.ok) throw new Error('Error al obtener historial de tipos de cambio')
      return res.json() as Promise<ExchangeRateHistory[]>
    },
  })

  // Calculate trend
  const getTrend = (currentIndex: number) => {
    if (currentIndex === history.length - 1 || history.length < 2) return 'stable'
    const currentRate = history[currentIndex].rate
    const previousRate = history[currentIndex + 1].rate
    
    if (currentRate > previousRate) return 'up'
    if (currentRate < previousRate) return 'down'
    return 'stable'
  }

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('es-CU', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(dateString))
  }

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'manual':
        return <Badge variant="outline">Manual</Badge>
      case 'api':
        return <Badge variant="secondary">API</Badge>
      case 'calculated':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Calculado</Badge>
      default:
        return <Badge variant="outline">{source}</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Historial de Tipo de Cambio USD/CUP
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Registro de cambios en el precio del dólar respecto al peso cubano
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Cargando historial...
          </div>
        ) : history.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No hay registros de tipo de cambio
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y Hora</TableHead>
                  <TableHead className="text-right">Tipo de Cambio</TableHead>
                  <TableHead>Tendencia</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead className="text-right">Equivalente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record, index) => {
                  const trend = getTrend(index)
                  const previousRate = index < history.length - 1 ? history[index + 1].rate : null
                  const change = previousRate ? record.rate - previousRate : 0
                  const changePercent = previousRate ? (change / previousRate) * 100 : 0

                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {formatDate(record.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-lg font-bold">1 USD = {record.rate.toFixed(2)} CUP</span>
                          {previousRate && (
                            <span className="text-xs text-muted-foreground">
                              Anterior: {previousRate.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {trend === 'up' && (
                            <>
                              <TrendingUp className="h-4 w-4 text-red-500" />
                              <span className="text-red-600 dark:text-red-400">
                                +{change.toFixed(2)} ({changePercent.toFixed(1)}%)
                              </span>
                            </>
                          )}
                          {trend === 'down' && (
                            <>
                              <TrendingDown className="h-4 w-4 text-green-500" />
                              <span className="text-green-600 dark:text-green-400">
                                {change.toFixed(2)} ({changePercent.toFixed(1)}%)
                              </span>
                            </>
                          )}
                          {trend === 'stable' && (
                            <span className="text-muted-foreground">Sin cambio</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getSourceBadge(record.source)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-sm">100 USD = {(100 * record.rate).toFixed(2)} CUP</span>
                          <span className="text-xs text-muted-foreground">
                            1000 CUP = {(1000 / record.rate).toFixed(2)} USD
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Primer registro</p>
                <p className="text-lg font-bold">
                  {history[history.length - 1]?.rate.toFixed(2)} CUP
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(history[history.length - 1]?.createdAt)}
                </p>
              </div>
              <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Último registro</p>
                <p className="text-lg font-bold">
                  {history[0]?.rate.toFixed(2)} CUP
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(history[0]?.createdAt)}
                </p>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Cambio total</p>
                <p className={`text-lg font-bold ${
                  history[0]?.rate > history[history.length - 1]?.rate
                    ? 'text-red-600 dark:text-red-400'
                    : history[0]?.rate < history[history.length - 1]?.rate
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-muted-foreground'
                }`}>
                  {history.length > 1 ? (
                    <>
                      {(history[0]?.rate - history[history.length - 1]?.rate).toFixed(2)} CUP
                      <span className="block text-sm">
                        ({((history[0]?.rate / history[history.length - 1]?.rate - 1) * 100).toFixed(1)}%)
                      </span>
                    </>
                  ) : (
                    'Sin cambios'
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}