import { findDocByUrl, getDoc } from '@/lib/db'
import { createBookmarkDoc, ingestIntoDoc } from '@/lib/extract'
import { json, withUser } from '@/lib/http'

export const maxDuration = 60

export async function POST(request: Request) {
  return withUser(async () => {
    let body: { url?: string; docId?: string; title?: string }
    try {
      body = (await request.json()) as { url?: string; docId?: string; title?: string }
    } catch {
      return json({ error: 'Invalid JSON' }, { status: 400 })
    }

    let docId = body.docId
    let url = body.url?.trim() ?? ''

    if (docId) {
      const doc = getDoc(docId)
      if (!doc) return json({ error: 'Document not found' }, { status: 404 })
      url = url || doc.url
      if (!url) return json({ error: 'This document has no link' }, { status: 400 })
    } else {
      if (!url) return json({ error: 'Paste a link first' }, { status: 400 })
      const existing = findDocByUrl(url)
      if (existing) {
        docId = existing.id
      } else {
        const doc = createBookmarkDoc({ title: body.title?.trim() || url, url })
        docId = doc.id
      }
    }

    const result = await ingestIntoDoc(docId, url)
    return json({
      ok: result.ok,
      id: docId,
      error: result.error,
      doc: getDoc(docId),
    })
  })
}
