import { NextResponse } from 'next/server'
import { checkLicenseStatus, computeFingerprint, getLicenseState } from '@/lib/license'

/**
 * GET /api/license/status
 * Devuelve el estado actual de la licencia (público: el middleware y la UI lo usan
 * para decidir si bloquear o mostrar el diálogo de activación).
 */
export async function GET() {
  try {
    const info = await checkLicenseStatus()
    const state = await getLicenseState()
    const fingerprint = await computeFingerprint().catch(() => null)

    return NextResponse.json({
      status: info.status,
      reason: info.reason,
      license: info.license
        ? {
            licenseId: info.license.licenseId,
            customer: info.license.customer,
            plan: info.license.plan,
            issuedAt: info.license.issuedAt,
            expiresAt: info.license.expiresAt,
            maxDevices: info.license.maxDevices,
            features: info.license.features,
          }
        : null,
      fingerprint,
      lastHeartbeat: state.lastHeartbeat,
      graceUntil: state.graceUntil,
    })
  } catch (error) {
    console.error('License status error:', error)
    return NextResponse.json(
      { status: 'unlicensed', error: 'No se pudo verificar la licencia.' },
      { status: 200 }
    )
  }
}
