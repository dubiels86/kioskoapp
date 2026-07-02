// SERVER-ONLY
// This module is server-side only. It uses Node.js `os`, `fs`, `crypto`, and Prisma.
// Do NOT import this from client code. Do NOT add `'use client'`.

import crypto from 'crypto'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { APP_VERSION } from '@/lib/version'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Central license-server base URL. Direct localhost (server-to-server). */
export const LICENSE_SERVER_URL = 'http://localhost:3042'

/** Grace period in days (offline-first activation / heartbeat tolerance). */
export const GRACE_PERIOD_DAYS = 7

const GRACE_PERIOD_MS = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000

/** License-state singleton row id (only one license per installation). */
const SINGLETON_ID = 'singleton'

/**
 * Public key (Ed25519 SPKI PEM) used to verify license signatures.
 * Loaded at module init from `src/lib/license-public-key.pem`.
 * Resolves multiple candidate paths so it works regardless of `cwd`.
 */
export const PUBLIC_KEY_PEM: string = (() => {
  const candidates: string[] = [
    path.join(process.cwd(), 'src/lib/license-public-key.pem'),
    path.join(process.cwd(), 'lib/license-public-key.pem'),
    path.join(process.cwd(), 'license-public-key.pem'),
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8')
    } catch {
      // continue
    }
  }
  return ''
})()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LicenseStatus =
  | 'unlicensed'
  | 'active'
  | 'expired'
  | 'revoked'
  | 'grace'
  | 'inactive'
  | 'grace_expired'
  | 'invalid'
  | 'max_devices'

export interface LicensePayload {
  licenseId: string
  customer: string
  plan: string
  issuedAt: string // ISO-8601
  expiresAt: string // ISO-8601
  maxDevices: number
  features: string[]
  signature: string // Ed25519 base64
}

export interface LicenseStateInfo {
  status: LicenseStatus
  reason?: string
  license?: LicensePayload
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

let _publicKey: crypto.KeyObject | null = null
function getPublicKey(): crypto.KeyObject {
  if (_publicKey) return _publicKey
  if (!PUBLIC_KEY_PEM) {
    throw new Error('License public key not loaded (license-public-key.pem missing)')
  }
  _publicKey = crypto.createPublicKey(PUBLIC_KEY_PEM)
  return _publicKey
}

/**
 * Build the canonical JSON string used for signing/verification.
 * Sorts TOP-LEVEL keys alphabetically and EXCLUDES `signature`.
 * Nested values (e.g. the `features` array) keep their original order.
 */
function canonicalOf(payload: Record<string, unknown>): string {
  const { signature: _sig, ...rest } = payload
  void _sig
  const keys = Object.keys(rest).sort()
  const obj: Record<string, unknown> = {}
  for (const k of keys) obj[k] = rest[k]
  return JSON.stringify(obj)
}

/** fetch with an AbortController-based timeout. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Hardware fingerprint
// ---------------------------------------------------------------------------

let _fingerprintCache: string | null = null

function getPrimaryMac(): string {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name]
    if (!nets) continue
    for (const net of nets) {
      if (
        net &&
        !net.internal &&
        net.family === 'IPv4' &&
        net.mac &&
        net.mac !== '00:00:00:00:00:00'
      ) {
        return net.mac
      }
    }
  }
  return '00:00:00:00:00:00'
}

function getCpuInfo(): { model: string; cores: number } {
  try {
    if (process.platform === 'linux') {
      const cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf8')
      const modelMatch = cpuinfo.match(/^model name\s*:\s*(.+)$/m)
      const cores = (cpuinfo.match(/^processor\s*:/gm) || []).length
      return {
        model: modelMatch ? modelMatch[1].trim() : os.cpus()[0]?.model || 'unknown',
        cores: cores > 0 ? cores : os.cpus().length,
      }
    }
  } catch {
    // ignore — fall through to os.cpus()
  }
  const cpus = os.cpus()
  return {
    model: cpus[0]?.model || 'unknown',
    cores: cpus.length,
  }
}

/**
 * Compute a stable SHA-256 hardware fingerprint from MAC, hostname, and CPU info.
 * Result is cached after the first call.
 */
export async function computeFingerprint(): Promise<string> {
  if (_fingerprintCache) return _fingerprintCache
  const mac = getPrimaryMac()
  const hostname = os.hostname()
  const { model, cores } = getCpuInfo()
  const raw = `${mac}|${hostname}|${model}|${cores}`
  const hash = crypto.createHash('sha256').update(raw, 'utf8').digest('hex')
  _fingerprintCache = hash
  return hash
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

/**
 * Verify the Ed25519 signature of a license payload and check expiry.
 * Returns `{ valid: true }` or `{ valid: false, reason }`.
 */
export function verifyLicensePayload(payload: LicensePayload): {
  valid: boolean
  reason?: string
} {
  try {
    if (!payload.signature) {
      return { valid: false, reason: 'missing_signature' }
    }
    const canonical = canonicalOf(payload as unknown as Record<string, unknown>)
    const isValid = crypto.verify(
      null,
      Buffer.from(canonical, 'utf8'),
      getPublicKey(),
      Buffer.from(payload.signature, 'base64')
    )
    if (!isValid) {
      return { valid: false, reason: 'invalid_signature' }
    }
    const expiresAt = new Date(payload.expiresAt)
    if (isNaN(expiresAt.getTime())) {
      return { valid: false, reason: 'invalid_expiresAt' }
    }
    if (expiresAt.getTime() < Date.now()) {
      return { valid: false, reason: 'expired' }
    }
    return { valid: true }
  } catch {
    return { valid: false, reason: 'verification_error' }
  }
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

/**
 * Read the singleton LicenseState row (creating it if absent).
 * Always returns a row object.
 */
export async function getLicenseState() {
  return db.licenseState.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
  })
}

/** Persist a verified payload + activation info into the singleton row. */
async function persistLicense(
  payload: LicensePayload,
  fingerprint: string,
  activationToken: string | null,
  status: LicenseStatus
): Promise<void> {
  const now = new Date()
  const graceUntil = new Date(now.getTime() + GRACE_PERIOD_MS)
  const data = {
    licenseId: payload.licenseId,
    customer: payload.customer,
    plan: payload.plan,
    issuedAt: new Date(payload.issuedAt),
    expiresAt: new Date(payload.expiresAt),
    maxDevices: payload.maxDevices,
    features: JSON.stringify(payload.features),
    fingerprint,
    activationToken,
    status,
    lastHeartbeat: now,
    graceUntil,
    rawPayload: canonicalOf(payload as unknown as Record<string, unknown>),
    signature: payload.signature,
  }
  await db.licenseState.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data,
  })
}

/** Reset the singleton LicenseState row back to `unlicensed`. */
async function resetLicenseState(): Promise<void> {
  await db.licenseState.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      status: 'unlicensed',
      maxDevices: 1,
      features: '[]',
    },
    update: {
      licenseId: null,
      customer: null,
      plan: null,
      issuedAt: null,
      expiresAt: null,
      maxDevices: 1,
      features: '[]',
      fingerprint: null,
      activationToken: null,
      status: 'unlicensed',
      lastHeartbeat: null,
      graceUntil: null,
      rawPayload: null,
      signature: null,
    },
  })
}

// ---------------------------------------------------------------------------
// License file parsing
// ---------------------------------------------------------------------------

/**
 * Parse a `.lic` file content: JSON.parse → structural validation → signature check.
 * Returns `{ ok: true, payload }` on success or `{ ok: false, error }` on failure.
 */
export function parseLicenseFile(content: string): {
  ok: boolean
  payload?: LicensePayload
  error?: string
} {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return { ok: false, error: 'JSON inválido en archivo de licencia.' }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'El archivo de licencia no es un objeto válido.' }
  }

  const obj = parsed as Record<string, unknown>
  const required = [
    'licenseId',
    'customer',
    'plan',
    'issuedAt',
    'expiresAt',
    'maxDevices',
    'features',
    'signature',
  ]
  for (const key of required) {
    if (!(key in obj)) {
      return { ok: false, error: `Campo requerido faltante: ${key}` }
    }
  }

  if (
    typeof obj.licenseId !== 'string' ||
    typeof obj.customer !== 'string' ||
    typeof obj.plan !== 'string' ||
    typeof obj.issuedAt !== 'string' ||
    typeof obj.expiresAt !== 'string' ||
    typeof obj.maxDevices !== 'number' ||
    !Array.isArray(obj.features) ||
    typeof obj.signature !== 'string'
  ) {
    return { ok: false, error: 'Tipos de campos inválidos en la licencia.' }
  }

  const payload: LicensePayload = {
    licenseId: obj.licenseId,
    customer: obj.customer,
    plan: obj.plan,
    issuedAt: obj.issuedAt,
    expiresAt: obj.expiresAt,
    maxDevices: obj.maxDevices,
    features: obj.features as string[],
    signature: obj.signature,
  }

  const verification = verifyLicensePayload(payload)
  if (!verification.valid) {
    return { ok: false, error: `Firma inválida: ${verification.reason}` }
  }

  return { ok: true, payload }
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

/**
 * Activate a license against the central license-server.
 *
 * Flow:
 *   1. Parse + verify signature locally.
 *   2. Compute fingerprint.
 *   3. POST /api/activate to the license-server.
 *   4. On success → persist as `active`.
 *   5. On network error → persist as `grace` (offline-first, 7-day grace).
 *   6. On max_devices/revoked/expired/not_found → return appropriate status.
 */
export async function activateLicense(licenseContent: string): Promise<{
  ok: boolean
  status: LicenseStatus
  message?: string
  license?: LicensePayload
}> {
  const parsed = parseLicenseFile(licenseContent)
  if (!parsed.ok || !parsed.payload) {
    return { ok: false, status: 'invalid', message: parsed.error }
  }
  const payload = parsed.payload
  const fingerprint = await computeFingerprint()

  let serverResponse: {
    status?: string
    ok?: boolean
    activationToken?: string
    message?: string
  } | null = null

  try {
    const res = await fetchWithTimeout(
      `${LICENSE_SERVER_URL}/api/activate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseId: payload.licenseId,
          fingerprint,
          hostname: os.hostname(),
        }),
      },
      5000
    )
    serverResponse = (await res.json().catch(() => null)) as typeof serverResponse
  } catch {
    serverResponse = null // network error
  }

  // Offline-first grace activation
  if (!serverResponse) {
    await persistLicense(payload, fingerprint, null, 'grace')
    return {
      ok: true,
      status: 'grace',
      message:
        'Servidor de licencias no disponible. Licencia en período de gracia (7 días).',
      license: payload,
    }
  }

  const s = serverResponse.status ?? (serverResponse.ok ? 'active' : 'unknown')
  const token = serverResponse.activationToken ?? null

  if (s === 'active') {
    await persistLicense(payload, fingerprint, token, 'active')
    return { ok: true, status: 'active', license: payload }
  }

  if (s === 'max_devices_reached' || s === 'max_devices') {
    return {
      ok: false,
      status: 'max_devices',
      message: 'Máximo de dispositivos alcanzado. Desactivá una instalación anterior.',
    }
  }

  if (s === 'revoked') {
    return { ok: false, status: 'revoked', message: 'Licencia revocada por el servidor.' }
  }

  if (s === 'expired') {
    return { ok: false, status: 'expired', message: 'Licencia expirada.' }
  }

  if (s === 'not_found') {
    return {
      ok: false,
      status: 'invalid',
      message: 'Licencia no encontrada en el servidor.',
    }
  }

  // Unknown response — fall back to grace (signature was already verified locally).
  await persistLicense(payload, fingerprint, token, 'grace')
  return {
    ok: true,
    status: 'grace',
    message:
      'Respuesta desconocida del servidor de licencias. Período de gracia activado (7 días).',
    license: payload,
  }
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

/**
 * Send a heartbeat to the central license-server.
 *
 * - On `active` → refresh lastHeartbeat + graceUntil, set status='active'.
 * - On `revoked`/`expired`/`not_found` → update local status accordingly.
 * - On network error → keep `grace` if graceUntil still in future, else lock as expired.
 */
export async function sendHeartbeat(): Promise<{
  status: LicenseStatus
  message?: string
}> {
  const state = await getLicenseState()
  if (!state.licenseId || state.status === 'unlicensed') {
    return { status: 'unlicensed' }
  }

  let serverResponse: { status?: string; message?: string } | null = null
  try {
    const res = await fetchWithTimeout(
      `${LICENSE_SERVER_URL}/api/heartbeat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseId: state.licenseId,
          fingerprint: state.fingerprint,
          activationToken: state.activationToken,
        }),
      },
      5000
    )
    serverResponse = (await res.json().catch(() => null)) as typeof serverResponse
  } catch {
    serverResponse = null
  }

  const now = new Date()

  if (!serverResponse) {
    // Network error
    if (state.graceUntil && new Date(state.graceUntil) > now) {
      return { status: 'grace', message: 'Sin conexión. Período de gracia activo.' }
    }
    await db.licenseState.update({
      where: { id: SINGLETON_ID },
      data: { status: 'expired' },
    })
    return { status: 'grace_expired' }
  }

  const s = serverResponse.status

  if (s === 'active') {
    const graceUntil = new Date(now.getTime() + GRACE_PERIOD_MS)
    await db.licenseState.update({
      where: { id: SINGLETON_ID },
      data: { status: 'active', lastHeartbeat: now, graceUntil },
    })
    return { status: 'active' }
  }

  if (s === 'revoked') {
    await db.licenseState.update({
      where: { id: SINGLETON_ID },
      data: { status: 'revoked' },
    })
    return { status: 'revoked' }
  }

  if (s === 'expired') {
    await db.licenseState.update({
      where: { id: SINGLETON_ID },
      data: { status: 'expired' },
    })
    return { status: 'expired' }
  }

  if (s === 'not_found') {
    await db.licenseState.update({
      where: { id: SINGLETON_ID },
      data: { status: 'inactive' },
    })
    return { status: 'inactive' }
  }

  // Unknown response — keep current state, optionally fall back to grace if applicable
  if (state.graceUntil && new Date(state.graceUntil) > now) {
    return { status: 'grace', message: 'Respuesta desconocida del servidor. Período de gracia activo.' }
  }
  return { status: state.status as LicenseStatus, message: serverResponse.message }
}

// ---------------------------------------------------------------------------
// Status gate
// ---------------------------------------------------------------------------

/**
 * Main license-status gate used by middleware / API routes.
 *
 * Re-verifies expiry + signature locally (defends against DB tampering),
 * honours grace-period expiry, and returns the active/grace/unlicensed/revoked
 * status along with the parsed payload (when licensed).
 */
export async function checkLicenseStatus(): Promise<LicenseStateInfo> {
  const state = await getLicenseState()

  if (state.status === 'unlicensed' || !state.licenseId) {
    return { status: 'unlicensed' }
  }

  if (state.status === 'revoked') {
    return { status: 'revoked' }
  }

  if (!state.rawPayload || !state.signature) {
    return { status: 'invalid', reason: 'missing_payload_data' }
  }

  // Reconstruct payload from stored canonical JSON + signature
  let fields: Record<string, unknown>
  try {
    fields = JSON.parse(state.rawPayload) as Record<string, unknown>
  } catch {
    return { status: 'invalid', reason: 'corrupt_payload' }
  }

  const payload: LicensePayload = {
    licenseId: fields.licenseId as string,
    customer: fields.customer as string,
    plan: fields.plan as string,
    issuedAt: fields.issuedAt as string,
    expiresAt: fields.expiresAt as string,
    maxDevices: fields.maxDevices as number,
    features: fields.features as string[],
    signature: state.signature,
  }

  // Re-verify signature (rawPayload is already the canonical string)
  try {
    const sigValid = crypto.verify(
      null,
      Buffer.from(state.rawPayload, 'utf8'),
      getPublicKey(),
      Buffer.from(state.signature, 'base64')
    )
    if (!sigValid) {
      return { status: 'invalid', reason: 'signature_mismatch' }
    }
  } catch {
    return { status: 'invalid', reason: 'verification_error' }
  }

  // Check expiry
  const expiresAt = new Date(payload.expiresAt)
  if (isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    return { status: 'expired', reason: 'license_expired' }
  }

  // Check grace-period expiry
  const now = new Date()
  if (state.graceUntil) {
    const graceUntil = new Date(state.graceUntil)
    if (graceUntil < now) {
      const lastHeartbeat = state.lastHeartbeat ? new Date(state.lastHeartbeat) : null
      const stale = !lastHeartbeat || now.getTime() - lastHeartbeat.getTime() > GRACE_PERIOD_MS
      if (stale) {
        return { status: 'grace_expired', reason: 'grace_period_ended' }
      }
    }
  }

  if (state.status === 'grace') {
    return { status: 'grace', license: payload }
  }

  return { status: 'active', license: payload }
}

// ---------------------------------------------------------------------------
// Telemetry
// ---------------------------------------------------------------------------

/**
 * Best-effort telemetry ping. Never throws.
 * Sends `{ fingerprint, version, timestamp, licenseId? }` to /api/telemetry.
 * Used on server startup.
 */
export async function sendTelemetryPing(): Promise<void> {
  try {
    const fingerprint = await computeFingerprint()
    let licenseId: string | undefined
    try {
      const state = await getLicenseState()
      if (state.licenseId) licenseId = state.licenseId
    } catch {
      // ignore
    }
    const body: Record<string, unknown> = {
      fingerprint,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
    }
    if (licenseId) body.licenseId = licenseId
    await fetchWithTimeout(
      `${LICENSE_SERVER_URL}/api/telemetry`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      3000
    )
  } catch {
    // Silently ignore — telemetry is best-effort.
  }
}

// ---------------------------------------------------------------------------
// Deactivation
// ---------------------------------------------------------------------------

/**
 * Deactivate the current license: notify the license-server (best-effort)
 * then reset the local LicenseState to `unlicensed`.
 */
export async function deactivateCurrent(): Promise<{ ok: boolean; message?: string }> {
  const state = await getLicenseState()
  if (state.licenseId && state.activationToken) {
    try {
      const fingerprint = state.fingerprint ?? (await computeFingerprint())
      await fetchWithTimeout(
        `${LICENSE_SERVER_URL}/api/deactivate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            licenseId: state.licenseId,
            fingerprint,
            activationToken: state.activationToken,
          }),
        },
        5000
      )
    } catch {
      // Network error — still reset locally so the device is freed.
    }
  }
  await resetLicenseState()
  return { ok: true, message: 'Licencia desactivada correctamente.' }
}
