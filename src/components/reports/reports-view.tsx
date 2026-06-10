'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  ArrowRightLeft,
  Receipt,
  Truck,
  ShoppingCart,
} from 'lucide-react'
import { formatCurrency, formatDate, formatTime } from '@/lib/format'
import { PAYMENT_METHOD_LABELS, EXPENSE_CATEGORY_LABELS, EXPENSE_PAYMENT_LABELS } from '@/lib/types'
import type { PaymentMethod } from '@/lib/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { BillBreakdownDisplay, jsonToBreakdown } from '@/components/cash/bill-breakdown-input'

type ReportMode = 'day' | 'range'

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
  cashRegister: { id: string; openingAmount: number; closingAmount: number | null; expectedAmount: number | null; difference: number | null; openedAt: string; closedAt: string | null } | null
}

interface Report {
  date?: string
  fromDate?: string
  toDate?: string
  isRange: boolean
  totalSalesCount: number
  totalSalesAmount: number
  totalCostOfGoods: number
  grossProfit: number
  totalDiscount: number
  salesByMethod: {
    EFECTIVO: { count: number; total: number }
    TARJETA: { count: number; total: number }
    CUENTA_CASA: { count: number; total: number; costTotal: number }
  }
  salesByDay: Record<string, { count: number; total: number; costTotal: number }>
  topProducts: Array<{ name: string; quantity: number; total: number; costTotal: number }>
  totalExpenses: number
  expensesByCategory: Record<string, number>
  expensesByPaymentMethod: Record<string, number>
  totalPurchases: number
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
  expenses: Array<{
    id: string
    description: string
    amount: number
    category: string
    paymentMethod: string
    date: string
    recipient: string | null
    receiptNumber: string | null
  }>
  purchases: Array<{
    id: string
    invoiceNumber: string | null
    totalAmount: number
    status: string
    createdAt: string
    supplier: { name: string } | null
  }>
}

export function ReportsView() {
  const [mode, setMode] = useState<ReportMode>('day')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [fromDate, setFromDate] = useState<Date>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d
  })
  const [toDate, setToDate] = useState<Date>(new Date())
  const [calendarOpen, setCalendarOpen] = useState(false)

  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const fromStr = format(fromDate, 'yyyy-MM-dd')
  const toStr = format(toDate, 'yyyy-MM-dd')

  const queryParams = mode === 'day'
    ? `date=${dateStr}`
    : `from=${fromStr}&to=${toStr}`

  const { data: report, isLoading } = useQuery<Report>({
    queryKey: ['report', queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/reports/daily?${queryParams}`)
      if (!res.ok) throw new Error('Error al obtener reporte')
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

  const setQuickDate = (type: 'today' | 'yesterday' | 'week' | 'month') => {
    const d = new Date()
    if (type === 'yesterday') d.setDate(d.getDate() - 1)
    if (type === 'week') d.setDate(d.getDate() - 7)
    if (type === 'month') d.setDate(d.getDate() - 30)
    setSelectedDate(d)
  }

  const setQuickRange = (type: 'last7' | 'last30' | 'thisMonth' | 'lastMonth') => {
    const to = new Date()
    const from = new Date()
    if (type === 'last7') from.setDate(from.getDate() - 6)
    if (type === 'last30') from.setDate(from.getDate() - 29)
    if (type === 'thisMonth') { from.setDate(1); from.setHours(0, 0, 0, 0) }
    if (type === 'lastMonth') {
      from.setMonth(from.getMonth() - 1, 1)
      from.setHours(0, 0, 0, 0)
      to.setDate(0) // last day of previous month
      to.setHours(23, 59, 59, 999)
    }
    setFromDate(from)
    setToDate(to)
  }

  const handlePrint = () => window.print()

  const dateLabel = mode === 'day'
    ? format(selectedDate, "dd 'de' MMMM, yyyy", { locale: es })
    : `${format(fromDate, "dd/MM/yy")} — ${format(toDate, "dd/MM/yy")}`

  const netProfit = (report?.grossProfit ?? 0) - (report?.totalExpenses ?? 0)

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

  const maxMethodTotal = Math.max(
    report.salesByMethod.EFECTIVO.total,
    report.salesByMethod.TARJETA.total,
    report.salesByMethod.CUENTA_CASA.total,
    1
  )

  // Sort salesByDay for the chart
  const sortedDays = Object.entries(report.salesByDay).sort(([a], [b]) => a.localeCompare(b))
  const maxDayTotal = Math.max(...sortedDays.map(([, d]) => d.total), 1)

  // Sort expense categories
  const sortedExpenseCategories = Object.entries(report.expensesByCategory).sort(([, a], [, b]) => b - a)
  const maxExpenseCategory = Math.max(...sortedExpenseCategories.map(([, v]) => v), 1)

  return (
    <>
      <div className="space-y-6 print-area">
        {/* Date Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Mode toggle */}
            <div className="flex rounded-lg border overflow-hidden">
              <button
                onClick={() => setMode('day')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'day'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                Por Día
              </button>
              <button
                onClick={() => setMode('range')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'range'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                Rango de Fechas
              </button>
            </div>

            {mode === 'day' ? (
              <>
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
                        if (date) { setSelectedDate(date); setCalendarOpen(false) }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setQuickDate('today')}>Hoy</Button>
                  <Button size="sm" variant="outline" onClick={() => setQuickDate('yesterday')}>Ayer</Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Desde</Label>
                    <Input
                      type="date"
                      value={fromStr}
                      onChange={(e) => setFromDate(new Date(e.target.value + 'T12:00:00'))}
                      className="h-9 w-36 text-sm"
                    />
                  </div>
                  <span className="text-muted-foreground mt-5">—</span>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Hasta</Label>
                    <Input
                      type="date"
                      value={toStr}
                      onChange={(e) => setToDate(new Date(e.target.value + 'T12:00:00'))}
                      className="h-9 w-36 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setQuickRange('last7')}>Últimos 7 días</Button>
                  <Button size="sm" variant="outline" onClick={() => setQuickRange('last30')}>Últimos 30 días</Button>
                  <Button size="sm" variant="outline" onClick={() => setQuickRange('thisMonth')}>Este Mes</Button>
                  <Button size="sm" variant="outline" onClick={() => setQuickRange('lastMonth')}>Mes Pasado</Button>
                </div>
              </>
            )}
          </div>
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
        </div>

        {/* Print Header */}
        <div className="hidden print:block print:mb-6">
          <h1 className="text-2xl font-bold">KioskoApp - Reporte</h1>
          <p className="text-muted-foreground">Período: {dateLabel}</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <Card className="border-border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-muted border rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ventas</p>
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
                  <TrendingUp className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ganancia Bruta</p>
                  <p className="text-sm font-bold text-primary">{formatCurrency(report.grossProfit)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30 border border-red-200/50 dark:border-red-800/30 rounded-lg flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gastos</p>
                  <p className="text-sm font-bold text-red-600">{formatCurrency(report.totalExpenses)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200/50 dark:border-blue-800/30 rounded-lg flex items-center justify-center">
                  <Truck className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Compras</p>
                  <p className="text-sm font-bold">{formatCurrency(report.totalPurchases)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border shadow-sm ${netProfit >= 0 ? 'border-emerald-200 dark:border-emerald-800/50' : 'border-red-200 dark:border-red-800/50'}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 border rounded-lg flex items-center justify-center ${
                  netProfit >= 0
                    ? 'bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 border-emerald-200/50 dark:border-emerald-800/30'
                    : 'bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30 border-red-200/50 dark:border-red-800/30'
                }`}>
                  <BarChart3 className={`w-4 h-4 ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ganancia Neta</p>
                  <p className={`text-sm font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Ventas - Costo - Gastos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for detailed sections */}
        <Tabs defaultValue="sales" className="space-y-4">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="sales" className="text-xs gap-1.5">
              <ShoppingCart className="w-3.5 h-3.5" /> Ventas
            </TabsTrigger>
            <TabsTrigger value="expenses" className="text-xs gap-1.5">
              <Receipt className="w-3.5 h-3.5" /> Gastos
            </TabsTrigger>
            <TabsTrigger value="products" className="text-xs gap-1.5">
              <Package className="w-3.5 h-3.5" /> Productos
            </TabsTrigger>
            {mode === 'range' && (
              <TabsTrigger value="chart" className="text-xs gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" /> Evolución
              </TabsTrigger>
            )}
            <TabsTrigger value="cash" className="text-xs gap-1.5">
              <Banknote className="w-3.5 h-3.5" /> Caja
            </TabsTrigger>
          </TabsList>

          {/* SALES TAB */}
          <TabsContent value="sales" className="space-y-4">
            {/* Sales by Payment Method */}
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
                      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${Math.max((data.total / maxMethodTotal) * 100, 0)}%` }} />
                    </div>
                  </div>
                ))}

                {/* Discount total */}
                {report.totalDiscount > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Descuentos otorgados</span>
                    <span className="font-semibold text-orange-600">-{formatCurrency(report.totalDiscount)}</span>
                  </div>
                )}
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

            {/* Sales List */}
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Listado de Ventas ({report.sales.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {report.sales.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No hay ventas registradas en este período.</p>
                ) : (
                  <ScrollArea className="max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>#</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          {mode === 'day' && <TableHead>Hora</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.sales.map((sale) => (
                          <TableRow key={sale.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {mode === 'range' ? formatDate(sale.createdAt) : formatTime(sale.createdAt)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{sale.invoiceNumber}</TableCell>
                            <TableCell className="text-sm">{sale.customerName || 'Consumidor Final'}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {PAYMENT_METHOD_LABELS[sale.paymentMethod as PaymentMethod] || sale.paymentMethod}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                              {sale.items.map((i) => i.product.name).join(', ') || '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(sale.total)}</TableCell>
                            {mode === 'day' && <TableCell className="text-xs text-muted-foreground">{formatTime(sale.createdAt)}</TableCell>}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* EXPENSES TAB */}
          <TabsContent value="expenses" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Expenses by Category */}
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Gastos por Categoría</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sortedExpenseCategories.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Sin gastos en este período</p>
                  ) : (
                    sortedExpenseCategories.map(([cat, amount]) => (
                      <div key={cat} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">{EXPENSE_CATEGORY_LABELS[cat as keyof typeof EXPENSE_CATEGORY_LABELS] || cat}</span>
                          <span className="text-sm font-semibold">{formatCurrency(amount)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full bg-red-400 transition-all duration-500" style={{ width: `${(amount / maxExpenseCategory) * 100}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Expenses by Payment Method */}
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Gastos por Método de Pago</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(report.expensesByPaymentMethod).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Sin gastos en este período</p>
                  ) : (
                    Object.entries(report.expensesByPaymentMethod).map(([method, amount]) => (
                      <div key={method} className="flex items-center justify-between py-1">
                        <span className="text-sm">{EXPENSE_PAYMENT_LABELS[method as keyof typeof EXPENSE_PAYMENT_LABELS] || method}</span>
                        <span className="text-sm font-semibold">{formatCurrency(amount)}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Expenses List */}
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Listado de Gastos ({report.expenses.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {report.expenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No hay gastos en este período.</p>
                ) : (
                  <ScrollArea className="max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead>Pago</TableHead>
                          <TableHead>Destinatario</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.expenses.map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(expense.date)}
                            </TableCell>
                            <TableCell className="text-sm">{expense.description}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {EXPENSE_CATEGORY_LABELS[expense.category as keyof typeof EXPENSE_CATEGORY_LABELS] || expense.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {EXPENSE_PAYMENT_LABELS[expense.paymentMethod as keyof typeof EXPENSE_PAYMENT_LABELS] || expense.paymentMethod}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{expense.recipient || '—'}</TableCell>
                            <TableCell className="text-right font-medium text-red-600">{formatCurrency(expense.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PRODUCTS TAB */}
          <TabsContent value="products" className="space-y-4">
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Top Productos Vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                {report.topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No hay productos vendidos en este período.</p>
                ) : (
                  <ScrollArea className="max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-center">Cantidad</TableHead>
                          <TableHead className="text-right">Total Venta</TableHead>
                          <TableHead className="text-right">Costo</TableHead>
                          <TableHead className="text-right">Ganancia</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.topProducts.map((product, idx) => {
                          const profit = product.total - product.costTotal
                          return (
                            <TableRow key={idx}>
                              <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell className="text-sm font-medium">{product.name}</TableCell>
                              <TableCell className="text-center">{product.quantity}</TableCell>
                              <TableCell className="text-right">{formatCurrency(product.total)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{formatCurrency(product.costTotal)}</TableCell>
                              <TableCell className={`text-right font-medium ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatCurrency(profit)}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CHART TAB (only in range mode) */}
          {mode === 'range' && (
            <TabsContent value="chart" className="space-y-4">
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Evolución de Ventas por Día</CardTitle>
                </CardHeader>
                <CardContent>
                  {sortedDays.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No hay datos en este período.</p>
                  ) : (
                    <div className="space-y-2">
                      {sortedDays.map(([day, data]) => (
                        <div key={day} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground w-24">
                              {new Date(day + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                            </span>
                            <span className="font-medium">{formatCurrency(data.total)}</span>
                            <span className="text-muted-foreground">({data.count} ventas)</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-4 overflow-hidden relative">
                            <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${(data.total / maxDayTotal) * 100}%` }} />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[10px] font-medium text-muted-foreground">
                                Ganancia: {formatCurrency(data.total - data.costTotal)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Purchases summary */}
              {report.purchases.length > 0 && (
                <Card className="border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Truck className="w-4 h-4" />
                      Compras del Período ({report.purchases.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-64">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Proveedor</TableHead>
                            <TableHead>Factura</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {report.purchases.map((purchase) => (
                            <TableRow key={purchase.id}>
                              <TableCell className="text-xs text-muted-foreground">{formatDate(purchase.createdAt)}</TableCell>
                              <TableCell className="text-sm">{purchase.supplier?.name || '—'}</TableCell>
                              <TableCell className="text-sm">{purchase.invoiceNumber || '—'}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {purchase.status === 'RECIBIDA' ? 'Recibida' : purchase.status === 'PENDIENTE' ? 'Pendiente' : 'Cancelada'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(purchase.totalAmount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {/* CASH TAB */}
          <TabsContent value="cash" className="space-y-4">
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
                          <TableCell className="text-sm">{formatDate(reg.openedAt)}</TableCell>
                          <TableCell className="text-sm">{reg.closedAt ? formatDate(reg.closedAt) : 'Abierta'}</TableCell>
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
                          {hasOpening && <BillBreakdownDisplay breakdown={openingBreakdown} label="Desglose de Apertura" />}
                          {hasClosing && <BillBreakdownDisplay breakdown={closingBreakdown} label="Desglose de Cierre" />}
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}

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

            {report.cashRegister.registers.length === 0 && !report.cashRegister.open && (
              <p className="text-sm text-muted-foreground text-center py-8">No hay registros de caja en este período.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Print CSS */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
        }
      `}</style>
    </>
  )
}
