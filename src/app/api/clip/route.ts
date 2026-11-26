import { randomBytes } from 'node:crypto'
import { bearerToken, currentUser, userFromApiToken } from '@/lib/auth'
import { findDocByUrl, insertHighlight } from '@/lib/db'
import { createBookmarkDoc } from '@/lib/extract'
import { json, withUser, withUserAndCsrf } from '@/lib/http'
import type { Highlight } from '@/dashboard/types'

async function authenticate(request: Request) {
  const token = bearerToken(request)
  const apiUser = userFromApiToken(token)
  if (apiUser) return apiUser
  return currentUser()
}

// Determine if request uses Bearer token (API token) for CSRF exemption
function usesApiToken(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ') === true || request.headers.has('x-api-token')
}

export async function POST(request: Request) {
  // API token requests are exempt from CSRF; cookie requests require CSRF
  if (usesApiToken(request)) {
    return withUser(async () => {
      let body: { url?: string; title?: string; text?: string; note?: string; color?: Highlight['color'] }
      try {
        body = (await request.json()) as typeof body
      } catch {
        return json({ error: 'Invalid JSON' }, { status: 400 })
      }
      const url = (body.url ?? '').trim()
      const text = (body.text ?? '').trim()
      if (!url) return json({ error: 'Missing url' }, { status: 400 })

      let doc = findDocByUrl(url)
      if (!doc) {
        doc = createBookmarkDoc({
          title: body.title?.trim() || url,
          url,
          summary: 'Saved with the browser extension.',
        })
      }

      let highlightId: string | null = null
      if (text) {
        const now = new Date().toISOString()
        const highlight: Highlight = {
          id: `hl-${randomBytes(8).toString('hex')}`,
          docId: doc.id,
          text,
          note: (body.note ?? '').trim(),
          tags: [],
          createdAt: now,
          favorite: false,
          color: body.color ?? 'yellow',
          lastReviewed: null,
          reviewCount: 0,
          dueAt: now,
          intervalDays: 0,
          ease: 2.5,
          lapses: 0,
          source: 'extension',
        }
        insertHighlight(highlight)
        highlightId = highlight.id
      }

      return json({ ok: true, docId: doc.id, highlightId })
    })
  }
  return withUserAndCsrf(request, async () => {
    let body: { url?: string; title?: string; text?: string; note?: string; color?: Highlight['color'] }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const url = (body.url ?? '').trim()
    const text = (body.text ?? '').trim()
    if (!url) return json({ error: 'Missing url' }, { status: 400 })

    let doc = findDocByUrl(url)
    if (!doc) {
      doc = createBookmarkDoc({
        title: body.title?.trim() || url,
        url,
        summary: 'Saved with the browser extension.',
      })
    }

    let highlightId: string | null = null
    if (text) {
      const now = new Date().toISOString()
      const highlight: Highlight = {
        id: `hl-${randomBytes(8).toString('hex')}`,
        docId: doc.id,
        text,
        note: (body.note ?? '').trim(),
        tags: [],
        createdAt: now,
        favorite: false,
        color: body.color ?? 'yellow',
        lastReviewed: null,
        reviewCount: 0,
        dueAt: now,
        intervalDays: 0,
        ease: 2.5,
        lapses: 0,
        source: 'extension',
      }
      insertHighlight(highlight)
      highlightId = highlight.id
    }

    return json({ ok: true, docId: doc.id, highlightId })
  })
}

export async function GET() {
  return json({
    ok: true,
    usage: 'POST { url, title, text, note } with Authorization: Bearer <token>',
  })
}
