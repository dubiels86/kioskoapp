'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { useUsdExchangeRate, useCurrencies } from '@/lib/currency'
import { toast } from 'sonner'

interface ExchangeRateUpdateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExchangeRateUpdateDialog({ open, onOpenChange }: ExchangeRateUpdateDialogProps) {
  const queryClient = useQueryClient()
  
  const { data: currentRate, isLoading } = useUsdExchangeRate()
  const { data: currencies, isLoading: currenciesLoading } = useCurrencies()
  const [newRate, setNewRate] = useState('')
  const [updating, setUpdating] = useState(false)

  const handleSubmit = async () => {
    if (!newRate || parseFloat(newRate) <= 0) {
      toast.error('Ingresa un tipo de cambio válido')
      return
    }

    setUpdating(true)
    try {
      // First, create exchange rate history record
      const rateRes = await fetch('/api/currencies/exchange-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromCurrency: 'USD',
          toCurrency: 'CUP',
          rate: parseFloat(newRate),
          source: 'manual'
        }),
      })

      if (!rateRes.ok) {
        const data = await rateRes.json()
        throw new Error(data.error || 'Error al actualizar tipo de cambio')
      }

      // Get USD currency ID from cached data
      let usdCurrency = currencies?.find((c: any) => c.code === 'USD')
      
      // Fallback: try to fetch if not in cache
      if (!usdCurrency) {
        const currenciesRes = await fetch('/api/currencies')
        if (!currenciesRes.ok) {
          throw new Error('Error al obtener lista de monedas. Asegúrate de que el servidor esté corriendo.')
        }
        const allCurrencies = await currenciesRes.json()
        usdCurrency = allCurrencies.find((c: any) => c.code === 'USD')
      }
      
      if (!usdCurrency) {
        throw new Error('Moneda USD no encontrada en la base de datos. Ejecuta el script de inicialización: npx tsx scripts/init-currencies.ts')
      }

      // Update USD currency exchange rate using its ID
      const updateRes = await fetch(`/api/currencies/${usdCurrency.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchangeRate: parseFloat(newRate)
        }),
      })

      if (!updateRes.ok) {
        const data = await updateRes.json()
        throw new Error(data.error || 'Error al actualizar moneda USD')
      }

      toast.success('Tipo de cambio actualizado correctamente')
      queryClient.invalidateQueries({ queryKey: ['usd-exchange-rate'] })
      queryClient.invalidateQueries({ queryKey: ['currencies'] })
      queryClient.invalidateQueries({ queryKey: ['active-currencies'] })
      setNewRate('')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar tipo de cambio')
    } finally {
      setUpdating(false)
    }
  }

  const handleCurrentRateUse = () => {
    if (currentRate) {
      setNewRate(currentRate.toString())
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">💵</span>
            Actualizar Tipo de Cambio USD/CUP
          </DialogTitle>
          <DialogDescription>
            Actualiza el precio del dólar respecto al CUP. Este cambio afectará los cálculos de conversión en recepciones futuras.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border bg-blue-50 dark:bg-blue-900/20 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Tipo de cambio actual</p>
                {isLoading ? (
                  <p className="text-2xl font-bold text-blue-800 dark:text-blue-200 mt-1">Cargando...</p>
                ) : (
                  <p className="text-2xl font-bold text-blue-800 dark:text-blue-200 mt-1">
                    1 USD = {currentRate?.toFixed(2)} CUP
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCurrentRateUse}
                disabled={isLoading || !currentRate}
              >
                Usar actual
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="newRate">Nuevo tipo de cambio</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold">
                  1 USD =
                </span>
                <Input
                  id="newRate"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  placeholder="240.00"
                  className="pl-24 text-lg py-6"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg font-bold">
                  CUP
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Ingresa el nuevo valor de cambio del dólar respecto al peso cubano
              </p>
            </div>

            <div className="rounded-lg border bg-amber-50 dark:bg-amber-900/20 p-3">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">
                Impacto del cambio
              </p>
              <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-1">
                <li className="flex items-start gap-1">
                  <span className="mt-0.5">•</span>
                  <span>Nuevas recepciones usarán este tipo de cambio</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="mt-0.5">•</span>
                  <span>Los productos recibidos con CUP se convertirán usando esta tasa</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="mt-0.5">•</span>
                  <span>El historial de cambios se guardará para referencia futura</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setNewRate('')
              onOpenChange(false)
            }}
            disabled={updating}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updating || !newRate}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {updating ? 'Actualizando...' : 'Actualizar Tipo de Cambio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}