'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Database,
  Download,
  Upload,
  Trash2,
  Save,
  HardDriveDownload,
  Clock,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Plus,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

interface Backup {
  filename: string
  size: number
  createdAt: string
  description: string | null
}

interface BackupSettings {
  autoBackupEnabled: boolean
  autoBackupFrequency: string
  autoBackupMaxKeep: number
}

interface BackupListResponse {
  backups: Backup[]
  settings: BackupSettings
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// Parse a backup filename like "backup-2026-06-28_19-30-45.db" into a readable label
function filenameToLabel(filename: string): string {
  const m = filename.match(/^backup-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.db$/)
  if (!m) return filename
  const [, y, mo, d, h, mi, s] = m
  return `${d}/${mo}/${y} ${h}:${mi}:${s}`
}

export function BackupsTab() {
  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery<BackupListResponse>({
    queryKey: ['backups'],
    queryFn: async () => {
      const res = await fetch('/api/backups')
      if (!res.ok) throw new Error('Error al obtener respaldos')
      return res.json()
    },
  })

  const [description, setDescription] = useState('')
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false)
  const [autoBackupFrequency, setAutoBackupFrequency] = useState('daily')
  const [autoBackupMaxKeep, setAutoBackupMaxKeep] = useState('7')
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Backup | null>(null)

  // Sync local settings from query
  const [prevEnabled, setPrevEnabled] = useState(false)
  const [prevFreq, setPrevFreq] = useState('daily')
  const [prevMax, setPrevMax] = useState('7')
  if (data?.settings) {
    if (data.settings.autoBackupEnabled !== prevEnabled) {
      setAutoBackupEnabled(data.settings.autoBackupEnabled)
      setPrevEnabled(data.settings.autoBackupEnabled)
    }
    if (data.settings.autoBackupFrequency !== prevFreq) {
      setAutoBackupFrequency(data.settings.autoBackupFrequency)
      setPrevFreq(data.settings.autoBackupFrequency)
    }
    if (String(data.settings.autoBackupMaxKeep) !== prevMax) {
      setAutoBackupMaxKeep(String(data.settings.autoBackupMaxKeep))
      setPrevMax(String(data.settings.autoBackupMaxKeep))
    }
  }

  const createBackupMutation = useMutation({
    mutationFn: async (desc: string) => {
      const res = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc || null }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error al crear respaldo' }))
        throw new Error(err.error || 'Error al crear respaldo')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      toast.success('Respaldo creado correctamente')
      setDescription('')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: BackupSettings) => {
      const res = await fetch('/api/backups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error al guardar configuración' }))
        throw new Error(err.error || 'Error al guardar configuración')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      toast.success('Configuración de respaldo guardada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const restoreMutation = useMutation({
    mutationFn: async (filename: string) => {
      const res = await fetch(`/api/backups/${encodeURIComponent(filename)}`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error al restaurar' }))
        throw new Error(err.error || 'Error al restaurar respaldo')
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Respaldo restaurado. Recargando la página...')
      setRestoreTarget(null)
      // Reload after a short delay so the toast is visible
      setTimeout(() => window.location.reload(), 1500)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (filename: string) => {
      const res = await fetch(`/api/backups/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error al eliminar' }))
        throw new Error(err.error || 'Error al eliminar respaldo')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      toast.success('Respaldo eliminado')
      setDeleteTarget(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/backups/cleanup', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error al limpiar' }))
        throw new Error(err.error || 'Error al limpiar respaldos')
      }
      return res.json()
    },
    onSuccess: (data: { deleted: number }) => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      if (data.deleted > 0) {
        toast.success(`Se eliminaron ${data.deleted} respaldo(s) antiguo(s)`)
      } else {
        toast.info('No hay respaldos antiguos para limpiar')
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSaveSettings = () => {
    const maxKeep = parseInt(autoBackupMaxKeep)
    if (isNaN(maxKeep) || maxKeep < 1 || maxKeep > 100) {
      toast.error('La cantidad máxima debe ser entre 1 y 100')
      return
    }
    saveSettingsMutation.mutate({
      autoBackupEnabled,
      autoBackupFrequency,
      autoBackupMaxKeep: maxKeep,
    })
  }

  const handleDownload = (filename: string) => {
    window.open(`/api/backups/${encodeURIComponent(filename)}?action=download`, '_blank')
    toast.success('Descargando respaldo...')
  }

  const backups = data?.backups ?? []

  return (
    <div className="space-y-4">
      {/* Create Backup Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <HardDriveDownload className="h-5 w-5" />
            Crear Respaldo
          </CardTitle>
          <CardDescription>
            Crea una copia de seguridad completa de la base de datos del sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backup-description">Descripción (opcional)</Label>
            <Input
              id="backup-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Respaldo antes de cambio de precios"
              maxLength={200}
              disabled={createBackupMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              La descripción te ayudará a identificar el respaldo luego
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => createBackupMutation.mutate(description)}
              disabled={createBackupMutation.isPending}
              className="gap-1.5"
            >
              {createBackupMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Crear Respaldo
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Backup Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Respaldo Automático
          </CardTitle>
          <CardDescription>
            Configura respaldos automáticos del sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="auto-backup" className="text-sm font-medium">
                Activar respaldo automático
              </Label>
              <p className="text-xs text-muted-foreground">
                Crea respaldos de forma periódica sin intervención manual
              </p>
            </div>
            <Switch
              id="auto-backup"
              checked={autoBackupEnabled}
              onCheckedChange={setAutoBackupEnabled}
            />
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity ${autoBackupEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
            <div className="space-y-2">
              <Label htmlFor="frequency">Frecuencia</Label>
              <Select value={autoBackupFrequency} onValueChange={setAutoBackupFrequency} disabled={!autoBackupEnabled}>
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diario</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-keep">Conservar máximo</Label>
              <Input
                id="max-keep"
                type="number"
                min={1}
                max={100}
                value={autoBackupMaxKeep}
                onChange={(e) => setAutoBackupMaxKeep(e.target.value)}
                disabled={!autoBackupEnabled}
              />
              <p className="text-xs text-muted-foreground">
                Se eliminarán los respaldos más antiguos al superar este límite
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveSettings}
              disabled={saveSettingsMutation.isPending}
              variant="secondary"
              className="gap-1.5"
            >
              <Save className="h-4 w-4" />
              {saveSettingsMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backups List Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5" />
                Respaldos Guardados
              </CardTitle>
              <CardDescription>
                {backups.length === 0
                  ? 'Aún no hay respaldos creados'
                  : `${backups.length} respaldo(s) disponible(s)`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
                className="gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => cleanupMutation.mutate()}
                disabled={cleanupMutation.isPending || backups.length === 0}
                className="gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {cleanupMutation.isPending ? 'Limpiando...' : 'Limpiar antiguos'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Cargando respaldos...</p>
          ) : backups.length === 0 ? (
            <div className="py-12 text-center">
              <Database className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No hay respaldos todavía. Creá el primero desde la sección de arriba.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {backups.map((backup) => (
                <div
                  key={backup.filename}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">
                        {backup.description || filenameToLabel(backup.filename)}
                      </p>
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {formatBytes(backup.size)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(backup.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(backup.filename)}
                      title="Descargar"
                      className="h-8 w-8"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRestoreTarget(backup)}
                      title="Restaurar"
                      className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(backup)}
                      title="Eliminar"
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Restaurar Respaldo
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vas a restaurar el respaldo <strong>{restoreTarget?.description || filenameToLabel(restoreTarget?.filename || '')}</strong>.
              <br /><br />
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                ⚠️ Esto reemplazará todos los datos actuales del sistema.
              </span>{' '}
              Antes de restaurar, se creará automáticamente un respaldo de la base de datos actual por seguridad.
              <br /><br />
              Después de restaurar, la página se recargará automáticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (restoreTarget) restoreMutation.mutate(restoreTarget.filename)
              }}
              disabled={restoreMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {restoreMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Restaurando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Restaurar Ahora
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Eliminar Respaldo
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar el respaldo <strong>{deleteTarget?.description || filenameToLabel(deleteTarget?.filename || '')}</strong>.
              <br /><br />
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (deleteTarget) deleteMutation.mutate(deleteTarget.filename)
              }}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
