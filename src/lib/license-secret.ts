// Shared license-cookie secret.
//
// This is imported by BOTH the Edge middleware (src/middleware.ts) and the
// Node route handlers (src/lib/license-cookie.ts). It MUST NOT import any
// server-only modules (next/headers, fs, etc.) so it stays Edge-safe.
//
// The cookie protected by this secret is only a fast cache of the license
// state — the real protection is the Ed25519 signature verified by the
// server-side license lib. Still, rotate this value for production deployments.

export const LICENSE_COOKIE_SECRET =
  process.env.LICENSE_COOKIE_SECRET || 'kiosko-license-cookie-secret-2025-do-not-ship-as-is'
