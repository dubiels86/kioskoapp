import { NextResponse } from 'next/server'
import os from 'node:os'
import {
  LICENSE_SERVER_URL,
  activateLicense,
  computeFingerprint,
  getLicenseState,
} from '@/lib/license'
import { LICENSE_ADMIN_API_KEY } from '@/lib/license-admin'
import { setLicenseResponseCookie } from '@/lib/license-cookie'

/**
 * POST /api/license/issue-trial
 *
 * One-click self-activation for the machine running the app. Requires the
 * license-server to be reachable on localhost:3042 (which it is, by design,
 * in a normal KioskoApp deployment — both services run on the same box).
 *
 * Flow:
 *   1. Ask the license-server to ISSUE a brand-new trial license bound to
 *      this machine's hostname. The admin key is sent server-to-server only.
 *   2. Immediately ACTIVATE that license for this machine's fingerprint.
 *   3. Persist the activation in the local DB and set the gate cookie.
 *
 * This endpoint is safe to expose because:
 *   - It only ever issues TRIAL licenses (plan = "trial"), never pro/enterprise.
 *   - It binds to the current machine's fingerprint (maxDevices = 1).
 *   - It expires in 30 days by default (max 365).
 *   - The admin key is never sent to the browser.
 *
 * Body (all optional, sensible defaults):
 *   { customer?: string, days?: number }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      customer?: string
      days?: number
    }

    const customer =
      typeof body.customer === 'string' && body.customer.trim()
        ? body.customer.trim().slice(0, 80)
        : `Trial ${os.hostname()}`
    const days =
      Number.isFinite(body.days) && Number(body.days) > 0 && Number(body.days) <= 365
        ? Math.floor(Number(body.days))
        : 30

    const fingerprint = await computeFingerprint()
    const hostname = os.hostname()
    const issuedAt = new Date()
    const expiresAt = new Date(issuedAt.getTime() + days * 24 * 60 * 60 * 1000)

    // 1) Issue a trial license via the central license-server.
    let issueRes: {
      ok?: boolean
      error?: string
      message?: string
      licenseFileContent?: string
    } | null = null

    try {
      const res = await fetch(`${LICENSE_SERVER_URL}/api/issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': LICENSE_ADMIN_API_KEY,
        },
        body: JSON.stringify({
          customer,
          plan: 'trial',
          issuedAt: issuedAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
          maxDevices: 1,
          features: [],
        }),
      })
      issueRes = (await res.json().catch(() => null)) as typeof issueRes
    } catch {
      return NextResponse.json(
        {
          ok: false,
          status: 'invalid',
          message:
            'No se pudo conectar con el servidor de licencias. ¿Está corriendo? (cd mini-services/license-server && bun run dev)',
        },
        { status: 502 }
      )
    }

    if (!issueRes?.ok || !issueRes.licenseFileContent) {
      return NextResponse.json(
        {
          ok: false,
          status: 'invalid',
          message: issueRes?.message || issueRes?.error || 'El servidor de licencias rechazó la emisión.',
        },
        { status: 502 }
      )
    }

    // 2) Activate the freshly issued license immediately (verifies signature
    //    locally + registers the activation with the license-server).
    const result = await activateLicense(issueRes.licenseFileContent)

    // 3) Set the gate cookie so the middleware lets the next request through.
    if (result.ok && (result.status === 'active' || result.status === 'grace')) {
      const state = await getLicenseState()
      await setLicenseResponseCookie(
        result.status,
        result.license?.licenseId ?? null,
        state.graceUntil
      )
      return NextResponse.json({
        ok: true,
        status: result.status,
        message: result.message || `Licencia trial activada para "${hostname}" (${days} días).`,
        license: result.license,
        fingerprint,
      })
    }

    return NextResponse.json(
      {
        ok: false,
        status: result.status,
        message: result.message || 'No se pudo activar la licencia emitida.',
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('License issue-trial error:', error)
    return NextResponse.json(
      {
        ok: false,
        status: 'invalid',
        message: 'Error interno al emitir la licencia de prueba.',
      },
      { status: 500 }
    )
  }
}
