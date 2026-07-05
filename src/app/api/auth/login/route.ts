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

    // If the password was base64-encoded (legacy), upgrade it to bcrypt.
    // This is a NON-CRITICAL write — if it fails (e.g. read-only DB, permission
    // issue), we still log the user in. We'll retry on next login.
    if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$') && !user.password.startsWith('$2y$')) {
      try {
        const newHash = await hashPassword(password)
        await db.user.update({
          where: { id: user.id },
          data: { password: newHash },
        })
      } catch (upgradeErr) {
        console.warn('Login: no se pudo actualizar el hash de contraseña (non-critical):', upgradeErr?.message || upgradeErr)
      }
    }

    // Create session token and set cookie
    const token = createSessionToken(user.id)
    await setSessionCookie(token)

    // Update last login timestamp. NON-CRITICAL — if the DB write fails
    // (read-only file, permission issue, etc.), we still return a successful
    // login so the user can use the app. The session cookie is already set.
    try {
      await db.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      })
    } catch (lastLoginErr) {
      console.warn('Login: no se pudo actualizar lastLogin (non-critical):', lastLoginErr?.message || lastLoginErr)
    }

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
