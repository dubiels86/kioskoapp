'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Plus, Edit, Trash2, Shield } from 'lucide-react'
import { toast } from 'sonner'
import type { RolePermission } from '@/lib/types'
import { ROLE_PERMISSION_LABELS, ROLE_PERMISSION_GROUPS } from '@/lib/types'

interface Role {
  id: string
  name: string
  description?: string | null
  permissions: string[]
  isActive: boolean
  userCount: number
}

export function RolesTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingRole, setDeletingRole] = useState<Role | null>(null)

  // Form
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPermissions, setFormPermissions] = useState<string[]>([])

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await fetch('/api/roles')
      if (!res.ok) throw new Error('Error al obtener roles')
      return res.json() as Promise<Role[]>
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; permissions: string[] }) => {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al crear rol')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Rol creado correctamente')
      closeDialog()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/roles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al actualizar rol')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Rol actualizado correctamente')
      closeDialog()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/roles/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al eliminar rol')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Rol eliminado correctamente')
      setDeleteOpen(false)
      setDeletingRole(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const openCreate = () => {
    setEditingRole(null)
    setFormName('')
    setFormDescription('')
    setFormPermissions([])
    setDialogOpen(true)
  }

  const openEdit = (role: Role) => {
    setEditingRole(role)
    setFormName(role.name)
    setFormDescription(role.description || '')
    setFormPermissions([...role.permissions])
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingRole(null)
  }

  const togglePermission = (perm: string) => {
    setFormPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    )
  }

  const toggleGroup = (perms: RolePermission[]) => {
    const allSelected = perms.every((p) => formPermissions.includes(p))
    if (allSelected) {
      setFormPermissions((prev) => prev.filter((p) => !perms.includes(p as RolePermission)))
    } else {
      setFormPermissions((prev) => {
        const newSet = new Set(prev)
        perms.forEach((p) => newSet.add(p))
        return [...newSet]
      })
    }
  }

  const handleSubmit = () => {
    if (!formName.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }

    if (editingRole) {
      updateMutation.mutate({
        id: editingRole.id,
        data: {
          name: formName.trim(),
          description: formDescription.trim(),
          permissions: formPermissions,
        },
      })
    } else {
      createMutation.mutate({
        name: formName.trim(),
        description: formDescription.trim(),
        permissions: formPermissions,
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Gestión de Roles
            </CardTitle>
            <CardDescription>Defina roles y permisos para el acceso al sistema</CardDescription>
          </div>
          <Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            Nuevo Rol
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rol</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Permisos</TableHead>
                <TableHead>Usuarios</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Cargando roles...
                  </TableCell>
                </TableRow>
              ) : roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No hay roles creados
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id} className={!role.isActive ? 'opacity-60' : ''}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {role.description || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.slice(0, 3).map((p) => (
                          <Badge key={p} variant="secondary" className="text-xs">
                            {ROLE_PERMISSION_LABELS[p as RolePermission] || p}
                          </Badge>
                        ))}
                        {role.permissions.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{role.permissions.length - 3} más
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{role.userCount}</TableCell>
                    <TableCell>
                      {role.isActive ? (
                        <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-100 dark:border-rose-800/30">
                          Inactivo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(role)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeletingRole(role)
                            setDeleteOpen(true)
                          }}
                          disabled={role.userCount > 0}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Create/Edit Role Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Editar Rol' : 'Nuevo Rol'}</DialogTitle>
            <DialogDescription>
              {editingRole ? 'Modifique el rol y sus permisos' : 'Defina un nuevo rol con sus permisos'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role-name">Nombre del Rol *</Label>
                <Input
                  id="role-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Administrador, Vendedor"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-desc">Descripción</Label>
                <Input
                  id="role-desc"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Descripción del rol"
                />
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-base font-semibold">Permisos</Label>
              <p className="text-sm text-muted-foreground mb-3">Seleccione los permisos para este rol</p>
              <div className="space-y-4">
                {ROLE_PERMISSION_GROUPS.map((group) => {
                  const allSelected = group.permissions.every((p) => formPermissions.includes(p))
                  const someSelected = group.permissions.some((p) => formPermissions.includes(p))
                  return (
                    <div key={group.group} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Checkbox
                          checked={allSelected}
                          ref={(el) => {
                            if (el) {
                              (el as unknown as HTMLInputElement).dataset.state = someSelected && !allSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked'
                            }
                          }}
                          onCheckedChange={() => toggleGroup(group.permissions)}
                        />
                        <span className="font-medium text-sm">{group.group}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pl-6">
                        {group.permissions.map((perm) => (
                          <div key={perm} className="flex items-center gap-2">
                            <Checkbox
                              checked={formPermissions.includes(perm)}
                              onCheckedChange={() => togglePermission(perm)}
                            />
                            <span className="text-sm text-muted-foreground">
                              {ROLE_PERMISSION_LABELS[perm]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              {(createMutation.isPending || updateMutation.isPending) ? 'Guardando...' : editingRole ? 'Guardar Cambios' : 'Crear Rol'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Eliminar Rol</DialogTitle>
            <DialogDescription>
              ¿Está seguro de que desea eliminar el rol &quot;{deletingRole?.name}&quot;?
              {deletingRole && deletingRole.userCount > 0 && (
                <span className="block mt-2 text-red-600 font-medium">
                  Este rol tiene {deletingRole.userCount} usuario(s) asignado(s) y no se puede eliminar.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deletingRole && deleteMutation.mutate(deletingRole.id)}
              disabled={deleteMutation.isPending || (deletingRole?.userCount ?? 0) > 0}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
