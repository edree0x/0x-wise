import { bearerToken, userFromApiToken } from '@/lib/auth'
import { readwiseV2Books, readwiseV2Response } from '@/lib/export'
import { json } from '@/lib/http'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = bearerToken(request) ?? request.headers.get('x-api-token') ?? undefined
  if (!userFromApiToken(token)) return json({ detail: 'Invalid token' }, { status: 401 })
  if (url.pathname.includes('/books')) return json(readwiseV2Books())
  return json(readwiseV2Response({ pageSize: 1000 }))
}
