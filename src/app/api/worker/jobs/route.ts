import { completeJob, claimJob, failJob, queueStats, recoverRunningJobs } from '@/lib/jobs'
import { json } from '@/lib/http'
import type { TranscriptSegment } from '@/dashboard/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(request: Request): boolean {
  const expected = process.env.OXW_CRON_TOKEN
  if (!expected) return true
  return request.headers.get('x-cron-token') === expected
}

export async function GET(request: Request) {
  if (!authorized(request)) return json({ error: 'Bad worker token' }, { status: 401 })
  if (new URL(request.url).searchParams.get('recover') === '1') {
    const recovered = recoverRunningJobs()
    return json({ ok: true, recovered, queue: queueStats() })
  }
  const claimed = claimJob()
  if (!claimed) return json({ job: null, queue: queueStats() })
  return json({
    job: claimed.job,
    doc: claimed.doc
      ? {
          id: claimed.doc.id,
          title: claimed.doc.title,
          source: claimed.doc.source,
          url: claimed.doc.url,
          audioUrl: claimed.doc.audioUrl ?? null,
          durationSec: claimed.doc.durationSec ?? null,
          kind: claimed.doc.kind ?? 'article',
        }
      : null,
    queue: queueStats(),
  })
}

export async function POST(request: Request) {
  if (!authorized(request)) return json({ error: 'Bad worker token' }, { status: 401 })

  let body: {
    id?: string
    ok?: boolean
    transcript?: TranscriptSegment[]
    audioFile?: string
    audioUrl?: string
    durationSec?: number
    lang?: string
    text?: string
    error?: string
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const id = (body.id ?? '').trim()
  if (!id) return json({ error: 'Missing job id' }, { status: 400 })

  if (body.ok === false) {
    const job = failJob(id, body.error ?? 'Worker failed')
    return job ? json({ ok: true, job, queue: queueStats() }) : json({ error: 'Job not found' }, { status: 404 })
  }

  const audioFile = (body.audioFile ?? '').trim()
  const audioUrl =
    body.audioUrl ?? (audioFile ? `/api/media/${encodeURIComponent(audioFile)}` : undefined)

  const job = completeJob(id, {
    transcript: body.transcript,
    audioUrl,
    durationSec: body.durationSec,
    lang: body.lang,
    text: body.text,
  })
  return job ? json({ ok: true, job, queue: queueStats() }) : json({ error: 'Job not found' }, { status: 404 })
}
