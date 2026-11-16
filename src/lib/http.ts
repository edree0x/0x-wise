import { NextResponse } from 'next/server'
import { UnauthorizedError, requireUser, type SessionUser } from './auth'

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

export function noStore(): HeadersInit {
  return { 'cache-control': 'no-store' }
}
