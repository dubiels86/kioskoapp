'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { CashMovementType } from '@/lib/types'

interface CashMovementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cashRegisterId: string
}

export function CashMovementDialog({ open, onOpenChange, cashRegisterId }: CashMovementDialogProps) {
  const [type, setType] = useState<CashMovementType>('ENTRADA')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (data: { cashRegisterId: string; type: CashMovementType; amount: number; reason: string }) => {
      const res = await fetch('/api/cash-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al registrar movimiento')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-register'] })
      toast.success('Movimiento registrado correctamente')
      setAmount('')
      setReason('')
      setType('ENTRADA')
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Ingrese un monto válido mayor a 0')
      return
    }
    if (!reason.trim()) {
      toast.error('Ingrese un motivo')
      return
    }
    mutation.mutate({ cashRegisterId, type, amount: numAmount, reason: reason.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'ENTRADA' ? (
              <ArrowUpCircle className="w-5 h-5 text-emerald-600" />
            ) : (
              <ArrowDownCircle className="w-5 h-5 text-red-500" />
            )}
            Registrar Movimiento
          </DialogTitle>
          <DialogDescription>
            Registre una entrada o salida de efectivo en la caja.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Movimiento</Label>
              <Select value={type} onValueChange={(v) => setType(v as CashMovementType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRADA">
                    <span className="flex items-center gap-2">
                      <ArrowUpCircle className="w-4 h-4 text-emerald-600" />
                      Entrada
                    </span>
                  </SelectItem>
                  <SelectItem value="SALIDA">
                    <span className="flex items-center gap-2">
                      <ArrowDownCircle className="w-4 h-4 text-red-500" />
                      Salida
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="movementAmount">Monto</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  id="movementAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="movementReason">Razón</Label>
              <Input
                id="movementReason"
                placeholder="Ej: Pago de proveedor, Retiro personal..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !amount || !reason}
              className={type === 'ENTRADA' ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm' : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-sm'}
            >
              {mutation.isPending ? 'Registrando...' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
