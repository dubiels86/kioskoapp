import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { username, password, name, email, phone, roleId, isActive } = body

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (username && username.trim() !== existing.username) {
      const usernameConflict = await db.user.findUnique({ where: { username: username.trim() } })
      if (usernameConflict) {
        return NextResponse.json({ error: 'Ya existe un usuario con ese nombre de usuario' }, { status: 400 })
      }
    }

    if (roleId) {
      const role = await db.role.findUnique({ where: { id: roleId } })
      if (!role) {
        return NextResponse.json({ error: 'Rol no encontrado' }, { status: 400 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (username !== undefined) updateData.username = username.trim()
    if (name !== undefined) updateData.name = name.trim()
    if (email !== undefined) updateData.email = email?.trim() || null
    if (phone !== undefined) updateData.phone = phone?.trim() || null
    if (roleId !== undefined) updateData.roleId = roleId
    if (isActive !== undefined) updateData.isActive = isActive
    if (password && password.trim()) {
      if (password.length < 4) {
        return NextResponse.json(
          { error: 'La contraseña debe tener al menos 4 caracteres' },
          { status: 400 }
        )
      }
      updateData.password = Buffer.from(password).toString('base64')
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
      include: {
        role: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      phone: user.phone,
      roleId: user.roleId,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Soft delete - deactivate instead
    await db.user.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 })
  }
}
