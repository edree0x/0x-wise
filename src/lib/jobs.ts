import { randomBytes } from 'node:crypto'
import { db, getDoc, nowIso, updateDocRow } from './db'
import type { Doc, TranscriptSegment } from '@/dashboard/types'

export type Job = {
  id: string
  kind: string
  payload: Record<string, unknown>
  status: string
  attempts: number
  runAt: string
  startedAt: string | null
  finishedAt: string | null
  error: string | null
  createdAt: string
}

type JobRow = {
  id: string
  kind: string
  payload: string
  status: string
  attempts: number
  run_at: string
  started_at: string | null
  finished_at: string | null
  error: string | null
  created_at: string
}

function toJob(row: JobRow): Job {
  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(row.payload) as Record<string, unknown>
  } catch {
    payload = {}
  }
  return {
    id: row.id,
    kind: row.kind,
    payload,
    status: row.status,
    attempts: Number(row.attempts),
    runAt: row.run_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    error: row.error,
    createdAt: row.created_at,
  }
}

/** Work a single queued job. One worker is assumed; the conditional update
 * still makes a second process lose the race instead of running twice. */
export function claimJob(): { job: Job; doc: Doc | null } | null {
  const row = db()
    .prepare(
      "SELECT * FROM jobs WHERE status = 'queued' AND run_at <= ? ORDER BY run_at, created_at LIMIT 1",
    )
    .get(nowIso()) as JobRow | undefined
  if (!row) return null

  const claimed = db()
    .prepare("UPDATE jobs SET status = 'running', attempts = attempts + 1, started_at = ? WHERE id = ? AND status = 'queued'")
    .run(nowIso(), row.id)
  if (Number(claimed.changes) === 0) return null

  const job = toJob(row)
  const docId = typeof job.payload.docId === 'string' ? job.payload.docId : ''
  return { job, doc: docId ? getDoc(docId) : null }
}

export function completeJob(
  id: string,
  input: {
    transcript?: TranscriptSegment[]
    audioUrl?: string
    durationSec?: number
    lang?: string
    text?: string
  },
): Job | null {
  const row = db().prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow | undefined
  if (!row) return null
  const job = toJob(row)
  const docId = typeof job.payload.docId === 'string' ? job.payload.docId : ''
  const doc = docId ? getDoc(docId) : null

  if (doc) {
    const transcript = Array.isArray(input.transcript)
      ? input.transcript
          .filter((segment) => segment && typeof segment.text === 'string')
          .map((segment) => ({
            start: Math.max(0, Number(segment.start) || 0),
            end: Math.max(0, Number(segment.end) || 0),
            text: segment.text.trim(),
            ...(segment.speaker ? { speaker: segment.speaker } : {}),
          }))
          .filter((segment) => segment.text)
      : (doc.transcript ?? [])

    const patch: Partial<Doc> = {
      transcript,
      status: 'ready',
      error: undefined,
    }
    if (input.audioUrl) patch.audioUrl = input.audioUrl
    if (input.durationSec && input.durationSec > 0) {
      patch.durationSec = Math.round(input.durationSec)
      patch.minutes = Math.max(1, Math.round(input.durationSec / 60))
    }
    if (input.lang) patch.lang = input.lang
    if (!doc.summary && transcript.length) {
      patch.summary = transcript
        .slice(0, 2)
        .map((segment) => segment.text)
        .join(' ')
        .slice(0, 280)
    }
    updateDocRow(doc.id, patch)
  }

  db()
    .prepare("UPDATE jobs SET status = 'done', finished_at = ?, error = NULL WHERE id = ?")
    .run(nowIso(), id)
  return toJob({ ...row, status: 'done', finished_at: nowIso(), error: null })
}

export function failJob(id: string, error: string): Job | null {
  const row = db().prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow | undefined
  if (!row) return null
  const job = toJob(row)
  const message = error.trim().slice(0, 800) || 'Job failed'
  db()
    .prepare("UPDATE jobs SET status = 'failed', finished_at = ?, error = ? WHERE id = ?")
    .run(nowIso(), message, id)

  const docId = typeof job.payload.docId === 'string' ? job.payload.docId : ''
  if (docId) updateDocRow(docId, { status: 'error', error: message })
  return toJob({ ...row, status: 'failed', finished_at: nowIso(), error: message })
}

/** Put interrupted jobs back in the queue. There is exactly one worker, so at
 * startup nothing can legitimately be running: anything marked running was cut
 * short by a restart or crash. */
export function recoverRunningJobs(): number {
  const result = db()
    .prepare("UPDATE jobs SET status = 'queued', started_at = NULL WHERE status = 'running'")
    .run()
  return Number(result.changes)
}

export function queueStats(): { queued: number; running: number; failed: number; done: number } {
  const rows = db()
    .prepare('SELECT status, COUNT(*) AS n FROM jobs GROUP BY status')
    .all() as { status: string; n: number }[]
  const stats = { queued: 0, running: 0, failed: 0, done: 0 }
  for (const row of rows) {
    if (row.status in stats) stats[row.status as keyof typeof stats] = Number(row.n)
  }
  return stats
}

export function newJobId(): string {
  return `job-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
}
