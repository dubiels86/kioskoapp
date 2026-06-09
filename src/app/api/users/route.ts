import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { hashPassword } from '@/lib/auth'

export async function GET() {
  try {
    const users = await db.user.findMany({
      include: {
        role: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(
      users.map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        email: u.email,
        phone: u.phone,
        roleId: u.roleId,
        role: u.role,
        isActive: u.isActive,
        lastLogin: u.lastLogin,
        createdAt: u.createdAt,
      }))
    )
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, password, name, email, phone, roleId } = body

    if (!username?.trim() || !password || !name?.trim() || !roleId) {
      return NextResponse.json(
        { error: 'Usuario, contraseña, nombre y rol son obligatorios' },
        { status: 400 }
      )
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 4 caracteres' },
        { status: 400 }
      )
    }

    const existingUsername = await db.user.findUnique({ where: { username: username.trim() } })
    if (existingUsername) {
      return NextResponse.json({ error: 'Ya existe un usuario con ese nombre de usuario' }, { status: 400 })
    }

    const role = await db.role.findUnique({ where: { id: roleId } })
    if (!role) {
      return NextResponse.json({ error: 'Rol no encontrado' }, { status: 400 })
    }

    // Hash password with bcrypt
    const hashedPassword = await hashPassword(password)

    const user = await db.user.create({
      data: {
        username: username.trim(),
        password: hashedPassword,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        roleId,
      },
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
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 })
  }
}
