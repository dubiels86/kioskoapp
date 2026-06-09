import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { createSessionToken, setSessionCookie, verifyPassword, hashPassword } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username?.trim() || !password) {
      return NextResponse.json(
        { error: 'Usuario y contraseña son obligatorios' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { username: username.trim() },
      include: {
        role: { select: { id: true, name: true, permissions: true } },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      )
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Usuario desactivado. Contacte al administrador.' },
        { status: 403 }
      )
    }

    const passwordValid = await verifyPassword(password, user.password)
    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      )
    }

    // If the password was base64-encoded (legacy), upgrade it to bcrypt
    if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$') && !user.password.startsWith('$2y$')) {
      const newHash = await hashPassword(password)
      await db.user.update({
        where: { id: user.id },
        data: { password: newHash },
      })
    }

    // Create session token and set cookie
    const token = createSessionToken(user.id)
    setSessionCookie(token)

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone,
        roleId: user.roleId,
        role: { id: user.role.id, name: user.role.name },
        permissions: JSON.parse(user.role.permissions),
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 500 })
  }
}
