import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { deactivateDevice } from '@/lib/license-admin'

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  if (!user.permissions.includes('settings.all')) {
    return NextResponse.json({ error: 'Permisos insuficientes.' }, { status: 403 })
  }
  try {
    const body = (await request.json().catch(() => null)) as
      | { licenseId?: string; fingerprint?: string }
      | null
    if (!body?.licenseId || !body?.fingerprint) {
      return NextResponse.json(
        { ok: false, error: 'Faltan licenseId y fingerprint.' },
        { status: 400 }
      )
    }
    const result = await deactivateDevice(body.licenseId, body.fingerprint)
    return NextResponse.json(result)
  } catch (error) {
    console.error('deactivateDevice error:', error)
    return NextResponse.json({ ok: false, error: 'Error al desactivar dispositivo.' }, { status: 502 })
  }
}
