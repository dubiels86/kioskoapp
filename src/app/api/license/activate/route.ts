import { NextResponse } from 'next/server'
import { activateLicense, getLicenseState } from '@/lib/license'
import { setLicenseResponseCookie } from '@/lib/license-cookie'

/**
 * POST /api/license/activate
 * Body: { licenseContent: string }  // contenido del archivo .lic (JSON)
 *
 * Activa una licencia: verifica firma localmente, llama al license-server,
 * persiste el estado en la BD local y setea la cookie firmada de gate.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body.licenseContent !== 'string') {
      return NextResponse.json(
        { ok: false, status: 'invalid', message: 'Falta el campo licenseContent.' },
        { status: 400 }
      )
    }

    const result = await activateLicense(body.licenseContent)

    // Set the gate cookie when the license is active or in grace
    if (result.ok && (result.status === 'active' || result.status === 'grace')) {
      const state = await getLicenseState()
      await setLicenseResponseCookie(result.status, result.license?.licenseId ?? null, state.graceUntil)
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (error) {
    console.error('License activate error:', error)
    return NextResponse.json(
      { ok: false, status: 'invalid', message: 'Error interno al activar la licencia.' },
      { status: 500 }
    )
  }
}
