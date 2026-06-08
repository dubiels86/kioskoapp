'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Receipt,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  DollarSign,
  TrendingDown,
  Calendar,
  Banknote,
  ArrowRightLeft,
  Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatDateOnly } from '@/lib/format'
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_COLORS,
  EXPENSE_PAYMENT_LABELS,
} from '@/lib/types'
import type { ExpenseCategory, ExpensePaymentMethod } from '@/lib/types'

interface ExpenseData {
  id: string
  description: string
  amount: number
  category: string
  paymentMethod: string
  date: string
  cashRegisterId: string | null
  recipient: string | null
  receiptNumber: string | null
  notes: string | null
  createdAt: string
  cashRegister: { id: string; status: string; openedAt: string } | null
}

interface ExpenseSummary {
  totalAmount: number
  count: number
  byCategory: Record<string, number>
  byPaymentMethod: Record<string, number>
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'ALQUILER', 'SERVICIOS', 'SALARIOS', 'TRANSPORTE',
  'MARKETING', 'MANTENIMIENTO', 'IMPUESTOS', 'OTRO',
]

const EXPENSE_PAYMENT_METHODS: ExpensePaymentMethod[] = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA']

const PAYMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  EFECTIVO: Banknote,
  TARJETA: ArrowRightLeft,
  TRANSFERENCIA: Building2,
}

interface ExpenseFormData {
  description: string
  amount: string
  category: ExpenseCategory
  paymentMethod: ExpensePaymentMethod
  date: string
  recipient: string
  receiptNumber: string
  notes: string
}

const emptyForm: ExpenseFormData = {
  description: '',
  amount: '',
  category: 'OTRO',
  paymentMethod: 'EFECTIVO',
  date: new Date().toISOString().split('T')[0],
  recipient: '',
  receiptNumber: '',
  notes: '',
}

export function ExpensesView() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState<ExpenseFormData>(emptyForm)

  // Build query params
  const queryParams = new URLSearchParams()
  if (filterCategory !== 'all') queryParams.set('category', filterCategory)
  if (filterFrom) queryParams.set('from', filterFrom)
  if (filterTo) queryParams.set('to', filterTo)
  if (searchTerm) queryParams.set('search', searchTerm)

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', filterCategory, filterFrom, filterTo, searchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/expenses?${queryParams.toString()}`)
      if (!res.ok) throw new Error('Error al obtener gastos')
      return res.json() as Promise<{ expenses: ExpenseData[]; summary: ExpenseSummary }>
    },
  })

  const expenses = data?.expenses || []
  const summary = data?.summary || { totalAmount: 0, count: 0, byCategory: {}, byPaymentMethod: {} }

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (formData: ExpenseFormData) => {
      const payload = {
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: formData.category,
        paymentMethod: formData.paymentMethod,
        date: formData.date || undefined,
        recipient: formData.recipient || undefined,
        receiptNumber: formData.receiptNumber || undefined,
        notes: formData.notes || undefined,
      }

      if (editingId) {
        const res = await fetch(`/api/expenses/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Error al actualizar gasto')
        return res.json()
      } else {
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Error al crear gasto')
        return res.json()
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['cash-register'] })
      toast.success(editingId ? 'Gasto actualizado' : 'Gasto registrado')
      closeDialog()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar gasto')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['cash-register'] })
      toast.success('Gasto eliminado')
      setDeleteDialogOpen(false)
      setDeletingId(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const openNewDialog = () => {
    setEditingId(null)
    setForm({ ...emptyForm, date: new Date().toISOString().split('T')[0] })
    setDialogOpen(true)
  }

  const openEditDialog = (expense: ExpenseData) => {
    setEditingId(expense.id)
    setForm({
      description: expense.description,
      amount: String(expense.amount),
      category: expense.category as ExpenseCategory,
      paymentMethod: expense.paymentMethod as ExpensePaymentMethod,
      date: new Date(expense.date).toISOString().split('T')[0],
      recipient: expense.recipient || '',
      receiptNumber: expense.receiptNumber || '',
      notes: expense.notes || '',
    })
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  const handleSave = () => {
    if (!form.description.trim()) {
      toast.error('La descripción es requerida')
      return
    }
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('El monto debe ser un número positivo')
      return
    }
    saveMutation.mutate(form)
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Gastos</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(summary.totalAmount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Cantidad</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{summary.count}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Banknote className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">En Efectivo</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(summary.byPaymentMethod['EFECTIVO'] || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Digital</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency((summary.byPaymentMethod['TARJETA'] || 0) + (summary.byPaymentMethod['TRANSFERENCIA'] || 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar por descripción, destinatario..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              {/* Category Filter */}
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full sm:w-[160px] h-9">
                  <Filter className="w-3.5 h-3.5 mr-1.5" />
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {EXPENSE_CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date filters */}
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="h-9 w-full sm:w-[140px]"
                  placeholder="Desde"
                />
                <Input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="h-9 w-full sm:w-[140px]"
                  placeholder="Hasta"
                />
              </div>
            </div>

            <Button
              onClick={openNewDialog}
              className="bg-slate-800 hover:bg-slate-700 text-white gap-1.5 shrink-0 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Nuevo Gasto
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Cargando gastos...</p>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Receipt className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">No hay gastos registrados</p>
              <p className="text-xs mt-1">Hacé clic en &quot;Nuevo Gasto&quot; para registrar uno</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-[120px]">Categoría</TableHead>
                    <TableHead className="w-[110px]">Pago</TableHead>
                    <TableHead className="w-[100px]">Destinatario</TableHead>
                    <TableHead className="w-[120px] text-right">Monto</TableHead>
                    <TableHead className="w-[80px] text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => {
                    const catKey = expense.category as ExpenseCategory
                    const PayIcon = PAYMENT_ICONS[expense.paymentMethod] || Banknote
                    return (
                      <TableRow key={expense.id} className="group">
                        <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {formatDateOnly(expense.date)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {expense.description}
                            </p>
                            {expense.receiptNumber && (
                              <p className="text-[10px] text-slate-500">
                                Recibo: {expense.receiptNumber}
                              </p>
                            )}
                            {expense.notes && (
                              <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                                {expense.notes}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] font-medium ${EXPENSE_CATEGORY_COLORS[catKey] || EXPENSE_CATEGORY_COLORS.OTRO}`}
                          >
                            {EXPENSE_CATEGORY_LABELS[catKey] || catKey}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <PayIcon className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs text-slate-600 dark:text-slate-400">
                              {EXPENSE_PAYMENT_LABELS[expense.paymentMethod as ExpensePaymentMethod] || expense.paymentMethod}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                          {expense.recipient || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(expense.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(expense)}
                            >
                              <Pencil className="w-3.5 h-3.5 text-slate-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setDeletingId(expense.id)
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            </Button>
                          </div>
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

      {/* Category Breakdown */}
      {summary.count > 0 && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Desglose por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {EXPENSE_CATEGORIES
                .filter((cat) => (summary.byCategory[cat] || 0) > 0)
                .sort((a, b) => (summary.byCategory[b] || 0) - (summary.byCategory[a] || 0))
                .map((cat) => (
                  <div
                    key={cat}
                    className={`rounded-lg p-3 ${EXPENSE_CATEGORY_COLORS[cat]}`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                      {EXPENSE_CATEGORY_LABELS[cat]}
                    </p>
                    <p className="text-sm font-bold mt-0.5">
                      {formatCurrency(summary.byCategory[cat] || 0)}
                    </p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              {editingId ? 'Editar Gasto' : 'Nuevo Gasto'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="exp-desc">Descripción *</Label>
              <Input
                id="exp-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ej: Pago de alquiler mensual"
              />
            </div>

            {/* Amount + Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="exp-amount">Monto *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                  <Input
                    id="exp-amount"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as ExpenseCategory })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {EXPENSE_CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Payment Method + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Método de Pago</Label>
                <Select
                  value={form.paymentMethod}
                  onValueChange={(v) => setForm({ ...form, paymentMethod: v as ExpensePaymentMethod })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {EXPENSE_PAYMENT_LABELS[method]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-date">Fecha</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
            </div>

            {/* Recipient + Receipt */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="exp-recipient">Destinatario</Label>
                <Input
                  id="exp-recipient"
                  value={form.recipient}
                  onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                  placeholder="Ej: Propietario del local"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-receipt">N° Recibo</Label>
                <Input
                  id="exp-receipt"
                  value={form.receiptNumber}
                  onChange={(e) => setForm({ ...form, receiptNumber: e.target.value })}
                  placeholder="Ej: REC-001"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="exp-notes">Notas</Label>
              <Input
                id="exp-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Observaciones adicionales..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="bg-slate-800 hover:bg-slate-700 text-white gap-1.5"
            >
              {saveMutation.isPending ? 'Guardando...' : editingId ? 'Actualizar' : 'Registrar Gasto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>¿Eliminar gasto?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción no se puede deshacer. Si el gasto fue pagado en efectivo con caja abierta,
            se revertirá el movimiento de caja.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
