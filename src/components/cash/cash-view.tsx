'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
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
  Banknote,
  ArrowUpCircle,
  ArrowDownCircle,
  Plus,
  CreditCard,
  Wallet,
  TrendingUp,
  XCircle,
  Clock,
  History,
} from 'lucide-react'
import { CashOpenDialog } from './cash-open-dialog'
import { CashMovementDialog } from './cash-movement-dialog'
import { CashCloseDialog } from './cash-close-dialog'
import { formatCurrency, formatTime } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/types'
import type { PaymentMethod } from '@/lib/types'
import { BillBreakdownDisplay, jsonToBreakdown } from '@/components/cash/bill-breakdown-input'

interface SaleItem {
  id: string
  productId: string
  quantity: number
  salePrice: number
  subtotal: number
  product: { id: string; name: string }
}

interface Sale {
  id: string
  invoiceNumber: string
  paymentMethod: string
  total: number
  costTotal: number
  customerName: string | null
  createdAt: string
  items: SaleItem[]
}

interface CashMovement {
  id: string
  type: string
  amount: number
  reason: string
  createdAt: string
}

interface CashRegisterData {
  id: string
  openingAmount: number
  closingAmount: number | null
  expectedAmount: number | null
  difference: number | null
  status: string
  openedAt: string
  closedAt: string | null
  openingBillBreakdown: string | null
  closingBillBreakdown: string | null
  sales: Sale[]
  movements: CashMovement[]
}

interface CashRegisterHistory {
  id: string
  openingAmount: number
  closingAmount: number | null
  expectedAmount: number | null
  difference: number | null
  status: string
  openedAt: string
  closedAt: string | null
}

export function CashView() {
  const [openDialog, setOpenDialog] = useState(false)
  const [movementDialog, setMovementDialog] = useState(false)
  const [closeDialog, setCloseDialog] = useState(false)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)

  const { data: cashRegister, isLoading } = useQuery<CashRegisterData | null>({
    queryKey: ['cash-register'],
    queryFn: async () => {
      const res = await fetch('/api/cash-register')
      if (!res.ok) throw new Error('Error al obtener caja')
      return res.json()
    },
  })

  const { data: history = [] } = useQuery<CashRegisterHistory[]>({
    queryKey: ['cash-register-history'],
    queryFn: async () => {
      const res = await fetch('/api/cash-register?history=true')
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
  })

  const sales = cashRegister?.sales ?? []
  const salesSummary = useMemo(() => {
    if (sales.length === 0) return { EFECTIVO: { count: 0, total: 0, costTotal: 0 }, TRANSFERENCIA: { count: 0, total: 0, costTotal: 0 }, CUENTA_CASA: { count: 0, total: 0, costTotal: 0 } }
    const summary: Record<string, { count: number; total: number; costTotal: number }> = {
      EFECTIVO: { count: 0, total: 0, costTotal: 0 },
      TRANSFERENCIA: { count: 0, total: 0, costTotal: 0 },
      CUENTA_CASA: { count: 0, total: 0, costTotal: 0 },
    }
    for (const sale of sales) {
      const method = sale.paymentMethod as PaymentMethod
      if (summary[method]) {
        summary[method].count++
        summary[method].total += sale.total
        summary[method].costTotal += sale.costTotal
      }
    }
    return summary
  }, [sales])

  const totalVentas = useMemo(
    () => sales.reduce((sum, s) => sum + s.total, 0),
    [sales]
  )

  const methodBadgeColors: Record<string, string> = {
    EFECTIVO: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30',
    TRANSFERENCIA: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30',
    CUENTA_CASA: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border border-violet-100 dark:border-violet-800/30',
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Cargando estado de caja...</div>
      </div>
    )
  }

  // No register open
  if (!cashRegister) {
    return (
      <>
        <div className="flex items-center justify-center h-full min-h-[60vh]">
          <Card className="w-full max-w-md border-emerald-100 dark:border-emerald-900/30 shadow-lg shadow-emerald-500/5">
            <CardContent className="flex flex-col items-center gap-6 py-10">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-2xl flex items-center justify-center border border-emerald-100 dark:border-emerald-900/30">
                <Banknote className="w-10 h-10 text-emerald-500/60" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Caja Cerrada</h2>
                <p className="text-muted-foreground text-sm">
                  No hay ninguna caja abierta. Abra una nueva caja para comenzar a operar.
                </p>
              </div>
              <Button
                size="lg"
                onClick={() => setOpenDialog(true)}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 gap-2 shadow-lg shadow-emerald-600/20"
              >
                <Banknote className="w-5 h-5" />
                Abrir Caja
              </Button>
            </CardContent>
          </Card>
        </div>

        {history.length > 0 && (
          <div className="mt-8">
            <Card className="border-emerald-100 dark:border-emerald-900/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="w-4 h-4 text-emerald-600" />
                  Últimas Cajas Cerradas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Apertura</TableHead>
                      <TableHead>Cierre</TableHead>
                      <TableHead>Monto Apertura</TableHead>
                      <TableHead>Monto Cierre</TableHead>
                      <TableHead>Diferencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.slice(0, 5).map((reg) => (
                      <TableRow key={reg.id}>
                        <TableCell className="text-sm">
                          {new Date(reg.openedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {reg.closedAt
                            ? new Date(reg.closedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
                            : '-'}
                        </TableCell>
                        <TableCell>{formatCurrency(reg.openingAmount)}</TableCell>
                        <TableCell>{reg.closingAmount !== null ? formatCurrency(reg.closingAmount) : '-'}</TableCell>
                        <TableCell>
                          {reg.difference !== null ? (
                            <span className={reg.difference >= 0 ? 'text-emerald-600' : 'text-rose-500'}>
                              {reg.difference >= 0 ? '+' : ''}{formatCurrency(reg.difference)}
                            </span>
                          ) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        <CashOpenDialog open={openDialog} onOpenChange={setOpenDialog} />
      </>
    )
  }

  // Register is open
  const recentSales = cashRegister.sales.slice(0, 10)

  return (
    <>
      <div className="space-y-6">
        {/* Top summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-emerald-100 dark:border-emerald-900/30 shadow-sm shadow-emerald-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-lg flex items-center justify-center border border-emerald-200/50 dark:border-emerald-800/30">
                  <Wallet className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Monto Apertura</p>
                  <p className="text-lg font-bold">{formatCurrency(cashRegister.openingAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-100 dark:border-emerald-900/30 shadow-sm shadow-emerald-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 rounded-lg flex items-center justify-center border border-emerald-200/50 dark:border-emerald-800/30">
                  <Banknote className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Ventas Efectivo</p>
                  <p className="text-lg font-bold">{formatCurrency(salesSummary.EFECTIVO.total)}</p>
                  <p className="text-xs text-muted-foreground">{salesSummary.EFECTIVO.count} ventas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-100 dark:border-amber-900/30 shadow-sm shadow-amber-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-lg flex items-center justify-center border border-amber-200/50 dark:border-amber-800/30">
                  <CreditCard className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Ventas Transferencia</p>
                  <p className="text-lg font-bold">{formatCurrency(salesSummary.TRANSFERENCIA.total)}</p>
                  <p className="text-xs text-muted-foreground">{salesSummary.TRANSFERENCIA.count} ventas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-teal-100 dark:border-teal-900/30 shadow-sm shadow-teal-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/30 dark:to-cyan-900/30 rounded-lg flex items-center justify-center border border-teal-200/50 dark:border-teal-800/30">
                  <TrendingUp className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Ventas</p>
                  <p className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">{formatCurrency(totalVentas)}</p>
                  <p className="text-xs text-muted-foreground">{cashRegister.sales.length} ventas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sales by Payment Method + Cash Movements */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales by Payment Method */}
          <Card className="border-emerald-100 dark:border-emerald-900/30 shadow-sm shadow-emerald-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ventas por Método de Pago</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(salesSummary).map(([method, data]) => (
                <div key={method} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={methodBadgeColors[method]}>
                      {PAYMENT_METHOD_LABELS[method as PaymentMethod]}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {data.count} {data.count === 1 ? 'venta' : 'ventas'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">{formatCurrency(data.total)}</span>
                    {method === 'CUENTA_CASA' && data.costTotal > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Costo: {formatCurrency(data.costTotal)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Cash Movements */}
          <Card className="border-emerald-100 dark:border-emerald-900/30 shadow-sm shadow-emerald-500/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Movimientos de Caja</CardTitle>
                <Button size="sm" onClick={() => setMovementDialog(true)} className="gap-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm">
                  <Plus className="w-4 h-4" />
                  Registrar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {cashRegister.movements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay movimientos registrados
                </p>
              ) : (
                <ScrollArea className="max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hora</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Razón</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cashRegister.movements.map((mov) => (
                        <TableRow key={mov.id}>
                          <TableCell className="text-xs">{formatTime(mov.createdAt)}</TableCell>
                          <TableCell>
                            {mov.type === 'ENTRADA' ? (
                              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30 gap-1">
                                <ArrowUpCircle className="w-3 h-3" />
                                Entrada
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-100 dark:border-rose-800/30 gap-1">
                                <ArrowDownCircle className="w-3 h-3" />
                                Salida
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm max-w-[120px] truncate">{mov.reason}</TableCell>
                          <TableCell className="text-right font-medium">
                            <span className={mov.type === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-500'}>
                              {mov.type === 'ENTRADA' ? '+' : '-'}{formatCurrency(mov.amount)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Sales */}
        <Card className="border-emerald-100 dark:border-emerald-900/30 shadow-sm shadow-emerald-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4 text-emerald-600" />
              Ventas Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay ventas registradas en esta caja
              </p>
            ) : (
              <ScrollArea className="max-h-72">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentSales.map((sale, idx) => (
                      <TableRow
                        key={sale.id}
                        className="cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                        onClick={() => setSelectedSale(sale)}
                      >
                        <TableCell className="text-xs text-muted-foreground">{cashRegister.sales.length - idx}</TableCell>
                        <TableCell className="text-sm">{sale.customerName || 'Consumidor Final'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={methodBadgeColors[sale.paymentMethod] || ''}>
                            {PAYMENT_METHOD_LABELS[sale.paymentMethod as PaymentMethod] || sale.paymentMethod}
                          </Badge>
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

        {/* Sale Detail Dialog */}
        {selectedSale && (
          <SaleDetailDialog sale={selectedSale} open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)} />
        )}

        {/* Close Register Button */}
        <div className="flex justify-center pt-4">
          <Button
            size="lg"
            variant="destructive"
            onClick={() => setCloseDialog(true)}
            className="gap-2"
          >
            <XCircle className="w-5 h-5" />
            Cerrar Caja
          </Button>
        </div>

        {/* Cash Register History */}
        {history.length > 0 && (
          <Card className="border-emerald-100 dark:border-emerald-900/30 shadow-sm shadow-emerald-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="w-4 h-4 text-emerald-600" />
                Últimas Cajas Cerradas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Apertura</TableHead>
                      <TableHead>Cierre</TableHead>
                      <TableHead>Monto Apertura</TableHead>
                      <TableHead>Monto Cierre</TableHead>
                      <TableHead>Diferencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.slice(0, 5).map((reg) => (
                      <TableRow key={reg.id}>
                        <TableCell className="text-sm">
                          {new Date(reg.openedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {reg.closedAt
                            ? new Date(reg.closedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
                            : '-'}
                        </TableCell>
                        <TableCell>{formatCurrency(reg.openingAmount)}</TableCell>
                        <TableCell>{reg.closingAmount !== null ? formatCurrency(reg.closingAmount) : '-'}</TableCell>
                        <TableCell>
                          {reg.difference !== null ? (
                            <span className={reg.difference >= 0 ? 'text-emerald-600' : 'text-rose-500'}>
                              {reg.difference >= 0 ? '+' : ''}{formatCurrency(reg.difference)}
                            </span>
                          ) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <CashMovementDialog
        open={movementDialog}
        onOpenChange={setMovementDialog}
        cashRegisterId={cashRegister.id}
      />
      {/* Opening Bill Breakdown */}
      {cashRegister && cashRegister.openingBillBreakdown && (
        Object.keys(jsonToBreakdown(cashRegister.openingBillBreakdown)).length > 0 && (
          <BillBreakdownDisplay
            breakdown={jsonToBreakdown(cashRegister.openingBillBreakdown)}
            label="Desglose de Apertura"
          />
        )
      )}

      <CashCloseDialog
        open={closeDialog}
        onOpenChange={setCloseDialog}
        cashRegister={cashRegister}
      />
    </>
  )
}

// Sale Detail mini-dialog
function SaleDetailDialog({ sale, open, onOpenChange }: { sale: Sale; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalle Venta #{sale.invoiceNumber}</DialogTitle>
          <DialogDescription>
            {sale.customerName || 'Consumidor Final'} — {formatTime(sale.createdAt)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Método de Pago</span>
            <Badge variant="secondary">
              {PAYMENT_METHOD_LABELS[sale.paymentMethod as PaymentMethod] || sale.paymentMethod}
            </Badge>
          </div>
          <Separator />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-center">Cant.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm">{item.product?.name || '—'}</TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.subtotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Separator />
          <div className="flex items-center justify-between font-bold">
            <span>Total</span>
            <span>{formatCurrency(sale.total)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
