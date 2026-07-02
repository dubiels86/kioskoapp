// License-gate cookie helpers.
//
// The middleware (which must stay lightweight and edge/node-safe) does NOT touch
// Prisma. Instead, the activate/heartbeat route handlers (which DO use the full
// license lib + Prisma) set an HMAC-signed cookie after a successful check.
// The middleware only verifies the cookie signature + expiry.
//
// Cookie format:  <base64url(payload)>.<base64url(hmac-sha256)>
// payload = { v:1, s: status, l: licenseId, e: expiryUnixMs }

import crypto from 'crypto'
import { cookies } from 'next/headers'
import { LICENSE_COOKIE_SECRET } from '@/lib/license-secret'

export const LICENSE_COOKIE_NAME = 'kiosko-license'

const DEFAULT_SECRET = 'kiosko-license-cookie-secret-2025-do-not-ship-as-is'

function getSecret(): string {
  return LICENSE_COOKIE_SECRET || DEFAULT_SECRET
}

interface CookiePayload {
  v: number
  s: string // status
  l: string | null // licenseId
  e: number // expiry unix-ms
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, 'base64url')
}

function hmac(data: string): string {
  return b64url(
    crypto.createHmac('sha256', getSecret()).update(data, 'utf8').digest()
  )
}

/** Build the signed cookie value for a given status + licenseId. */
export function signLicenseCookie(
  status: string,
  licenseId: string | null,
  expiresMs: number
): string {
  const payload: CookiePayload = {
    v: 1,
    s: status,
    l: licenseId,
    e: expiresMs,
  }
  const payloadB64 = b64url(JSON.stringify(payload))
  return `${payloadB64}.${hmac(payloadB64)}`
}

export interface VerifiedCookie {
  valid: boolean
  status: string | null
  licenseId: string | null
  expiresAt: number | null
}

/** Verify a raw cookie value. Pure — safe to call from middleware. */
export function verifyLicenseCookieValue(value: string | undefined | null): VerifiedCookie {
  if (!value) return { valid: false, status: null, licenseId: null, expiresAt: null }
  const parts = value.split('.')
  if (parts.length !== 2) {
    return { valid: false, status: null, licenseId: null, expiresAt: null }
  }
  const [payloadB64, sig] = parts
  const expectedSig = hmac(payloadB64)
  // constant-time compare
  const a = Buffer.from(sig)
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, status: null, licenseId: null, expiresAt: null }
  }
  let payload: CookiePayload
  try {
    payload = JSON.parse(fromB64url(payloadB64).toString('utf8')) as CookiePayload
  } catch {
    return { valid: false, status: null, licenseId: null, expiresAt: null }
  }
  if (payload.v !== 1) {
    return { valid: false, status: null, licenseId: null, expiresAt: null }
  }
  if (typeof payload.e !== 'number' || payload.e < Date.now()) {
    return { valid: false, status: payload.s ?? null, licenseId: payload.l ?? null, expiresAt: payload.e ?? null }
  }
  const allowed = payload.s === 'active' || payload.s === 'grace'
  return {
    valid: allowed,
    status: payload.s,
    licenseId: payload.l ?? null,
    expiresAt: payload.e,
  }
}

/** Refresh window for the cookie (1 hour). Heartbeat refreshes it. */
const COOKIE_TTL_MS = 60 * 60 * 1000

/**
 * Set the license cookie on the outgoing response (used by activate/heartbeat
 * route handlers after a successful check).
 */
export async function setLicenseResponseCookie(
  status: string,
  licenseId: string | null,
  graceUntil?: Date | null
): Promise<void> {
  const now = Date.now()
  // Cookie lives 1h, but never beyond graceUntil
  let exp = now + COOKIE_TTL_MS
  if (graceUntil) {
    const g = new Date(graceUntil).getTime()
    if (!isNaN(g) && g < exp) exp = g
  }
  const value = signLicenseCookie(status, licenseId, exp)
  const cookieStore = await cookies()
  cookieStore.set(LICENSE_COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(60, Math.floor((exp - now) / 1000)),
  })
}

/** Clear the license cookie (used by deactivate). */
export async function clearLicenseResponseCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(LICENSE_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
