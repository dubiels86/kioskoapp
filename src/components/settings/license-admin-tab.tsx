'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ShieldCheck,
  ShieldX,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Ban,
  RotateCcw,
  Power,
  Loader2,
  KeyRound,
  Smartphone,
} from 'lucide-react'
import { toast } from 'sonner'

interface AdminActivation {
  activationId: string
  licenseId: string
  fingerprint: string
  hostname: string
  activatedAt: string
  lastHeartbeat: string
  active: boolean
}

interface AdminLicense {
  licenseId: string
  customer: string
  plan: string
  issuedAt: string
  expiresAt: string
  maxDevices: number
  features: string[]
  revoked: boolean
  createdAt: string
  activations: AdminActivation[]
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CU', { dateStyle: 'short', timeStyle: 'short' })
}

function shortId(s: string): string {
  if (!s) return '—'
  return s.length > 12 ? s.slice(0, 8) + '…' + s.slice(-4) : s
}

export function LicenseAdminTab() {
  const queryClient = useQueryClient()
  const [customer, setCustomer] = useState('')
  const [plan, setPlan] = useState('pro')
  const [expiresAt, setExpiresAt] = useState('')
  const [maxDevices, setMaxDevices] = useState(1)
  const [features, setFeatures] = useState('pos,inventory,repairs,multiwarehouse')
  const [issuedContent, setIssuedContent] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-licenses'],
    queryFn: async () => {
      const res = await fetch('/api/license-admin/licenses', { credentials: 'same-origin' })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; licenses?: AdminLicense[] } | null
      return json?.licenses ?? []
    },
  })

  const issueMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/license-admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          customer: customer.trim(),
          plan,
          expiresAt: new Date(expiresAt).toISOString(),
          maxDevices: Number(maxDevices),
          features: features
            .split(',')
            .map((f) => f.trim())
            .filter(Boolean),
        }),
      })
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean
        licenseFileContent?: string
        error?: string
      } | null
      if (!json?.ok) throw new Error(json?.error || 'Error al emitir')
      return json
    },
    onSuccess: (data) => {
      toast.success('Licencia emitida correctamente.')
      setIssuedContent(data.licenseFileContent ?? null)
      setCustomer('')
      setExpiresAt('')
      setMaxDevices(1)
      queryClient.invalidateQueries({ queryKey: ['admin-licenses'] })
    },
    onError: (err: Error) => {
      toast.error('No se pudo emitir la licencia', { description: err.message })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: async (licenseId: string) => {
      const res = await fetch('/api/license-admin/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ licenseId }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!json?.ok) throw new Error(json?.error || 'Error')
      return json
    },
    onSuccess: () => {
      toast.success('Licencia revocada.')
      queryClient.invalidateQueries({ queryKey: ['admin-licenses'] })
    },
    onError: (err: Error) => toast.error('Error al revocar', { description: err.message }),
  })

  const unrevokeMutation = useMutation({
    mutationFn: async (licenseId: string) => {
      const res = await fetch('/api/license-admin/unrevoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ licenseId }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!json?.ok) throw new Error(json?.error || 'Error')
      return json
    },
    onSuccess: () => {
      toast.success('Licencia reactivada.')
      queryClient.invalidateQueries({ queryKey: ['admin-licenses'] })
    },
    onError: (err: Error) => toast.error('Error al reactivar', { description: err.message }),
  })

  const deactivateMutation = useMutation({
    mutationFn: async ({ licenseId, fingerprint }: { licenseId: string; fingerprint: string }) => {
      const res = await fetch('/api/license-admin/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ licenseId, fingerprint }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!json?.ok) throw new Error(json?.error || 'Error')
      return json
    },
    onSuccess: () => {
      toast.success('Dispositivo desactivado.')
      queryClient.invalidateQueries({ queryKey: ['admin-licenses'] })
    },
    onError: (err: Error) => toast.error('Error al desactivar', { description: err.message }),
  })

  const handleCopy = async () => {
    if (!issuedContent) return
    try {
      await navigator.clipboard.writeText(issuedContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Licencia copiada al portapapeles.')
    } catch {
      toast.error('No se pudo copiar. Copiala manualmente.')
    }
  }

  const handleIssue = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customer.trim()) {
      toast.error('Ingresá el nombre del cliente.')
      return
    }
    if (!expiresAt) {
      toast.error('Ingresá la fecha de vencimiento.')
      return
    }
    const exp = new Date(expiresAt)
    if (isNaN(exp.getTime()) || exp.getTime() < Date.now()) {
      toast.error('La fecha de vencimiento debe ser futura.')
      return
    }
    issueMutation.mutate()
  }

  const licenses = data ?? []

  return (
    <div className="space-y-6">
      {/* Issue new license */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-emerald-600" />
            Emitir nueva licencia
          </CardTitle>
          <CardDescription>
            Generá una licencia firmada para un cliente. El contenido JSON debe enviarse al cliente
            como archivo <code className="text-xs">.lic</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleIssue} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="lic-customer">Cliente</Label>
              <Input
                id="lic-customer"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Nombre del comercio / cliente"
                disabled={issueMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lic-plan">Plan</Label>
              <Select value={plan} onValueChange={setPlan} disabled={issueMutation.isPending}>
                <SelectTrigger id="lic-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lic-max">Dispositivos máx.</Label>
              <Input
                id="lic-max"
                type="number"
                min={1}
                value={maxDevices}
                onChange={(e) => setMaxDevices(Number(e.target.value))}
                disabled={issueMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lic-expires">Vencimiento</Label>
              <Input
                id="lic-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                disabled={issueMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lic-features">Funcionalidades (coma-separadas)</Label>
              <Input
                id="lic-features"
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                placeholder="pos,inventory,repairs"
                disabled={issueMutation.isPending}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={issueMutation.isPending} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                {issueMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Emitiendo...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Emitir licencia
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Issued license content */}
          {issuedContent && (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-emerald-700 dark:text-emerald-400">
                  Licencia emitida — copiá este contenido y enviaselo al cliente:
                </Label>
                <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
              <Textarea
                readOnly
                value={issuedContent}
                rows={10}
                className="font-mono text-xs"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Licenses list */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-slate-600" />
              Licencias emitidas ({licenses.length})
            </CardTitle>
            <CardDescription>
              Todas las licencias y sus dispositivos activos registrados en el servidor.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : licenses.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-500">
              No hay licencias emitidas todavía.
            </div>
          ) : (
            <div className="space-y-4">
              {licenses.map((lic) => {
                const activeCount = lic.activations.filter((a) => a.active).length
                const isExpired = new Date(lic.expiresAt).getTime() < Date.now()
                return (
                  <div
                    key={lic.licenseId}
                    className="border rounded-lg p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/30"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {lic.customer}
                          </span>
                          <Badge variant="outline" className="uppercase">{lic.plan}</Badge>
                          {lic.revoked ? (
                            <Badge variant="destructive">
                              <ShieldX className="w-3 h-3 mr-1" />
                              Revocada
                            </Badge>
                          ) : isExpired ? (
                            <Badge variant="secondary">Expirada</Badge>
                          ) : (
                            <Badge variant="default" className="bg-emerald-600">
                              <ShieldCheck className="w-3 h-3 mr-1" />
                              Activa
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 space-y-0.5">
                          <div>ID: <code className="font-mono">{shortId(lic.licenseId)}</code></div>
                          <div>
                            Emitida: {fmt(lic.issuedAt)} · Vence: {fmt(lic.expiresAt)}
                          </div>
                          <div>
                            Dispositivos: {activeCount}/{lic.maxDevices} activos
                          </div>
                          {lic.features.length > 0 && (
                            <div>Funcionalidades: {lic.features.join(', ')}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {lic.revoked ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => unrevokeMutation.mutate(lic.licenseId)}
                            disabled={unrevokeMutation.isPending}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Reactivar
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              if (confirm(`¿Revocar la licencia de "${lic.customer}"? Todas las instalaciones se bloquearán.`)) {
                                revokeMutation.mutate(lic.licenseId)
                              }
                            }}
                            disabled={revokeMutation.isPending}
                          >
                            <Ban className="w-3.5 h-3.5 mr-1" />
                            Revocar
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Activations */}
                    {lic.activations.length > 0 && (
                      <div className="border-t pt-3">
                        <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5" />
                          Dispositivos activados
                        </div>
                        <div className="space-y-2">
                          {lic.activations.map((act) => (
                            <div
                              key={act.activationId}
                              className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-950 border rounded px-3 py-2 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div>
                                  <span className="text-slate-500">Host:</span>{' '}
                                  <span className="font-medium text-slate-800 dark:text-slate-100">
                                    {act.hostname || '—'}
                                  </span>
                                  {' · '}
                                  <span className="text-slate-500">FP:</span>{' '}
                                  <code className="font-mono">{shortId(act.fingerprint)}</code>
                                </div>
                                <div className="text-slate-400">
                                  Activado: {fmt(act.activatedAt)} · Últ. heartbeat: {fmt(act.lastHeartbeat)}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {act.active ? (
                                  <Badge variant="default" className="bg-emerald-100 text-emerald-700">
                                    Activo
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">Inactivo</Badge>
                                )}
                                {act.active && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() =>
                                      deactivateMutation.mutate({
                                        licenseId: lic.licenseId,
                                        fingerprint: act.fingerprint,
                                      })
                                    }
                                    disabled={deactivateMutation.isPending}
                                  >
                                    <Power className="w-3 h-3 mr-1" />
                                    Liberar
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
