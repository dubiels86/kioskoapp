'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  KeyRound,
  Upload,
  Loader2,
  RefreshCw,
  Power,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { toast } from 'sonner'

type Status =
  | 'loading'
  | 'unlicensed'
  | 'active'
  | 'grace'
  | 'expired'
  | 'revoked'
  | 'grace_expired'
  | 'invalid'
  | 'inactive'

interface LicenseInfo {
  licenseId: string
  customer: string
  plan: string
  issuedAt: string
  expiresAt: string
  maxDevices: number
  features: string[]
}

interface StatusResponse {
  status: Status
  reason?: string
  license: LicenseInfo | null
  fingerprint: string | null
  lastHeartbeat: string | null
  graceUntil: string | null
}

const STATUS_META: Record<
  Status,
  { icon: typeof ShieldCheck; title: string; desc: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' }
> = {
  loading: { icon: Loader2, title: 'Verificando licencia...', desc: '', tone: 'neutral' },
  unlicensed: {
    icon: KeyRound,
    title: 'Activación de Licencia Requerida',
    desc: 'Esta instalación no tiene una licencia activa. Pegá el contenido de tu archivo de licencia (.lic) para activarla.',
    tone: 'warn',
  },
  active: {
    icon: ShieldCheck,
    title: 'Licencia Activa',
    desc: 'Tu licencia está activa y verificada.',
    tone: 'ok',
  },
  grace: {
    icon: ShieldAlert,
    title: 'Período de Gracia',
    desc: 'No se pudo contactar al servidor de licencias. La app sigue funcionando en período de gracia.',
    tone: 'warn',
  },
  expired: {
    icon: ShieldX,
    title: 'Licencia Expirada',
    desc: 'Tu licencia ha expirado. Activá una nueva licencia para continuar.',
    tone: 'bad',
  },
  revoked: {
    icon: ShieldX,
    title: 'Licencia Revocada',
    desc: 'Tu licencia fue revocada por el administrador. Contactá a soporte.',
    tone: 'bad',
  },
  grace_expired: {
    icon: ShieldX,
    title: 'Período de Gracia Vencido',
    desc: 'Se agotó el período de gracia sin conexión al servidor de licencias. Activá una licencia válida para continuar.',
    tone: 'bad',
  },
  invalid: {
    icon: ShieldAlert,
    title: 'Licencia Inválida',
    desc: 'La licencia almacenada no es válida (firma o datos corruptos). Activá una licencia válida.',
    tone: 'bad',
  },
  inactive: {
    icon: ShieldX,
    title: 'Licencia Inactiva',
    desc: 'La licencia ya no está registrada en el servidor. Activá una licencia válida.',
    tone: 'bad',
  },
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function shortFp(fp: string | null): string {
  if (!fp) return '—'
  return fp.slice(0, 8) + '…' + fp.slice(-6)
}

export function LicenseGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [info, setInfo] = useState<StatusResponse | null>(null)
  const [licenseContent, setLicenseContent] = useState('')
  const [activating, setActivating] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [ensuringCookie, setEnsuringCookie] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshStatus = useCallback(async (): Promise<Status> => {
    try {
      const res = await fetch('/api/license/status', { credentials: 'same-origin' })
      const data = (await res.json().catch(() => null)) as StatusResponse | null
      if (!data) {
        setStatus('loading')
        return 'loading'
      }
      setStatus(data.status)
      setInfo(data)
      return data.status
    } catch {
      setStatus('loading')
      return 'loading'
    }
  }, [])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  // When the license is active/grace, ensure the gate cookie is present in the
  // browser before rendering the children. A fresh browser session has no
  // cookie even if the DB license is active, which would cause the middleware
  // to block all /api/* calls. Calling heartbeat once sets the cookie.
  useEffect(() => {
    if (status !== 'active' && status !== 'grace') return
    let cancelled = false
    setEnsuringCookie(true)
    ;(async () => {
      try {
        const res = await fetch('/api/license/heartbeat', {
          method: 'POST',
          credentials: 'same-origin',
        })
        const data = (await res.json().catch(() => null)) as { status?: string } | null
        if (cancelled) return
        if (data?.status && data.status !== 'active' && data.status !== 'grace') {
          // License was lost during the check → re-evaluate
          await refreshStatus()
        }
      } catch {
        // network error → ignore; grace period + existing cookie (if any) cover this
      } finally {
        if (!cancelled) setEnsuringCookie(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status, refreshStatus])

  // Periodic heartbeat loop — only when the license is active or in grace.
  // (The immediate first heartbeat is handled by the ensureCookie effect above.)
  useEffect(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
    }
    if (status === 'active' || status === 'grace') {
      const beat = async () => {
        try {
          const res = await fetch('/api/license/heartbeat', {
            method: 'POST',
            credentials: 'same-origin',
          })
          const data = (await res.json().catch(() => null)) as { status?: string } | null
          if (data?.status && data.status !== 'active' && data.status !== 'grace') {
            const newStatus = await refreshStatus()
            if (newStatus !== 'active' && newStatus !== 'grace') {
              toast.error('Tu licencia ya no está activa.', {
                description: 'La sesión fue bloqueada.',
              })
            }
          }
        } catch {
          // network error → ignore, the grace period covers this
        }
      }
      heartbeatTimerRef.current = setInterval(beat, 10 * 60 * 1000)
      return () => {
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current)
      }
    }
    return
  }, [status, refreshStatus])

  const handleActivate = async () => {
    const content = licenseContent.trim()
    if (!content) {
      toast.error('Pegá el contenido del archivo de licencia.')
      return
    }
    setActivating(true)
    try {
      const res = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ licenseContent: content }),
      })
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        status?: string
        message?: string
      } | null
      if (data?.ok) {
        toast.success('Licencia activada correctamente.', {
          description: data.message,
        })
        setLicenseContent('')
        await refreshStatus()
      } else {
        toast.error('No se pudo activar la licencia', {
          description: data?.message || 'Error desconocido.',
        })
      }
    } catch {
      toast.error('Error de conexión al activar la licencia.')
    } finally {
      setActivating(false)
    }
  }

  const handleDeactivate = async () => {
    if (!confirm('¿Desactivar la licencia actual? Esta instalación quedará bloqueada.')) return
    setDeactivating(true)
    try {
      const res = await fetch('/api/license/deactivate', {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null
      if (data?.ok) {
        toast.success('Licencia desactivada.')
        await refreshStatus()
      } else {
        toast.error('No se pudo desactivar.', { description: data?.message })
      }
    } catch {
      toast.error('Error de conexión al desactivar.')
    } finally {
      setDeactivating(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setLicenseContent(text)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ----- Render -----
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          <p className="text-sm text-slate-400">Verificando licencia...</p>
        </div>
      </div>
    )
  }

  if (status === 'active' || status === 'grace') {
    // Ensure the gate cookie is set before rendering the app (a fresh browser
    // session has no cookie even if the DB license is active).
    if (ensuringCookie) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            <p className="text-sm text-slate-400">Activando sesión de licencia...</p>
          </div>
        </div>
      )
    }
    // Licensed — render the normal app
    return <>{children}</>
  }

  // Locked — show the activation / lock screen
  const meta = STATUS_META[status]
  const Icon = meta.icon
  const toneClasses: Record<string, string> = {
    ok: 'text-emerald-400',
    warn: 'text-amber-400',
    bad: 'text-red-400',
    neutral: 'text-slate-400',
  }
  const needsActivation =
    status === 'unlicensed' ||
    status === 'expired' ||
    status === 'revoked' ||
    status === 'grace_expired' ||
    status === 'invalid' ||
    status === 'inactive'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <Card className="w-full max-w-lg relative shadow-2xl border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex items-center justify-center w-16 h-16 bg-slate-800 rounded-2xl border border-slate-700/50 shadow-lg">
            <Icon className={`w-8 h-8 ${toneClasses[meta.tone]}`} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">{meta.title}</h1>
          <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">{meta.desc}</p>
        </CardHeader>

        <CardContent className="pt-4 space-y-5">
          {/* Current fingerprint */}
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Fingerprint de este equipo</span>
              <code className="text-slate-300 font-mono">{shortFp(info?.fingerprint ?? null)}</code>
            </div>
          </div>

          {/* Existing license info (if any) */}
          {info?.license && (
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg px-4 py-3 space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Cliente</span>
                <span className="text-slate-200 font-medium">{info.license.customer}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Plan</span>
                <span className="text-slate-200 font-medium uppercase">{info.license.plan}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Vence</span>
                <span className="text-slate-200 font-medium">{fmtDate(info.license.expiresAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Dispositivos máx.</span>
                <span className="text-slate-200 font-medium">{info.license.maxDevices}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">ID de licencia</span>
                <code className="text-slate-300 font-mono text-xs">
                  {info.license.licenseId.slice(0, 8)}…
                </code>
              </div>
            </div>
          )}

          {/* Grace period info */}
          {status === 'grace' && info?.graceUntil && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-amber-300">
              <Clock className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                Período de gracia hasta <strong>{fmtDate(info.graceUntil)}</strong>. La app seguirá
                funcionando sin conexión, pero conviene restablecerla pronto.
              </div>
            </div>
          )}

          {/* Activation form */}
          {needsActivation && (
            <div className="space-y-3">
              <Label htmlFor="license-content" className="text-slate-300 text-sm font-medium">
                Contenido del archivo de licencia (.lic)
              </Label>
              <textarea
                id="license-content"
                value={licenseContent}
                onChange={(e) => setLicenseContent(e.target.value)}
                disabled={activating}
                placeholder='Pegá aquí el JSON de la licencia, o usá "Subir archivo"...'
                rows={5}
                className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20 px-3 py-2 text-xs font-mono resize-y"
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={activating}
                  variant="outline"
                  className="bg-slate-800/50 border-slate-700/50 text-slate-200 hover:bg-slate-700/50 hover:text-white"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Subir archivo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".lic,.json,application/json,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  onClick={handleActivate}
                  disabled={activating || !licenseContent.trim()}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  {activating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Activando...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4 mr-2" />
                      Activar licencia
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button
              type="button"
              onClick={refreshStatus}
              variant="ghost"
              className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reintentar
            </Button>
            {info?.license && (
              <Button
                type="button"
                onClick={handleDeactivate}
                disabled={deactivating}
                variant="ghost"
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                {deactivating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Power className="w-4 h-4 mr-2" />
                )}
                Desactivar licencia
              </Button>
            )}
          </div>

          {/* Help footer */}
          <div className="flex items-start gap-2 bg-slate-800/30 border border-slate-700/30 rounded-lg px-4 py-3 text-xs text-slate-400">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400/70" />
            <div>
              Si no tenés un archivo de licencia, contactá al proveedor de KioskoApp. Cada licencia
              está firmada digitalmente y vinculada a un número máximo de instalaciones.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
