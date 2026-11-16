import { bearerToken, userFromApiToken } from '@/lib/auth'
import { readwiseV2Books, readwiseV2Response } from '@/lib/export'
import { json } from '@/lib/http'

function token(request: Request): string | undefined {
  const header = request.headers.get('authorization')
  if (header) {
    const match = header.match(/^(?:bearer|token)\s+(.+)$/i)
    if (match) return match[1].trim()
  }
  return (
    request.headers.get('x-api-token') ??
    bearerToken(request) ??
    new URL(request.url).searchParams.get('access_token') ??
    undefined
  )
}

function authorized(request: Request): boolean {
  return Boolean(userFromApiToken(token(request)))
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (!authorized(request)) {
    return json({ detail: 'Invalid token' }, { status: 401 })
  }
  if (url.pathname.endsWith('/books')) return json(readwiseV2Books())
  if (url.pathname.endsWith('/export')) return json(readwiseV2Response({ pageSize: 1000 }))

  const updatedAfter = url.searchParams.get('updatedAfter') ?? undefined
  const page = Number(url.searchParams.get('page') ?? '1')
  const pageSize = Number(url.searchParams.get('page_size') ?? url.searchParams.get('pageSize') ?? '100')
  return json(readwiseV2Response({ updatedAfter, page, pageSize }))
}
