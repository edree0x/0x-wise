import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { UnauthorizedError, requireUser, type SessionUser, verifyCsrfToken } from './auth'

export function json(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, {
    ...init,
    headers: { 'cache-control': 'no-store', ...(init?.headers ?? {}) },
  })
}

export async function withUser(
  handler: (user: SessionUser) => Promise<Response> | Response,
): Promise<Response> {
  try {
    const user = await requireUser()
    return await handler(user)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return json({ error: 'Sign in first' }, { status: 401 })
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return json({ error: message }, { status: 500 })
  }
}

export async function withUserAndCsrf(
  request: Request,
  handler: (user: SessionUser) => Promise<Response> | Response,
): Promise<Response> {
  try {
    const user = await requireUser()
    // Skip CSRF check for Bearer token requests (API tokens)
    const authHeader = request.headers.get('authorization')
    const hasBearerToken = authHeader?.toLowerCase().startsWith('bearer ')
    if (!hasBearerToken) {
      const cookieStore = await cookies()
      if (!verifyCsrfToken(request, cookieStore)) {
        return json({ error: 'Invalid CSRF token' }, { status: 403 })
      }
    }
    return await handler(user)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return json({ error: 'Sign in first' }, { status: 401 })
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return json({ error: message }, { status: 500 })
  }
}

export function noStore(): HeadersInit {
  return { 'cache-control': 'no-store' }
}
