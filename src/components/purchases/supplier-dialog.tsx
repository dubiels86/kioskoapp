'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Edit, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'

interface Supplier {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  purchaseCount: number
}

interface SupplierDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SupplierDialog({ open, onOpenChange }: SupplierDialogProps) {
  const queryClient = useQueryClient()

  // State for editing/creating
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null)

  // Fetch suppliers
  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await fetch('/api/suppliers')
      if (!res.ok) throw new Error('Error al obtener proveedores')
      return res.json() as Promise<Supplier[]>
    },
    enabled: open,
  })

  const resetForm = () => {
    setFormName('')
    setFormPhone('')
    setFormEmail('')
    setFormAddress('')
    setEditingSupplier(null)
    setShowForm(false)
  }

  const startEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setFormName(supplier.name)
    setFormPhone(supplier.phone || '')
    setFormEmail(supplier.email || '')
    setFormAddress(supplier.address || '')
    setShowForm(true)
  }

  const startCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('El nombre es requerido')
      return
    }

    setSaving(true)
    try {
      const body = {
        name: formName.trim(),
        phone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
      }

      if (editingSupplier) {
        const res = await fetch(`/api/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Error al actualizar proveedor')
        }
        toast.success('Proveedor actualizado correctamente')
      } else {
        const res = await fetch('/api/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Error al crear proveedor')
        }
        toast.success('Proveedor creado correctamente')
      }

      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar proveedor')
    } finally {
      setSaving(false)
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al eliminar proveedor')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Proveedor eliminado correctamente')
      setDeleteConfirmOpen(false)
      setDeletingSupplier(null)
    },
    onError: (err) => {
      toast.error(err.message)
      setDeleteConfirmOpen(false)
    },
  })

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-[480px] w-full">
          <SheetHeader>
            <SheetTitle>Gestión de Proveedores</SheetTitle>
            <SheetDescription>
              Administra los proveedores de tu kiosco
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <Button
              onClick={startCreate}
              className="w-full bg-teal-600 hover:bg-teal-700 gap-1.5"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              Nuevo Proveedor
            </Button>

            {/* Create/Edit form */}
            {showForm && (
              <div className="space-y-3 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <h4 className="font-medium text-sm">
                  {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                </h4>
                <div className="grid gap-2">
                  <Label htmlFor="sup-name" className="text-xs">Nombre *</Label>
                  <Input
                    id="sup-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Nombre del proveedor"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <Label htmlFor="sup-phone" className="text-xs">Teléfono</Label>
                    <Input
                      id="sup-phone"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="Teléfono"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="sup-email" className="text-xs">Email</Label>
                    <Input
                      id="sup-email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="Email"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="sup-addr" className="text-xs">Dirección</Label>
                  <Input
                    id="sup-addr"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="Dirección"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={resetForm} className="flex-1">
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 bg-teal-600 hover:bg-teal-700"
                  >
                    {saving ? 'Guardando...' : editingSupplier ? 'Actualizar' : 'Crear'}
                  </Button>
                </div>
              </div>
            )}

            <Separator />

            {/* Supplier list */}
            <ScrollArea className="h-[calc(100vh-350px)]">
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
              ) : suppliers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hay proveedores</p>
              ) : (
                <div className="space-y-2">
                  {suppliers.map((supplier) => (
                    <div
                      key={supplier.id}
                      className="flex items-start justify-between p-3 rounded-lg border bg-white dark:bg-slate-950"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{supplier.name}</p>
                        {supplier.phone && (
                          <p className="text-xs text-muted-foreground">Tel: {supplier.phone}</p>
                        )}
                        {supplier.email && (
                          <p className="text-xs text-muted-foreground">{supplier.email}</p>
                        )}
                        {supplier.address && (
                          <p className="text-xs text-muted-foreground truncate">{supplier.address}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {supplier.purchaseCount} compra{supplier.purchaseCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(supplier)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeletingSupplier(supplier)
                            setDeleteConfirmOpen(true)
                          }}
                          disabled={supplier.purchaseCount > 0}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Eliminar Proveedor</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar a &quot;{deletingSupplier?.name}&quot;?
              {deletingSupplier && deletingSupplier.purchaseCount > 0 && (
                <span className="block mt-2 text-red-600 font-medium text-sm">
                  Este proveedor tiene {deletingSupplier.purchaseCount} compra{deletingSupplier.purchaseCount !== 1 ? 's' : ''} asociada{deletingSupplier.purchaseCount !== 1 ? 's' : ''} y no se puede eliminar.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingSupplier && deleteMutation.mutate(deletingSupplier.id)}
              disabled={deleteMutation.isPending || (deletingSupplier?.purchaseCount ?? 0) > 0}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
