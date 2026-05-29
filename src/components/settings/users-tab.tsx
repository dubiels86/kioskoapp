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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Edit, Trash2, Users, Key } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/format'

interface Role {
  id: string
  name: string
}

interface User {
  id: string
  username: string
  name: string
  email?: string | null
  phone?: string | null
  roleId: string
  role: { id: string; name: string }
  isActive: boolean
  lastLogin?: string | null
  createdAt: string
}

export function UsersTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [resetPassOpen, setResetPassOpen] = useState(false)
  const [resetUser, setResetUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')

  // Form state
  const [formName, setFormName] = useState('')
  const [formUsername, setFormUsername] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRoleId, setFormRoleId] = useState('')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error('Error al obtener usuarios')
      return res.json() as Promise<User[]>
    },
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await fetch('/api/roles')
      if (!res.ok) throw new Error('Error al obtener roles')
      return res.json() as Promise<Role[]>
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al crear usuario')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Usuario creado correctamente')
      closeDialog()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, string | boolean> }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al actualizar usuario')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Usuario actualizado correctamente')
      closeDialog()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al eliminar usuario')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Usuario desactivado correctamente')
      setDeleteOpen(false)
      setDeletingUser(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const resetPassMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al resetear contraseña')
      }
    },
    onSuccess: () => {
      toast.success('Contraseña actualizada correctamente')
      setResetPassOpen(false)
      setResetUser(null)
      setNewPassword('')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const openCreate = () => {
    setEditingUser(null)
    setFormName('')
    setFormUsername('')
    setFormEmail('')
    setFormPhone('')
    setFormPassword('')
    setFormRoleId(roles[0]?.id || '')
    setDialogOpen(true)
  }

  const openEdit = (user: User) => {
    setEditingUser(user)
    setFormName(user.name)
    setFormUsername(user.username)
    setFormEmail(user.email || '')
    setFormPhone(user.phone || '')
    setFormPassword('')
    setFormRoleId(user.roleId)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingUser(null)
  }

  const handleSubmit = () => {
    if (!formName.trim() || !formUsername.trim() || !formRoleId) {
      toast.error('Complete los campos obligatorios')
      return
    }

    if (editingUser) {
      updateMutation.mutate({
        id: editingUser.id,
        data: {
          name: formName.trim(),
          username: formUsername.trim(),
          email: formEmail.trim(),
          phone: formPhone.trim(),
          roleId: formRoleId,
          ...(formPassword ? { password: formPassword } : {}),
        },
      })
    } else {
      if (!formPassword) {
        toast.error('La contraseña es obligatoria para nuevos usuarios')
        return
      }
      createMutation.mutate({
        name: formName.trim(),
        username: formUsername.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim(),
        password: formPassword,
        roleId: formRoleId,
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gestión de Usuarios
            </CardTitle>
            <CardDescription>Administre los usuarios del sistema y sus roles asignados</CardDescription>
          </div>
          <Button onClick={openCreate} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            Nuevo Usuario
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último Acceso</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Cargando usuarios...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No hay usuarios creados
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className={!user.isActive ? 'opacity-60' : ''}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{user.role.name}</Badge>
                    </TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-100 dark:border-rose-800/30">
                          Inactivo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.lastLogin ? formatDate(user.lastLogin) : 'Nunca'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setResetUser(user)
                            setNewPassword('')
                            setResetPassOpen(true)
                          }}
                          title="Resetear contraseña"
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        {user.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeletingUser(user)
                              setDeleteOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Modifique los datos del usuario' : 'Complete los datos para crear un nuevo usuario'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input id="name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nombre completo" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Usuario *</Label>
                <Input id="username" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} placeholder="Nombre de usuario" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="correo@ejemplo.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="Teléfono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">
                  Contraseña {editingUser ? '(dejar vacío para no cambiar)' : '*'}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUser ? 'Nueva contraseña' : 'Contraseña'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rol *</Label>
                <Select value={formRoleId} onValueChange={setFormRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm"
            >
              {(createMutation.isPending || updateMutation.isPending) ? 'Guardando...' : editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Desactivar Usuario</DialogTitle>
            <DialogDescription>
              ¿Está seguro de que desea desactivar al usuario &quot;{deletingUser?.name}&quot;?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Desactivando...' : 'Desactivar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPassOpen} onOpenChange={setResetPassOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Resetear Contraseña</DialogTitle>
            <DialogDescription>
              Ingrese la nueva contraseña para &quot;{resetUser?.name}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="new-password">Nueva Contraseña</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 4 caracteres"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPassOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => resetUser && resetPassMutation.mutate({ id: resetUser.id, password: newPassword })}
              disabled={resetPassMutation.isPending || newPassword.length < 4}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm"
            >
              {resetPassMutation.isPending ? 'Guardando...' : 'Guardar Contraseña'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
