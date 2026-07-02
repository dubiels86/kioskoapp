import { NextResponse } from 'next/server'
import { sendHeartbeat, getLicenseState } from '@/lib/license'
import { setLicenseResponseCookie, clearLicenseResponseCookie } from '@/lib/license-cookie'

/**
 * POST /api/license/heartbeat
 * Envía un heartbeat al license-server, actualiza el estado local y
 * refresca la cookie firmada de gate.
 */
export async function POST() {
  try {
    const result = await sendHeartbeat()

    if (result.status === 'active' || result.status === 'grace') {
      const state = await getLicenseState()
      await setLicenseResponseCookie(result.status, state.licenseId, state.graceUntil)
    } else {
      // revoked / expired / inactive / grace_expired → clear the gate cookie
      await clearLicenseResponseCookie()
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('License heartbeat error:', error)
    return NextResponse.json(
      { status: 'grace', message: 'Error interno de heartbeat.' },
      { status: 200 }
    )
  }
}
