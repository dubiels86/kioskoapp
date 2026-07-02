'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Download,
  PackageOpen,
  FileCode,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { APP_VERSION } from '@/lib/version'

interface DownloadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DownloadDialog({ open, onOpenChange }: DownloadDialogProps) {
  const [downloading, setDownloading] = useState<string | null>(null)

  // Check latest version
  const { data: versionData, refetch: refetchVersion } = useQuery({
    queryKey: ['version-check'],
    queryFn: async () => {
      const res = await fetch('/api/version')
      if (!res.ok) throw new Error('Error')
      return res.json() as Promise<{ version: string }>
    },
    enabled: false, // Only fetch on demand
  })

  const handleDownload = async (url: string, fileName: string, label: string) => {
    setDownloading(fileName)
    try {
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success(`Descargando ${label}...`)
    } catch {
      toast.error('Error al descargar el archivo')
    } finally {
      setTimeout(() => setDownloading(null), 1500)
    }
  }

  const isDownloading = (name: string) => downloading === name

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Descargas y Actualizaciones
          </DialogTitle>
          <DialogDescription>
            Descargá los archivos para instalar o actualizar KioskoApp
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Version info */}
          <div className="flex items-center justify-between rounded-lg border bg-slate-50 dark:bg-slate-900/50 p-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-mono">
                v{APP_VERSION}
              </Badge>
              <span className="text-sm text-muted-foreground">Versión actual</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchVersion()}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              Verificar
            </Button>
          </div>

          {/* Update existing system */}
          <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                <PackageOpen className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Actualizar sistema existente
                </p>
                <p className="text-[11px] text-amber-600/80 dark:text-amber-400/60">
                  Para sistemas ya instalados
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground pl-10">
              Descargá estos <strong>2 archivos</strong> y copialos a la raíz de tu proyecto. Luego ejecutá:
              <code className="ml-1 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-mono border">
                chmod +x update.sh &amp;&amp; ./update.sh
              </code>
            </p>

            <div className="space-y-2 pl-10">
              <Button
                variant="outline"
                size="sm"
                disabled={isDownloading('update-tar')}
                onClick={() => handleDownload('/api/download?type=update', `kiosko-app-update-v${APP_VERSION}.tar.gz`, 'update.tar.gz')}
                className="w-full justify-start gap-3 bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-800/40 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              >
                <PackageOpen className="h-4 w-4 text-amber-600 shrink-0" />
                <div className="flex-1 text-left">
                  <div className="text-xs font-medium">update.tar.gz</div>
                  <div className="text-[10px] text-muted-foreground">~170 KB — Archivos del sistema actualizados</div>
                </div>
                {isDownloading('update-tar') ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={isDownloading('update-sh')}
                onClick={() => handleDownload('/api/download-update', `update-v${APP_VERSION}.sh`, 'update.sh')}
                className="w-full justify-start gap-3 bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-800/40 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              >
                <FileCode className="h-4 w-4 text-amber-600 shrink-0" />
                <div className="flex-1 text-left">
                  <div className="text-xs font-medium">update.sh</div>
                  <div className="text-[10px] text-muted-foreground">~12 KB — Script de actualización</div>
                </div>
                {isDownloading('update-sh') ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
              </Button>
            </div>
          </div>

          {/* Full installation */}
          <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Instalación nueva (desde cero)
                </p>
                <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/60">
                  Primer instalación del sistema
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground pl-10">
              Paquete completo. Extraé y ejecutá:
              <code className="ml-1 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-mono border">
                bun install &amp;&amp; bun run dev
              </code>
            </p>

            <div className="pl-10">
              <Button
                variant="outline"
                size="sm"
                disabled={isDownloading('full-tar')}
                onClick={() => handleDownload('/api/download', `kiosko-app-v${APP_VERSION}.tar.gz`, 'kiosko-app.tar.gz')}
                className="w-full justify-start gap-3 bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                <Download className="h-4 w-4 text-emerald-600 shrink-0" />
                <div className="flex-1 text-left">
                  <div className="text-xs font-medium">kiosko-app.tar.gz</div>
                  <div className="text-[10px] text-muted-foreground">~60 MB — Sistema completo</div>
                </div>
                {isDownloading('full-tar') ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
              </Button>
            </div>
          </div>

          {/* Help info */}
          <div className="flex items-start gap-2 rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-3">
            <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-700 dark:text-blue-300 space-y-1">
              <p><strong>Actualización:</strong> Descargá los 2 archivos (update.tar.gz + update.sh), copialos a la raíz del proyecto existente y ejecutá el script.</p>
              <p><strong>Instalación nueva:</strong> Descargá kiosko-app.tar.gz, extraé la carpeta, instalá dependencias con <code className="bg-white dark:bg-slate-800 px-1 rounded font-mono">bun install</code> y ejecutá <code className="bg-white dark:bg-slate-800 px-1 rounded font-mono">bun run dev</code>.</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
