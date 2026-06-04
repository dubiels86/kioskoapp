'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ImagePlus, X, Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

interface Product {
  id: string
  name: string
  image?: string | null
}

interface ProductImageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
}

export function ProductImageDialog({ open, onOpenChange, product }: ProductImageDialogProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    if (product && open) {
      setImage(product.image || null)
    }
  }, [product, open])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    processFile(file)
  }

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten archivos de imagen')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no puede superar los 2MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      setImage(result)
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const removeImage = () => {
    setImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!product) return

    setSaving(true)
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: image || null }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al actualizar imagen')
      }

      toast.success('Imagen actualizada correctamente')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar imagen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Foto del Producto
          </DialogTitle>
          <DialogDescription>
            Actualiza la foto de &quot;{product?.name}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />

          {image ? (
            <div className="space-y-3">
              <div className="relative group mx-auto w-fit">
                <img
                  src={image}
                  alt={product?.name || 'Producto'}
                  className="w-48 h-48 rounded-xl object-cover border-2 border-slate-200 dark:border-slate-700 shadow-sm"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Cambiar imagen
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeImage}
                  className="gap-1.5 text-red-500 hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                  Eliminar
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={`
                relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors
                ${dragOver
                  ? 'border-slate-400 bg-slate-100 dark:bg-slate-800'
                  : 'border-muted-foreground/25 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }
              `}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Camera className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Arrastra una imagen aquí
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    o haz clic para seleccionar
                  </p>
                </div>
                <p className="text-xs text-muted-foreground/50">
                  JPG, PNG o WebP · Máximo 2MB
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-slate-800 hover:bg-slate-700 text-white shadow-sm gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
