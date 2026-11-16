import { pollAllSources } from '@/lib/feeds'
import { json } from '@/lib/http'

export const maxDuration = 120

function authorized(request: Request): boolean {
  const expected = process.env.OXW_CRON_TOKEN
  if (!expected) return true
  const url = new URL(request.url)
  return request.headers.get('x-cron-token') === expected || url.searchParams.get('token') === expected
}

export async function GET(request: Request) {
  if (!authorized(request)) return json({ error: 'Bad cron token' }, { status: 401 })
  const results = await pollAllSources()
  return json({ ok: true, results })
}

export async function POST(request: Request) {
  return GET(request)
}
