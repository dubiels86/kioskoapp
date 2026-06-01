'use client'

import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Banknote } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/format'
import { BillBreakdownInput, breakdownToJSON, calculateBreakdownTotal } from '@/components/cash/bill-breakdown-input'
import type { BillBreakdown } from '@/components/cash/bill-breakdown-input'

interface CashOpenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CashOpenDialog({ open, onOpenChange }: CashOpenDialogProps) {
  const [openingAmount, setOpeningAmount] = useState('')
  const [billBreakdown, setBillBreakdown] = useState<BillBreakdown>({})
  const [useBreakdown, setUseBreakdown] = useState(true)
  const queryClient = useQueryClient()
  const { setCurrentCashRegisterId } = useAppStore()

  const breakdownTotal = useMemo(() => calculateBreakdownTotal(billBreakdown), [billBreakdown])

  // The effective opening amount comes from the breakdown if enabled, otherwise from manual input
  const effectiveAmount = useBreakdown ? breakdownTotal : (parseFloat(openingAmount) || 0)

  const mutation = useMutation({
    mutationFn: async (data: { openingAmount: number; billBreakdown: string | null }) => {
      const res = await fetch('/api/cash-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const resp = await res.json()
      if (!res.ok) throw new Error(resp.error || 'Error al abrir caja')
      return resp
    },
    onSuccess: (data) => {
      setCurrentCashRegisterId(data.id)
      queryClient.invalidateQueries({ queryKey: ['cash-register'] })
      toast.success('Caja abierta correctamente')
      setOpeningAmount('')
      setBillBreakdown({})
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (effectiveAmount < 0) {
      toast.error('Ingrese un monto válido')
      return
    }
    mutation.mutate({
      openingAmount: effectiveAmount,
      billBreakdown: useBreakdown ? breakdownToJSON(billBreakdown) : null,
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setOpeningAmount('')
      setBillBreakdown({})
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" />
            Abrir Caja
          </DialogTitle>
          <DialogDescription>
            Cuente el efectivo por denominación para abrir la caja registradora.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Toggle between breakdown and manual input */}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={useBreakdown ? 'default' : 'outline'}
                onClick={() => setUseBreakdown(true)}
              >
                Conteo por Denominación
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!useBreakdown ? 'default' : 'outline'}
                onClick={() => setUseBreakdown(false)}
              >
                Ingreso Manual
              </Button>
            </div>

            {useBreakdown ? (
              <BillBreakdownInput
                value={billBreakdown}
                onChange={setBillBreakdown}
                label="Conteo de Apertura"
              />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="openingAmount">Monto de Apertura</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="openingAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={openingAmount}
                    onChange={(e) => setOpeningAmount(e.target.value)}
                    className="pl-7 text-lg font-semibold"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Show the total that will be used */}
            {effectiveAmount > 0 && (
              <div className="rounded-lg bg-muted border px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Monto de Apertura
                  </span>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(effectiveAmount)}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || effectiveAmount <= 0}
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              {mutation.isPending ? 'Abriendo...' : 'Abrir Caja'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
