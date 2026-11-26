import { cookies } from 'next/headers'
import { login, logout, SESSION_COOKIE, CSRF_COOKIE, sessionCookieOptions, csrfCookieOptions } from '@/lib/auth'
import { json } from '@/lib/http'

export async function POST(request: Request) {
  let body: { email?: string; password?: string }
  try {
    body = (await request.json()) as { email?: string; password?: string }
  } catch {
    return json({ error: 'Invalid request' }, { status: 400 })
  }
  const result = login(body.email ?? '', body.password ?? '')
  if (!result) return json({ error: 'Wrong email or password' }, { status: 401 })
  const store = await cookies()
  store.set(sessionCookieOptions(result.token))
  store.set(csrfCookieOptions(result.csrfToken))
  return json({ ok: true })
}

export async function DELETE() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  logout(token)
  store.delete(SESSION_COOKIE)
  store.delete(CSRF_COOKIE)
  return json({ ok: true })
}
