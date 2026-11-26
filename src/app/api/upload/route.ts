import { randomBytes } from 'node:crypto'
import { insertDoc } from '@/lib/db'
import { parseEpub } from '@/lib/epub'
import { parsePdf } from '@/lib/pdf'
import { json, withUserAndCsrf } from '@/lib/http'
import type { Doc } from '@/dashboard/types'

export const maxDuration = 120
const MAX_BYTES = 40 * 1024 * 1024
const COLORS = ['clay', 'sage', 'ink', 'sky', 'sand', 'moss', 'rose', 'slate']

export async function POST(request: Request) {
  return withUserAndCsrf(request, async () => {
    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return json({ error: 'Send a file as multipart/form-data' }, { status: 400 })
    }
    const file = form.get('file')
    if (!(file instanceof File)) return json({ error: 'No file uploaded' }, { status: 400 })
    if (file.size > MAX_BYTES) return json({ error: 'File is larger than 40 MB' }, { status: 413 })

    const name = file.name.toLowerCase()
    const buffer = Buffer.from(await file.arrayBuffer())
    const id = `doc-${randomBytes(8).toString('hex')}`
    const now = new Date().toISOString()

    try {
      if (name.endsWith('.epub')) {
        const book = await parseEpub(buffer)
        const doc: Doc = {
          id,
          title: book.title,
          author: book.author,
          source: 'EPUB upload',
          url: `file://${encodeURIComponent(file.name)}-${id}`,
          category: 'Book',
          addedAt: now,
          minutes: Math.max(1, Math.round(book.content.join(' ').split(/\s+/).filter(Boolean).length / 220)),
          progress: 0,
          favorite: false,
          archived: false,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          summary: `Imported EPUB · ${book.chapters.length} chapters`,
          content: book.content,
          tags: [],
          kind: 'epub',
          cover: book.cover && book.cover.length < 400_000 ? book.cover : undefined,
          chapters: book.chapters,
          status: 'ready',
          transcript: [],
        }
        insertDoc(doc)
        return json({ ok: true, id })
      }

      if (name.endsWith('.pdf')) {
        const parsed = await parsePdf(buffer, file.name.replace(/\.pdf$/i, ''))
        const chapters: { title: string; start: number }[] = []
        parsed.content.forEach((block, index) => {
          if (block.startsWith('## Page ')) chapters.push({ title: block.slice(3), start: index })
        })
        const doc: Doc = {
          id,
          title: parsed.title,
          author: 'Unknown',
          source: 'PDF upload',
          url: `file://${encodeURIComponent(file.name)}-${id}`,
          category: 'PDF',
          addedAt: now,
          minutes: Math.max(1, Math.round(parsed.content.join(' ').split(/\s+/).filter(Boolean).length / 220)),
          progress: 0,
          favorite: false,
          archived: false,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          summary: `Imported PDF · ${parsed.pages} pages`,
          content: parsed.content,
          tags: [],
          kind: 'pdf',
          chapters,
          status: 'ready',
          transcript: [],
        }
        insertDoc(doc)
        return json({ ok: true, id })
      }

      return json({ error: 'Only .epub and .pdf files are supported' }, { status: 415 })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not read that file'
      return json({ error: message }, { status: 422 })
    }
  })
}
