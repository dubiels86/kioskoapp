import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone,
        roleId: user.roleId,
        role: user.role,
        permissions: user.permissions,
      },
    })
  } catch (error) {
    console.error('Session error:', error)
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}
