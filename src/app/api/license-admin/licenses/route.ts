import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { listLicenses, issueLicense } from '@/lib/license-admin'
import type { IssueLicenseInput } from '@/lib/license-admin'

async function requireSuperAdmin() {
  const user = await getSessionUser()
  if (!user) return { error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) }
  if (!user.permissions.includes('settings.all')) {
    return {
      error: NextResponse.json(
        { error: 'Permisos insuficientes. Se requiere super-admin.' },
        { status: 403 }
      ),
    }
  }
  return { user }
}

/** GET /api/license-admin/licenses — lista todas las licencias + activaciones */
export async function GET() {
  const guard = await requireSuperAdmin()
  if ('error' in guard) return guard.error
  try {
    const licenses = await listLicenses()
    return NextResponse.json({ ok: true, licenses })
  } catch (error) {
    console.error('listLicenses error:', error)
    return NextResponse.json(
      { ok: false, error: 'No se pudo contactar al servidor de licencias.' },
      { status: 502 }
    )
  }
}

/** POST /api/license-admin/licenses — emite una nueva licencia */
export async function POST(request: Request) {
  const guard = await requireSuperAdmin()
  if ('error' in guard) return guard.error
  try {
    const body = (await request.json().catch(() => null)) as Partial<IssueLicenseInput> | null
    if (!body) {
      return NextResponse.json({ ok: false, error: 'Body inválido.' }, { status: 400 })
    }
    const customer = (body.customer || '').toString().trim()
    const plan = (body.plan || 'pro').toString().trim()
    const expiresAt = (body.expiresAt || '').toString().trim()
    const maxDevices = Number(body.maxDevices)
    const features = Array.isArray(body.features) ? body.features : []

    if (!customer) {
      return NextResponse.json({ ok: false, error: 'Falta el nombre del cliente.' }, { status: 400 })
    }
    if (!expiresAt || isNaN(new Date(expiresAt).getTime())) {
      return NextResponse.json({ ok: false, error: 'Fecha de vencimiento inválida.' }, { status: 400 })
    }
    if (isNaN(maxDevices) || maxDevices < 1) {
      return NextResponse.json({ ok: false, error: 'maxDevices debe ser ≥ 1.' }, { status: 400 })
    }

    const result = await issueLicense({ customer, plan, expiresAt, maxDevices, features })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('issueLicense error:', error)
    return NextResponse.json(
      { ok: false, error: 'No se pudo emitir la licencia.' },
      { status: 502 }
    )
  }
}
