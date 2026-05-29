import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, permissions, isActive } = body

    const existing = await db.role.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 })
    }

    if (name && name.trim() !== existing.name) {
      const nameConflict = await db.role.findUnique({ where: { name: name.trim() } })
      if (nameConflict) {
        return NextResponse.json({ error: 'Ya existe un rol con ese nombre' }, { status: 400 })
      }
    }

    const role = await db.role.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(permissions !== undefined && { permissions: JSON.stringify(permissions) }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: JSON.parse(role.permissions),
      isActive: role.isActive,
    })
  } catch (error) {
    console.error('Error updating role:', error)
    return NextResponse.json({ error: 'Error al actualizar rol' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const role = await db.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    })
    if (!role) {
      return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 })
    }

    if (role._count.users > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar el rol "${role.name}" porque tiene ${role._count.users} usuario(s) asignado(s)` },
        { status: 400 }
      )
    }

    await db.role.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting role:', error)
    return NextResponse.json({ error: 'Error al eliminar rol' }, { status: 500 })
  }
}
