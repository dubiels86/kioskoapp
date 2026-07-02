// SERVER-ONLY
// Admin helpers for the central license-server. These run server-side and add
// the X-Admin-Key header. The admin key is NEVER exposed to the browser.

import { LICENSE_SERVER_URL } from '@/lib/license'

/** Shared admin secret. In production, rotate this and keep it server-side only. */
export const LICENSE_ADMIN_API_KEY =
  process.env.LICENSE_ADMIN_API_KEY || 'kiosko-admin-secret-2025'

function adminHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Admin-Key': LICENSE_ADMIN_API_KEY,
  }
}

export interface AdminLicense {
  licenseId: string
  customer: string
  plan: string
  issuedAt: string
  expiresAt: string
  maxDevices: number
  features: string[]
  revoked: boolean
  createdAt: string
  activations: AdminActivation[]
}

export interface AdminActivation {
  activationId: string
  licenseId: string
  fingerprint: string
  hostname: string
  activatedAt: string
  lastHeartbeat: string
  active: boolean
}

export interface IssueLicenseInput {
  customer: string
  plan: string
  expiresAt: string // ISO-8601
  maxDevices: number
  features: string[]
}

export interface IssuedLicense {
  ok: boolean
  license: {
    licenseId: string
    customer: string
    plan: string
    issuedAt: string
    expiresAt: string
    maxDevices: number
    features: string[]
    signature: string
  }
  licenseFileContent: string
}

async function callServer<T>(
  path: string,
  init: RequestInit,
  timeoutMs = 8000
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${LICENSE_SERVER_URL}${path}`, {
      ...init,
      headers: { ...adminHeaders(), ...((init.headers as Record<string, string>) || {}) },
      signal: controller.signal,
    })
    const data = (await res.json().catch(() => null)) as T
    return data
  } finally {
    clearTimeout(timer)
  }
}

export async function listLicenses(): Promise<AdminLicense[]> {
  const data = await callServer<{ ok?: boolean; licenses?: AdminLicense[] } | AdminLicense[]>(
    '/api/licenses',
    { method: 'GET' }
  )
  const raw = Array.isArray(data) ? data : data.licenses ?? []
  // Normalize: the license-server may return `activations` as
  // `{ active, total, devices: [...] }` instead of a flat array.
  return raw.map((lic) => {
    const a = lic.activations as unknown
    if (Array.isArray(a)) return lic
    if (a && typeof a === 'object' && Array.isArray((a as { devices?: unknown[] }).devices)) {
      return { ...lic, activations: (a as { devices: AdminActivation[] }).devices }
    }
    return { ...lic, activations: [] }
  })
}

export async function issueLicense(input: IssueLicenseInput): Promise<IssuedLicense> {
  return callServer<IssuedLicense>('/api/issue', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function revokeLicense(licenseId: string): Promise<{ ok: boolean }> {
  return callServer<{ ok: boolean }>('/api/revoke', {
    method: 'POST',
    body: JSON.stringify({ licenseId }),
  })
}

export async function unrevokeLicense(licenseId: string): Promise<{ ok: boolean }> {
  return callServer<{ ok: boolean }>('/api/unrevoke', {
    method: 'POST',
    body: JSON.stringify({ licenseId }),
  })
}

export async function deactivateDevice(
  licenseId: string,
  fingerprint: string
): Promise<{ ok: boolean }> {
  return callServer<{ ok: boolean }>('/api/deactivate', {
    method: 'POST',
    body: JSON.stringify({ licenseId, fingerprint }),
  })
}
