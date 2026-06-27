import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

const SESSION_SECRET = process.env.DATABASE_URL || 'kiosko-app-secret-key-2024'
const SESSION_COOKIE_NAME = 'kiosko-session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function signToken(payload: string): string {
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('hex')
  return `${payload}.${signature}`
}

function verifyToken(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [payload, signature] = parts
  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('hex')

  if (signature !== expectedSignature) return null

  return payload
}

export function createSessionToken(userId: string): string {
  const timestamp = Date.now()
  const payload = `${userId}:${timestamp}`
  return signToken(payload)
}

export function getUserIdFromToken(token: string): string | null {
  const payload = verifyToken(token)
  if (!payload) return null

  const [userId, timestampStr] = payload.split(':')
  const timestamp = parseInt(timestampStr, 10)

  // Check if session has expired
  if (Date.now() - timestamp > SESSION_MAX_AGE * 1000) return null

  return userId
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!rawToken) return null
  // Cookie values may be URL-encoded by the browser (e.g., %3A for :)
  const token = decodeURIComponent(rawToken)
  return getUserIdFromToken(token)
}

export interface SessionUser {
  id: string
  username: string
  name: string
  email: string | null
  phone: string | null
  roleId: string
  role: { id: string; name: string }
  permissions: string[]
  isActive: boolean
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const userId = await getSessionUserId()
  if (!userId) return null

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      role: { select: { id: true, name: true, permissions: true } },
    },
  })

  if (!user || !user.isActive) return null

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    phone: user.phone,
    roleId: user.roleId,
    role: { id: user.role.id, name: user.role.name },
    permissions: JSON.parse(user.role.permissions),
    isActive: user.isActive,
  }
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

/**
 * Verify a password against a stored hash.
 * Supports:
 * - bcrypt hashes (new format, start with $2a$, $2b$, $2y$)
 * - base64-encoded passwords (legacy format, for backward compatibility)
 */
export async function verifyPassword(inputPassword: string, storedPassword: string): Promise<boolean> {
  // Check if it's a bcrypt hash
  if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
    return bcrypt.compare(inputPassword, storedPassword)
  }

  // Legacy: base64-encoded password
  const inputEncoded = Buffer.from(inputPassword).toString('base64')
  return inputEncoded === storedPassword
}
