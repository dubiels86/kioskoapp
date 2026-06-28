'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  BarChart3,
  CalendarIcon,
  Printer,
  TrendingUp,
  Banknote,
  CreditCard,
  Wallet,
  Package,
  ArrowDownRight,
  ChevronDown,
} from 'lucide-react'
import { formatCurrency, formatDate, formatTime } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/types'
import type { PaymentMethod } from '@/lib/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { BillBreakdownDisplay, jsonToBreakdown } from '@/components/cash/bill-breakdown-input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Layers, PackageCheck, Tag } from 'lucide-react'

interface SaleItem {
  id: string
  productId: string
  product: { id: string; name: string }
  quantity: number
  costPrice: number
  salePrice: number
  subtotal: number
  costSubtotal: number
}

interface Sale {
  id: string
  invoiceNumber: string
  paymentMethod: string
  total: number
  costTotal: number
  subtotal: number
  discount: number
  customerName: string | null
  createdAt: string
  items: SaleItem[]
  payments?: Array<{
    method: string
    amount: number
  }>
  cashRegister: { id: string; openingAmount: number; closingAmount: number | null; expectedAmount: number | null; difference: number | null; openedAt: string; closedAt: string | null } | null
}

interface DailyReport {
  date: string
  totalSalesCount: number
  totalSalesAmount: number
  totalCostOfGoods: number
  grossProfit: number
  salesByMethod: {
    EFECTIVO: { count: number; total: number }
    TARJETA: { count: number; total: number }
    CUENTA_CASA: { count: number; total: number; costTotal: number }
  }
  mixedPaymentsData?: Record<string, { cash: number; card: number }>
  cashRegister: {
    open: { id: string; openingAmount: number; status: string; openedAt: string; openingBillBreakdown: string | null } | null
    registers: Array<{
      id: string
      openingAmount: number
      closingAmount: number | null
      expectedAmount: number | null
      difference: number | null
      openedAt: string
      closedAt: string | null
      openingBillBreakdown: string | null
      closingBillBreakdown: string | null
    }>
  }
  sales: Sale[]
}

export function ReportsView() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [calendarOpen, setCalendarOpen] = useState(false)

  const dateStr = format(selectedDate, 'yyyy-MM-dd')

  const { data: report, isLoading } = useQuery<DailyReport>({
    queryKey: ['daily-report', dateStr],
    queryFn: async () => {
      const res = await fetch(`/api/reports/daily?date=${dateStr}`)
      if (!res.ok) throw new Error('Error al obtener reporte')
      return res.json()
    },
  })

  // Fetch sales by category report
  const { data: categoryReport, isLoading: isLoadingCategory } = useQuery({
    queryKey: ['sales-by-category', dateStr],
    queryFn: async () => {
      const res = await fetch(`/api/reports/sales-by-category?date=${dateStr}`)
      if (!res.ok) throw new Error('Error al obtener reporte por categoría')
      return res.json()
    },
  })

  const reportSales = report?.sales ?? []
  const cuentaCasaItems = useMemo(() => {
    if (reportSales.length === 0) return []
    const items: Array<{ productName: string; quantity: number; costPrice: number; salePrice: number; costSubtotal: number }> = []
    for (const sale of reportSales) {
      if (sale.paymentMethod === 'CUENTA_CASA') {
        for (const item of sale.items) {
          const existing = items.find((i) => i.productName === item.product.name)
          if (existing) {
            existing.quantity += item.quantity
            existing.costSubtotal += item.costSubtotal
          } else {
            items.push({
              productName: item.product.name,
              quantity: item.quantity,
              costPrice: item.costPrice,
              salePrice: item.salePrice,
              costSubtotal: item.costSubtotal,
            })
          }
        }
      }
    }
    return items
  }, [reportSales])

  const totalMerma = useMemo(
    () => cuentaCasaItems.reduce((sum, i) => sum + i.costSubtotal, 0),
    [cuentaCasaItems]
  )

  const setQuickDate = (type: 'today' | 'yesterday' | 'week') => {
    const d = new Date()
    if (type === 'yesterday') d.setDate(d.getDate() - 1)
    if (type === 'week') d.setDate(d.getDate() - 7)
    setSelectedDate(d)
  }

  const handlePrint = () => {
    window.print()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Cargando reporte...</div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No se pudo cargar el reporte.</p>
      </div>
    )
  }

  const isLoadingAny = isLoading || isLoadingCategory

  const maxMethodTotal = Math.max(
    report.salesByMethod.EFECTIVO.total,
    report.salesByMethod.TARJETA.total,
    report.salesByMethod.CUENTA_CASA.total,
    1
  )

  return (
    <>
      <div className="space-y-6 print-area">
        {/* Date Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3 flex-wrap">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {format(selectedDate, "dd 'de' MMMM, yyyy", { locale: es })}
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date)
                      setCalendarOpen(false)
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setQuickDate('today')}>
                Hoy
              </Button>
              <Button size="sm" variant="outline" onClick={() => setQuickDate('yesterday')}>
                Ayer
              </Button>
              <Button size="sm" variant="outline" onClick={() => setQuickDate('week')}>
                Esta Semana
              </Button>
            </div>
          </div>
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Imprimir Reporte
          </Button>
        </div>

        {/* Print Header - only visible when printing */}
        <div className="hidden print:block print:mb-6">
          <h1 className="text-2xl font-bold">KioskoApp - Reporte de Ventas</h1>
          <p className="text-muted-foreground">
            Fecha: {format(selectedDate, "dd 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card className="border-border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-muted border rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Ventas</p>
                  <p className="text-sm font-bold">{formatCurrency(report.totalSalesAmount)}</p>
                  <p className="text-xs text-muted-foreground">{report.totalSalesCount} ventas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-muted border rounded-lg flex items-center justify-center">
                  <Banknote className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Efectivo</p>
                  <p className="text-sm font-bold">{formatCurrency(report.salesByMethod.EFECTIVO.total)}</p>
                  <p className="text-xs text-muted-foreground">{report.salesByMethod.EFECTIVO.count} ventas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200/50 dark:border-amber-800/30 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tarjeta</p>
                  <p className="text-sm font-bold">{formatCurrency(report.salesByMethod.TARJETA.total)}</p>
                  <p className="text-xs text-muted-foreground">{report.salesByMethod.TARJETA.count} ventas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 border border-violet-200/50 dark:border-violet-800/30 rounded-lg flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cuenta Casa</p>
                  <p className="text-sm font-bold">{formatCurrency(report.salesByMethod.CUENTA_CASA.total)}</p>
                  <p className="text-xs text-muted-foreground">Costo: {formatCurrency(report.salesByMethod.CUENTA_CASA.costTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-orange-100 to-rose-100 dark:from-orange-900/30 dark:to-rose-900/30 border border-orange-200/50 dark:border-orange-800/30 rounded-lg flex items-center justify-center">
                  <Package className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Costo Mercadería</p>
                  <p className="text-sm font-bold">{formatCurrency(report.totalCostOfGoods)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-muted border rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ganancia Bruta</p>
                  <p className="text-sm font-bold text-primary">{formatCurrency(report.grossProfit)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different report sections */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full md:w-auto grid-cols-3">
            <TabsTrigger value="overview">
              <BarChart3 className="w-4 h-4 mr-2" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="categories">
              <Tag className="w-4 h-4 mr-2" />
              Por Categoría
            </TabsTrigger>
            <TabsTrigger value="stock">
              <PackageCheck className="w-4 h-4 mr-2" />
              Stock POS
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">

        {/* Sales by Payment Method - Visual */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Ventas por Método de Pago</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { method: 'EFECTIVO' as PaymentMethod, data: report.salesByMethod.EFECTIVO, color: 'bg-emerald-500', bgLight: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30' },
              { method: 'TARJETA' as PaymentMethod, data: report.salesByMethod.TARJETA, color: 'bg-amber-500', bgLight: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30' },
              { method: 'CUENTA_CASA' as PaymentMethod, data: report.salesByMethod.CUENTA_CASA, color: 'bg-violet-500', bgLight: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border border-violet-100 dark:border-violet-800/30' },
            ].map(({ method, data, color, bgLight }) => (
              <div key={method} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={bgLight}>
                      {PAYMENT_METHOD_LABELS[method]}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {data.count} {data.count === 1 ? 'venta' : 'ventas'}
                    </span>
                  </div>
                  <span className="font-semibold">{formatCurrency(data.total)}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color} transition-all duration-500`}
                    style={{ width: `${Math.max((data.total / maxMethodTotal) * 100, 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* CUENTA_CASA / Merma Detail */}
        {cuentaCasaItems.length > 0 && (
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowDownRight className="w-4 h-4 text-red-500" />
                Cuenta Casa / Merma - Detalle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Cantidad</TableHead>
                    <TableHead className="text-right">Precio Costo</TableHead>
                    <TableHead className="text-right">Subtotal Costo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cuentaCasaItems.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-sm">{item.productName}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.costPrice)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.costSubtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Separator className="my-3" />
              <div className="flex justify-between font-bold text-red-600">
                <span>Total Merma (a precio de costo)</span>
                <span>{formatCurrency(totalMerma)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mixed Payments Detail */}
        {report.mixedPaymentsData && Object.keys(report.mixedPaymentsData).length > 0 && (
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <CreditCard className="w-4 h-4 text-blue-600" />
                </div>
                Pagos Mixtos - Detalle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factura</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Efectivo</TableHead>
                    <TableHead>Tarjeta</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.sales
                    .filter(sale => report.mixedPaymentsData && sale.id in report.mixedPaymentsData)
                    .map((sale) => {
                      const mixedData = report.mixedPaymentsData![sale.id]
                      return (
                        <TableRow key={sale.id}>
                          <TableCell className="text-sm font-mono">{sale.invoiceNumber}</TableCell>
                          <TableCell className="text-sm">{sale.customerName || 'Consumidor Final'}</TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">
                            {formatCurrency(mixedData.cash)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-blue-600">
                            {formatCurrency(mixedData.card)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(sale.total)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatTime(sale.createdAt)}</TableCell>
                        </TableRow>
                      )
                    })}
                </TableBody>
              </Table>
              <Separator className="my-3" />
              <div className="flex justify-between text-sm">
                <span className="font-medium">Total pagos mixtos:</span>
                <span className="font-bold">
                  {Object.keys(report.mixedPaymentsData).length} ventas
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sales List */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Listado de Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            {report.sales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay ventas registradas para este día.
              </p>
            ) : (
              <ScrollArea className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.sales.map((sale, idx) => (
                      <TableRow key={sale.id}>
                        <TableCell className="text-xs text-muted-foreground">{report.sales.length - idx}</TableCell>
                        <TableCell className="text-sm">{sale.customerName || 'Consumidor Final'}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {sale.payments && sale.payments.length > 0 ? (
                              sale.payments.map((payment, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs w-fit">
                                  {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] || payment.method}: {formatCurrency(payment.amount)}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="secondary" className="text-xs w-fit">
                                {PAYMENT_METHOD_LABELS[sale.paymentMethod as PaymentMethod] || sale.paymentMethod}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {sale.items.map((i) => i.product.name).join(', ') || '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(sale.total)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatTime(sale.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Cash Register Info */}
        {report.cashRegister.registers.length > 0 && (
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Banknote className="w-4 h-4" />
                Información de Caja
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Apertura</TableHead>
                    <TableHead>Cierre</TableHead>
                    <TableHead>Monto Apertura</TableHead>
                    <TableHead>Monto Cierre</TableHead>
                    <TableHead>Esperado</TableHead>
                    <TableHead>Diferencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.cashRegister.registers.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell className="text-sm">
                        {formatDate(reg.openedAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {reg.closedAt ? formatDate(reg.closedAt) : 'Abierta'}
                      </TableCell>
                      <TableCell>{formatCurrency(reg.openingAmount)}</TableCell>
                      <TableCell>{reg.closingAmount !== null ? formatCurrency(reg.closingAmount) : '-'}</TableCell>
                      <TableCell>{reg.expectedAmount !== null ? formatCurrency(reg.expectedAmount) : '-'}</TableCell>
                      <TableCell>
                        {reg.difference !== null ? (
                          <span className={reg.difference >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                            {reg.difference >= 0 ? '+' : ''}{formatCurrency(reg.difference)}
                          </span>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Bill Breakdown details for each register */}
              {report.cashRegister.registers.map((reg) => {
                const openingBreakdown = jsonToBreakdown(reg.openingBillBreakdown)
                const closingBreakdown = jsonToBreakdown(reg.closingBillBreakdown)
                const hasOpening = Object.keys(openingBreakdown).length > 0
                const hasClosing = Object.keys(closingBreakdown).length > 0
                if (!hasOpening && !hasClosing) return null
                return (
                  <div key={`breakdown-${reg.id}`} className="rounded-lg border p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground">
                      Caja del {formatDate(reg.openedAt)}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {hasOpening && (
                        <BillBreakdownDisplay
                          breakdown={openingBreakdown}
                          label="Desglose de Apertura"
                        />
                      )}
                      {hasClosing && (
                        <BillBreakdownDisplay
                          breakdown={closingBreakdown}
                          label="Desglose de Cierre"
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

            {/* Currently open register */}
            {report.cashRegister.open && (
              <Card className="border-emerald-200 dark:border-emerald-800/50 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-medium">Caja actualmente abierta</span>
                    <span className="text-sm text-muted-foreground">
                      — Apertura: {formatCurrency(report.cashRegister.open.openingAmount)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-6">
            {isLoadingCategory ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-pulse text-muted-foreground">Cargando reporte por categoría...</div>
              </div>
            ) : categoryReport?.categoriesData && categoryReport.categoriesData.length > 0 ? (
              <div className="space-y-6">
                <Card className="border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      Ventas por Categoría
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {categoryReport.categoriesData.map((category) => (
                        <div key={category.categoryId} className="border rounded-lg p-4">
                          <div className="flex justify-between items-center mb-3">
                            <h3 className="font-semibold text-lg">{category.categoryName}</h3>
                            <div className="text-right">
                              <div className="text-sm text-slate-500">{category.totalQuantity} unidades</div>
                              <div className="text-xl font-bold">{formatCurrency(category.totalSaleAmount)}</div>
                              <div className="text-xs text-emerald-600">
                                Ganancia: {formatCurrency(category.totalProfit)}
                              </div>
                            </div>
                          </div>
                          
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead className="text-right">Cantidad</TableHead>
                                <TableHead className="text-right">Total Venta</TableHead>
                                <TableHead className="text-right">Ganancia</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {category.products.map((product) => (
                                <TableRow key={product.productId}>
                                  <TableCell className="text-sm">{product.productName}</TableCell>
                                  <TableCell className="text-right font-medium">{product.quantitySold}</TableCell>
                                  <TableCell className="text-right font-semibold">{formatCurrency(product.saleAmount)}</TableCell>
                                  <TableCell className="text-right text-emerald-600 font-medium">
                                    {formatCurrency(product.profit)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border-border shadow-sm">
                <CardContent className="py-8 text-center">
                  <Tag className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-muted-foreground">No hay ventas por categoría para esta fecha</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Stock Tab */}
          <TabsContent value="stock" className="space-y-6">
            {isLoadingCategory ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-pulse text-muted-foreground">Cargando stock del punto de venta...</div>
              </div>
            ) : categoryReport?.posStockData && categoryReport.posStockData.length > 0 ? (
              <div className="space-y-6">
                <Card className="border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <PackageCheck className="w-4 h-4" />
                      Stock en Punto de Ventas
                      {categoryReport.posWarehouse && (
                        <span className="text-sm font-normal text-muted-foreground">
                          ({categoryReport.posWarehouse.name})
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead className="text-right">Código</TableHead>
                            <TableHead className="text-right">Precio Venta</TableHead>
                            <TableHead className="text-right">Stock Actual</TableHead>
                            <TableHead className="text-right">Stock Mínimo</TableHead>
                            <TableHead>Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categoryReport.posStockData.map((product) => (
                            <TableRow key={product.productId}>
                              <TableCell className="text-sm">{product.categoryName}</TableCell>
                              <TableCell className="font-medium">{product.productName}</TableCell>
                              <TableCell className="text-right text-sm text-slate-500 font-mono">
                                {product.barcode || '-'}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(product.salePrice)}
                              </TableCell>
                              <TableCell className="text-right font-bold">
                                {product.posStock} {product.unit}
                              </TableCell>
                              <TableCell className="text-right text-slate-500">
                                {product.minStock} {product.unit}
                              </TableCell>
                              <TableCell>
                                {product.posStock <= 0 ? (
                                  <Badge variant="destructive" className="text-xs">Agotado</Badge>
                                ) : product.isLowStock ? (
                                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Bajo Stock</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">OK</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                    
                    <Separator className="my-4" />
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <div className="text-slate-500">Total Productos</div>
                        <div className="text-xl font-bold">{categoryReport.posStockData.length}</div>
                      </div>
                      <div className="text-center p-3 bg-emerald-50 rounded-lg">
                        <div className="text-slate-500">Stock OK</div>
                        <div className="text-xl font-bold text-emerald-600">
                          {categoryReport.posStockData.filter(p => !p.isLowStock && p.posStock > 0).length}
                        </div>
                      </div>
                      <div className="text-center p-3 bg-amber-50 rounded-lg">
                        <div className="text-slate-500">Bajo Stock</div>
                        <div className="text-xl font-bold text-amber-600">
                          {categoryReport.posStockData.filter(p => p.isLowStock).length}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border-border shadow-sm">
                <CardContent className="py-8 text-center">
                  <PackageCheck className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-muted-foreground">No hay productos en el punto de venta</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Print-specific CSS */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area,
          .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
        }
      `}</style>
    </>
  )
}
