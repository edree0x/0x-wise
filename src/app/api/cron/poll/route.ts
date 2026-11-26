import { pollAllSources } from '@/lib/feeds'
import { json } from '@/lib/http'
import { timingSafeEqual } from 'node:crypto'

export const maxDuration = 120

function authorized(request: Request): boolean {
  const expected = process.env.OXW_CRON_TOKEN
  if (!expected) {
    throw new Error('OXW_CRON_TOKEN is not set. This endpoint requires a cron token.')
  }
  const provided = request.headers.get('x-cron-token')
  if (!provided) return false
  const providedBuf = Buffer.from(provided)
  const expectedBuf = Buffer.from(expected)
  if (providedBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(providedBuf, expectedBuf)
}

export async function GET(request: Request) {
  if (!authorized(request)) return json({ error: 'Bad cron token' }, { status: 401 })
  const results = await pollAllSources()
  return json({ ok: true, results })
}

export async function POST(request: Request) {
  return GET(request)
}
