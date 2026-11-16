import { randomBytes } from 'node:crypto'
import { findDocByUrl, insertDoc, insertHighlight, setMeta } from '@/lib/db'
import { getState } from '@/lib/state'
import type { Doc, Highlight } from '@/dashboard/types'
import { parseReadwiseCsv } from '@/lib/export'
import { json, withUser } from '@/lib/http'

const COLORS = ['clay', 'sage', 'ink', 'sky', 'sand', 'moss', 'rose', 'slate']
const DAY = 86_400_000

export async function POST(request: Request) {
  return withUser(async () => {
    let csv = ''
    const contentType = request.headers.get('content-type') ?? ''
    try {
      if (contentType.includes('multipart/form-data')) {
        const form = await request.formData()
        const file = form.get('file')
        if (file instanceof File) csv = await file.text()
      } else {
        const body = (await request.json()) as { csv?: string }
        csv = body.csv ?? ''
      }
    } catch {
      return json({ error: 'Send the Readwise CSV as a file field named "file"' }, { status: 400 })
    }

    const rows = parseReadwiseCsv(csv)
    if (!rows.length) {
      return json(
        { error: 'No highlights found. Export CSV from Readwise and make sure it has a "Highlight" column.' },
        { status: 422 },
      )
    }

    const state = getState()
    const byTitle = new Map<string, Doc>()
    for (const doc of state.docs) byTitle.set(`${doc.title}|${doc.author}`.toLowerCase(), doc)

    let addedDocs = 0
    let addedHighlights = 0
    const now = new Date().toISOString()

    for (const [index, row] of rows.entries()) {
      let doc = row.url ? findDocByUrl(row.url) : null
      if (!doc) {
        const key = `${row.title}|${row.author}`.toLowerCase()
        doc = byTitle.get(key) ?? null
      }
      if (!doc) {
        doc = {
          id: `doc-${randomBytes(8).toString('hex')}`,
          title: row.title || 'Readwise import',
          author: row.author || 'Unknown',
          source: 'Readwise',
          url: row.url,
          category: 'Book',
          addedAt: row.highlightedAt,
          minutes: 1,
          progress: 0,
          favorite: false,
          archived: false,
          color: COLORS[addedDocs % COLORS.length],
          summary: 'Imported from Readwise',
          content: [],
          tags: [],
          kind: 'book',
          status: 'ready',
          transcript: [],
          chapters: [],
        }
        insertDoc(doc)
        byTitle.set(`${doc.title}|${doc.author}`.toLowerCase(), doc)
        addedDocs += 1
      }

      const highlight: Highlight = {
        id: `hl-${randomBytes(8).toString('hex')}`,
        docId: doc.id,
        text: row.text,
        note: row.note,
        tags: row.tags,
        createdAt: row.highlightedAt,
        favorite: false,
        color: 'yellow',
        lastReviewed: null,
        reviewCount: 0,
        dueAt: new Date(Date.now() + (index % 30) * DAY).toISOString(),
        intervalDays: 0,
        ease: 2.5,
        lapses: 0,
        source: 'import',
      }
      insertHighlight(highlight)
      addedHighlights += 1
    }

    const imports = state.imports
    imports.unshift({
      id: `import-${randomBytes(6).toString('hex')}`,
      name: 'Readwise CSV',
      date: now,
      count: addedHighlights,
    })
    setMeta('imports', imports.slice(0, 12))

    return json({ ok: true, counts: { docs: addedDocs, highlights: addedHighlights }, data: getState() })
  })
}
