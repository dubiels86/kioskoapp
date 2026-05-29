'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/format'
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
  const queryClient = useQueryClient()

  const openRegisterMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch('/api/cash-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingAmount: amount }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al abrir caja')
      }
      return res.json()
    },
    onSuccess: (data) => {
      setCurrentCashRegisterId(data.id)
      queryClient.invalidateQueries({ queryKey: ['cash-register'] })
      toast.success('Caja abierta correctamente')
      setOpeningAmount('')
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = () => {
    const amount = parseFloat(openingAmount)
    if (isNaN(amount) || amount < 0) {
      toast.error('Ingresá un monto válido')
      return
    }
    openRegisterMutation.mutate(amount)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-600" />
            Abrir Caja
          </DialogTitle>
          <DialogDescription>
            Ingresá el monto inicial con el que abrís la caja.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
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
          {openingAmount && !isNaN(parseFloat(openingAmount)) && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-2">
              {formatCurrency(parseFloat(openingAmount))}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="mr-2"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={openRegisterMutation.isPending || !openingAmount}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
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
