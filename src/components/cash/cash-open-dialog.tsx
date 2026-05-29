'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Banknote } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/format'

interface CashOpenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CashOpenDialog({ open, onOpenChange }: CashOpenDialogProps) {
  const [openingAmount, setOpeningAmount] = useState('')
  const queryClient = useQueryClient()
  const { setCurrentCashRegisterId } = useAppStore()

  const mutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch('/api/cash-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingAmount: amount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al abrir caja')
      return data
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(openingAmount)
    if (isNaN(amount) || amount < 0) {
      toast.error('Ingrese un monto válido')
      return
    }
    mutation.mutate(amount)
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
            Ingrese el monto de apertura para iniciar la caja registradora.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
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
              {openingAmount && !isNaN(parseFloat(openingAmount)) && (
                <p className="text-sm text-muted-foreground">
                  Monto: {formatCurrency(parseFloat(openingAmount))}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending || !openingAmount} className="bg-emerald-600 hover:bg-emerald-700">
              {mutation.isPending ? 'Abriendo...' : 'Abrir Caja'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
