import { NextResponse, type NextRequest } from 'next/server'
import { LICENSE_COOKIE_SECRET } from '@/lib/license-secret'

const LICENSE_COOKIE_NAME = 'kiosko-license'

// Paths that are ALWAYS accessible (no license required).
const PUBLIC_PATHS = [
  '/api/license', // activation / status / heartbeat / deactivate
  '/api/version',
  '/api/auth', // login / logout / session
]

function isPublic(pathname: string): boolean {
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return true
  }
  for (const p of PUBLIC_PATHS) {
    if (pathname === p || pathname.startsWith(p + '/')) return true
  }
  return false
}

function getSecret(): string {
  return LICENSE_COOKIE_SECRET
}

/** Convert ArrayBuffer to base64url string (Edge-safe). */
function bufToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function strToB64url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function b64urlToStr(b64: string): string {
  const normalized = b64.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(normalized)
  return decodeURIComponent(escape(bin))
}

/** Constant-time string compare (Edge-safe). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

async function verifyCookieValue(value: string | undefined | null): Promise<{ ok: boolean; reason?: string }> {
  if (!value) return { ok: false, reason: 'no_cookie' }
  const parts = value.split('.')
  if (parts.length !== 2) return { ok: false, reason: 'bad_format' }
  const [payloadB64, sig] = parts

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(getSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    )
    const sigBuf = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(payloadB64)
    )
    const expectedSig = bufToB64url(sigBuf)
    if (!safeEqual(sig, expectedSig)) {
      return { ok: false, reason: 'sig_mismatch', expected: expectedSig, got: sig }
    }

    const payload = JSON.parse(b64urlToStr(payloadB64))
    if (payload.v !== 1) return { ok: false, reason: 'bad_version' }
    if (typeof payload.e !== 'number' || payload.e < Date.now()) return { ok: false, reason: 'expired' }
    if (payload.s !== 'active' && payload.s !== 'grace') return { ok: false, reason: 'bad_status:' + payload.s }
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: 'exception:' + (e instanceof Error ? e.message : String(e)) }
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Always-allowed paths
  if (isPublic(pathname)) {
    return NextResponse.next()
  }

  // 2. The root page `/` renders the activation overlay itself.
  if (pathname === '/') {
    return NextResponse.next()
  }

  // 3. Check the signed license cookie
  const cookie = request.cookies.get(LICENSE_COOKIE_NAME)?.value
  const result = await verifyCookieValue(cookie)
  if (result.ok) {
    return NextResponse.next()
  }

  // 4. Blocked
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      {
        error: 'license_required',
        message: 'No hay una licencia válida activa. Activá una licencia para continuar.',
      },
      { status: 503 }
    )
  }

  const url = request.nextUrl.clone()
  url.pathname = '/'
  url.search = '?license=required'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
