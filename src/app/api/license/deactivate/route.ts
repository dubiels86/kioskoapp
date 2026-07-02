import { NextResponse } from 'next/server'
import { deactivateCurrent } from '@/lib/license'
import { clearLicenseResponseCookie } from '@/lib/license-cookie'

/**
 * POST /api/license/deactivate
 * Desactiva la licencia actual (libera el dispositivo en el license-server,
 * resetea el estado local a unlicensed y limpia la cookie de gate).
 */
export async function POST() {
  try {
    const result = await deactivateCurrent()
    await clearLicenseResponseCookie()
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (error) {
    console.error('License deactivate error:', error)
    return NextResponse.json(
      { ok: false, message: 'Error interno al desactivar la licencia.' },
      { status: 500 }
    )
  }
}
