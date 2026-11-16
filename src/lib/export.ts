import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Doc, Highlight } from '@/dashboard/types'
import { getState } from './state'

function frontmatterValue(value: string): string {
  return JSON.stringify(value.replace(/\r?\n/g, ' '))
}

export function slugify(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'untitled'
  )
}

export function docToMarkdown(doc: Doc, highlights: Highlight[], options: { wikilinks?: boolean } = {}): string {
  const lines: string[] = []
  lines.push('---')
  lines.push(`title: ${frontmatterValue(doc.title)}`)
  lines.push(`author: ${frontmatterValue(doc.author)}`)
  lines.push(`source: ${frontmatterValue(doc.source)}`)
  lines.push(`category: ${doc.category}`)
  if (doc.url) lines.push(`url: ${frontmatterValue(doc.url)}`)
  if (doc.kind) lines.push(`kind: ${doc.kind}`)
  if (doc.publishedAt) lines.push(`published: ${doc.publishedAt}`)
  lines.push(`added: ${doc.addedAt}`)
  if (doc.tags.length) lines.push(`tags: [${doc.tags.map((tag) => frontmatterValue(tag)).join(', ')}]`)
  lines.push('---')
  lines.push('')
  lines.push(`# ${doc.title}`)
  lines.push('')

  if (doc.summary) {
    lines.push(`> ${doc.summary}`)
    lines.push('')
  }

  const docHighlights = highlights.filter((highlight) => highlight.docId === doc.id)
  if (docHighlights.length) {
    lines.push('## Highlights')
    lines.push('')
    for (const highlight of docHighlights) {
      lines.push(`> ${highlight.text.replace(/\n/g, '\n> ')}`)
      lines.push('')
      if (highlight.note) {
        lines.push(`**Note:** ${highlight.note}`)
        lines.push('')
      }
      if (highlight.location?.type === 'audio') {
        lines.push(`_at ${formatTimestamp(highlight.location.startMs)}_`)
        lines.push('')
      }
      if (highlight.tags.length) {
        lines.push(highlight.tags.map((tag) => `#${tag.replace(/\s+/g, '-')}`).join(' '))
        lines.push('')
      }
    }
  }

  if (options.wikilinks) {
    lines.push('## Source')
    lines.push('')
    lines.push(`- Author: ${options.wikilinks ? `[[${doc.author}]]` : doc.author}`)
    lines.push(`- Source: ${options.wikilinks ? `[[${doc.source}]]` : doc.source}`)
    if (doc.url) lines.push(`- [Original](${doc.url})`)
    lines.push('')
  }

  return lines.join('\n')
}

export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

export function libraryToMarkdown(): string {
  const state = getState()
  const lines: string[] = ['# 0x wise library', '', `Exported ${new Date().toISOString()}`, '']
  for (const doc of state.docs) {
    lines.push(docToMarkdown(doc, state.highlights, { wikilinks: true }))
    lines.push('\n---\n')
  }
  return lines.join('\n')
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function highlightsToCsv(highlights: Highlight[], docs: Doc[]): string {
  const rows = [
    ['Text', 'Note', 'Title', 'Author', 'Source', 'URL', 'Tags', 'Color', 'Created', 'Last reviewed', 'Reviews'],
  ]
  for (const highlight of highlights) {
    const doc = docs.find((item) => item.id === highlight.docId)
    rows.push([
      highlight.text,
      highlight.note,
      doc?.title ?? '',
      doc?.author ?? '',
      doc?.source ?? '',
      doc?.url ?? '',
      highlight.tags.join(', '),
      highlight.color,
      highlight.createdAt,
      highlight.lastReviewed ?? '',
      String(highlight.reviewCount),
    ])
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function writeObsidianVault(dir: string): { files: number; dir: string } {
  const state = getState()
  const target = path.isAbsolute(dir)
    ? dir
    : path.join(/* turbopackIgnore: true */ process.cwd(), dir)
  mkdirSync(target, { recursive: true })
  let files = 0
  const used = new Set<string>()
  for (const doc of state.docs) {
    let name = slugify(doc.title)
    if (used.has(name)) name = `${name}-${doc.id.slice(-6)}`
    used.add(name)
    const markdown = docToMarkdown(doc, state.highlights, { wikilinks: true })
    writeFileSync(path.join(target, `${name}.md`), markdown, 'utf8')
    files += 1
  }
  writeFileSync(
    path.join(target, '0x wise index.md'),
    `# 0x wise\n\n${state.docs.length} documents · ${state.highlights.length} highlights\n\n${state.docs
      .map((doc) => `- [[${slugify(doc.title)}|${doc.title}]]`)
      .join('\n')}\n`,
    'utf8',
  )
  return { files: files + 1, dir: target }
}

export type ReadwiseHighlight = {
  id: string
  text: string
  note: string
  highlight_color: string | null
  location: number | null
  location_type: string
  highlighted_at: string
  created_at: string
  updated_at: string
  url: string | null
  book_id: string
  tags: { id: string; name: string }[]
  is_favorite: boolean
}

export function readwiseV2Response(options: { updatedAfter?: string; page?: number; pageSize?: number } = {}) {
  const state = getState()
  const pageSize = Math.min(1000, Math.max(1, options.pageSize ?? 100))
  const page = Math.max(1, options.page ?? 1)
  const updatedAfter = options.updatedAfter ? new Date(options.updatedAfter).getTime() : 0

  const filtered = state.highlights.filter((highlight) => {
    if (!updatedAfter) return true
    return new Date(highlight.lastReviewed ?? highlight.createdAt).getTime() >= updatedAfter
  })

  const start = (page - 1) * pageSize
  const slice = filtered.slice(start, start + pageSize)
  const docMap = new Map(state.docs.map((doc) => [doc.id, doc]))

  const results: ReadwiseHighlight[] = slice.map((highlight) => {
    const doc = docMap.get(highlight.docId)
    return {
      id: highlight.id,
      text: highlight.text,
      note: highlight.note,
      highlight_color:
        highlight.color === 'yellow'
          ? 'yellow'
          : highlight.color === 'blue'
            ? 'blue'
            : highlight.color === 'green'
              ? 'green'
              : 'pink',
      location: null,
      location_type: 'page',
      highlighted_at: highlight.createdAt,
      created_at: highlight.createdAt,
      updated_at: highlight.lastReviewed ?? highlight.createdAt,
      url: doc?.url || null,
      book_id: highlight.docId,
      tags: highlight.tags.map((tag, index) => ({ id: `${highlight.id}-${index}`, name: tag })),
      is_favorite: highlight.favorite,
    }
  })

  return {
    count: results.length,
    nextPageCursor: start + pageSize < filtered.length ? String(page + 1) : null,
    results,
  }
}

export function readwiseV2Books() {
  const state = getState()
  const counts = new Map<string, number>()
  for (const highlight of state.highlights) {
    counts.set(highlight.docId, (counts.get(highlight.docId) ?? 0) + 1)
  }
  return {
    count: state.docs.length,
    nextPageCursor: null,
    results: state.docs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      author: doc.author,
      category: doc.category.toLowerCase(),
      source: doc.source,
      num_highlights: counts.get(doc.id) ?? 0,
      last_highlight_at: doc.addedAt,
      updated_at: doc.addedAt,
      cover_image_url: doc.cover ?? null,
      highlights_url: null,
      source_url: doc.url || null,
      asin: null,
      tags: doc.tags.map((tag, index) => ({ id: `${doc.id}-${index}`, name: tag })),
    })),
  }
}

export function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index += 1
      row.push(cell)
      if (row.some((value) => value.length)) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  if (cell.length || row.length) {
    row.push(cell)
    if (row.some((value) => value.length)) rows.push(row)
  }
  return rows
}

export type ReadwiseImportRow = {
  text: string
  note: string
  title: string
  author: string
  url: string
  tags: string[]
  highlightedAt: string
}

export function parseReadwiseCsv(input: string): ReadwiseImportRow[] {
  const rows = parseCsv(input)
  if (!rows.length) return []
  const header = rows[0].map((value) => value.trim().toLowerCase())
  const idx = (name: string) => header.indexOf(name)
  const textIndex = idx('highlight')
  if (textIndex === -1) return []
  const noteIndex = idx('note')
  const titleIndex = idx('title')
  const authorIndex = idx('author')
  const urlIndex = idx('url')
  const tagsIndex = idx('tags')
  const dateIndex = idx('highlighted at')

  return rows
    .slice(1)
    .map((row) => ({
      text: (row[textIndex] ?? '').trim(),
      note: noteIndex >= 0 ? (row[noteIndex] ?? '').trim() : '',
      title: titleIndex >= 0 ? (row[titleIndex] ?? '').trim() : 'Readwise import',
      author: authorIndex >= 0 ? (row[authorIndex] ?? '').trim() : 'Unknown',
      url: urlIndex >= 0 ? (row[urlIndex] ?? '').trim() : '',
      tags:
        tagsIndex >= 0
          ? (row[tagsIndex] ?? '')
              .split(/[,;]/)
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [],
      highlightedAt: dateIndex >= 0 && row[dateIndex] ? new Date(row[dateIndex]).toISOString() : new Date().toISOString(),
    }))
    .filter((row) => row.text.length > 0)
}
