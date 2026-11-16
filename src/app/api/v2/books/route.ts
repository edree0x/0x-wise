import { bearerToken, userFromApiToken } from '@/lib/auth'
import { readwiseV2Books } from '@/lib/export'
import { json } from '@/lib/http'

export async function GET(request: Request) {
  const token =
    bearerToken(request) ??
    request.headers.get('x-api-token') ??
    new URL(request.url).searchParams.get('access_token') ??
    undefined
  if (!userFromApiToken(token)) return json({ detail: 'Invalid token' }, { status: 401 })
  return json(readwiseV2Books())
}
