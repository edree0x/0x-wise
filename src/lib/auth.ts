import { randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { auditLog, db, hashToken, nowIso, verifyPassword } from './db'

export const SESSION_COOKIE = 'oxw_session'
export const CSRF_COOKIE = 'oxw_csrf'
const SESSION_DAYS = 60

export type SessionUser = { id: string; email: string }

type UserRow = { id: string; email: string; password_hash: string; salt: string }

function generateCsrfToken(): string {
  return randomBytes(32).toString('hex')
}

export function login(email: string, password: string): { token: string; csrfToken: string } | null {
  const user = db()
    .prepare('SELECT id, email, password_hash, salt FROM users WHERE lower(email) = lower(?)')
    .get(email.trim()) as UserRow | undefined
  if (!user) {
    auditLog('failedLogin', 'user-owner', { email: email.trim(), reason: 'user_not_found' })
    return null
  }
  if (!verifyPassword(password, user.salt, user.password_hash)) {
    auditLog('failedLogin', 'user-owner', { email: email.trim(), reason: 'invalid_password' })
    return null
  }

  const token = randomBytes(32).toString('hex')
  const csrfToken = generateCsrfToken()
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString()
  db()
    .prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), user.id, expires, nowIso())
  auditLog('login', user.id, { email: user.email })
  return { token, csrfToken }
}

export function logout(token: string | undefined): void {
  if (!token) return
  db().prepare('DELETE FROM sessions WHERE id = ?').run(hashToken(token))
}

export function userFromToken(token: string | undefined): SessionUser | null {
  if (!token) return null
  const row = db()
    .prepare(
      `SELECT users.id AS id, users.email AS email, sessions.expires_at AS expires_at
       FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.id = ?`,
    )
    .get(hashToken(token)) as { id: string; email: string; expires_at: string } | undefined
  if (!row) return null
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db().prepare('DELETE FROM sessions WHERE id = ?').run(hashToken(token))
    return null
  }
  return { id: row.id, email: row.email }
}

export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies()
  return userFromToken(store.get(SESSION_COOKIE)?.value)
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser()
  if (!user) throw new UnauthorizedError()
  return user
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'UnauthorizedError'
  }
}

/** API token auth for the extension and Readwise-compatible endpoints. */
export function userFromApiToken(token: string | undefined): SessionUser | null {
  if (!token) return null
  const row = db()
    .prepare(
      `SELECT users.id AS id, users.email AS email, api_tokens.id AS token_id
       FROM api_tokens JOIN users ON users.id = api_tokens.user_id WHERE api_tokens.token_hash = ?`,
    )
    .get(hashToken(token)) as { id: string; email: string; token_id: string } | undefined
  if (!row) return null
  db().prepare('UPDATE api_tokens SET last_used_at = ? WHERE id = ?').run(nowIso(), row.token_id)
  return { id: row.id, email: row.email }
}

export function bearerToken(request: Request): string | undefined {
  const header = request.headers.get('authorization')
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return request.headers.get('x-api-token') ?? undefined
}

export function createApiToken(userId: string, name: string): { token: string; id: string } {
  const token = `oxw_${randomBytes(24).toString('hex')}`
  const id = `tok-${randomBytes(6).toString('hex')}`
  db()
    .prepare('INSERT INTO api_tokens (id, user_id, name, token_hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, userId, name || 'token', hashToken(token), nowIso())
  auditLog('tokenCreate', userId, { tokenId: id, name: name || 'token' })
  return { token, id }
}

export function listApiTokens(): { id: string; name: string; createdAt: string; lastUsedAt: string | null }[] {
  const rows = db()
    .prepare('SELECT id, name, created_at, last_used_at FROM api_tokens ORDER BY created_at DESC')
    .all() as { id: string; name: string; created_at: string; last_used_at: string | null }[]
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }))
}

export function revokeApiToken(id: string): void {
  db().prepare('DELETE FROM api_tokens WHERE id = ?').run(id)
  auditLog('tokenRevoke', 'user-owner', { tokenId: id })
}

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
    secure: process.env.NODE_ENV === 'production' && process.env.OXW_INSECURE !== '1',
  }
}

export function csrfCookieOptions(csrfToken: string) {
  return {
    name: CSRF_COOKIE,
    value: csrfToken,
    httpOnly: false, // Must be readable by JavaScript for double-submit pattern
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
    secure: process.env.NODE_ENV === 'production' && process.env.OXW_INSECURE !== '1',
  }
}

export function verifyCsrfToken(request: Request, cookieStore: Awaited<ReturnType<typeof cookies>>): boolean {
  const headerToken = request.headers.get('x-csrf-token')
  if (!headerToken) return false
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value
  if (!cookieToken) return false
  return timingSafeEqual(Buffer.from(headerToken), Buffer.from(cookieToken))
}
