'use client'

import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/format'
import { BillBreakdownInput, breakdownToJSON, calculateBreakdownTotal } from '@/components/cash/bill-breakdown-input'
import type { BillBreakdown } from '@/components/cash/bill-breakdown-input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Banknote } from 'lucide-react'
import { toast } from 'sonner'

interface CashOpenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CashOpenDialog({ open, onOpenChange }: CashOpenDialogProps) {
  const { setCurrentCashRegisterId } = useAppStore()
  const [openingAmount, setOpeningAmount] = useState<string>('')
  const [billBreakdown, setBillBreakdown] = useState<BillBreakdown>({})
  const [useBreakdown, setUseBreakdown] = useState(true)
  const queryClient = useQueryClient()

  const breakdownTotal = useMemo(() => calculateBreakdownTotal(billBreakdown), [billBreakdown])
  const effectiveAmount = useBreakdown ? breakdownTotal : (parseFloat(openingAmount) || 0)

  const openRegisterMutation = useMutation({
    mutationFn: async (data: { openingAmount: number; billBreakdown: string | null }) => {
      const res = await fetch('/api/cash-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const resp = await res.json()
        throw new Error(resp.error || 'Error al abrir caja')
      }
      return res.json()
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

  const handleSubmit = () => {
    if (effectiveAmount < 0) {
      toast.error('Ingresá un monto válido')
      return
    }
    openRegisterMutation.mutate({
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
            <Banknote className="w-5 h-5 text-emerald-600" />
            Abrir Caja
          </DialogTitle>
          <DialogDescription>
            Cuente el efectivo por denominación para abrir la caja registradora.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Toggle between breakdown and manual input */}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={useBreakdown ? 'default' : 'outline'}
              onClick={() => setUseBreakdown(true)}
              className={useBreakdown ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm' : ''}
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
              <Label htmlFor="openingAmount" className="text-sm font-medium">
                Monto de apertura
              </Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  $
                </span>
                <Input
                  id="openingAmount"
                  type="number"
                  min={0}
                  step={0.01}
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-7 h-12 text-lg font-semibold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit()
                  }}
                />
              </div>
            </div>
          )}

          {/* Show the total that will be used */}
          {effectiveAmount > 0 && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  Monto de Apertura
                </span>
                <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(effectiveAmount)}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="mr-2"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={openRegisterMutation.isPending || effectiveAmount <= 0}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm text-white"
          >
            {openRegisterMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Abriendo...
              </span>
            ) : (
              'Abrir Caja'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
