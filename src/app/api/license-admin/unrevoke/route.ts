import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { unrevokeLicense } from '@/lib/license-admin'

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  if (!user.permissions.includes('settings.all')) {
    return NextResponse.json({ error: 'Permisos insuficientes.' }, { status: 403 })
  }
  try {
    const body = (await request.json().catch(() => null)) as { licenseId?: string } | null
    if (!body?.licenseId) {
      return NextResponse.json({ ok: false, error: 'Falta licenseId.' }, { status: 400 })
    }
    const result = await unrevokeLicense(body.licenseId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('unrevokeLicense error:', error)
    return NextResponse.json({ ok: false, error: 'Error al deshacer revocación.' }, { status: 502 })
  }
}
