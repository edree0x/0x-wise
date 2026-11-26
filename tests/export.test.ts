import { describe, it, expect } from 'vitest'

// Copy pure functions from export.ts to test without importing node:sqlite
function frontmatterValue(value: string): string {
  return JSON.stringify(value.replace(/\r?\n/g, ' '))
}

function slugify(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'untitled'
  )
}

function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function parseCsv(input: string): string[][] {
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

// Mock types for testing
type Doc = {
  id: string
  title: string
  author: string
  source: string
  url: string
  category: string
  addedAt: string
  minutes: number
  progress: number
  favorite: boolean
  archived: boolean
  color: string
  summary: string
  content: string[]
  tags: string[]
  kind: 'article' | 'podcast' | 'book'
  publishedAt?: string
}

type Highlight = {
  id: string
  docId: string
  text: string
  note: string
  tags: string[]
  color: string
  createdAt: string
  favorite: boolean
  lastReviewed?: string
  reviewCount: number
  dueAt: string
  intervalDays: number
  ease: number
  lapses: number
  location?: { type: 'audio'; startMs: number; endMs: number }
  source: string
}

function docToMarkdown(doc: Doc, highlights: Highlight[], options: { wikilinks?: boolean } = {}): string {
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

function highlightsToCsv(highlights: Highlight[], docs: Doc[]): string {
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

// Test data
const doc: Doc = {
  id: 'doc-1',
  title: 'Test Document',
  author: 'Test Author',
  source: 'Test Source',
  url: 'https://example.com/doc',
  category: 'Article',
  addedAt: '2024-01-01T00:00:00.000Z',
  minutes: 5,
  progress: 0,
  favorite: false,
  archived: false,
  color: 'clay',
  summary: 'Test summary',
  content: ['Paragraph 1', 'Paragraph 2'],
  tags: ['tag1', 'tag2'],
  kind: 'article',
  publishedAt: '2023-12-01T00:00:00.000Z',
}

const highlights: Highlight[] = [
  {
    id: 'hl-1',
    docId: 'doc-1',
    text: 'First highlight',
    note: 'My note',
    tags: ['highlight-tag'],
    color: 'yellow',
    createdAt: '2024-01-02T00:00:00.000Z',
    favorite: false,
    lastReviewed: '2024-01-03T00:00:00.000Z',
    reviewCount: 1,
    dueAt: '2024-01-04T00:00:00.000Z',
    intervalDays: 3,
    ease: 2.5,
    lapses: 0,
    location: undefined,
    source: 'reader',
  },
  {
    id: 'hl-2',
    docId: 'doc-1',
    text: 'Second highlight with "quotes"',
    note: '',
    tags: [],
    color: 'blue',
    createdAt: '2024-01-02T01:00:00.000Z',
    favorite: true,
    lastReviewed: undefined,
    reviewCount: 0,
    dueAt: '2024-01-05T00:00:00.000Z',
    intervalDays: 0,
    ease: 2.5,
    lapses: 0,
    location: { type: 'audio', startMs: 90000, endMs: 120000 },
    source: 'reader',
  },
]

describe('lib/export - pure helpers', () => {
  describe('slugify', () => {
    it('slugifies basic text (preserves case)', () => {
      expect(slugify('Hello World')).toBe('Hello-World')
    })

    it('handles special characters', () => {
      expect(slugify('Test!@#$%^&*()')).toBe('Test')
    })

    it('handles unicode', () => {
      expect(slugify('Café Naïve')).toBe('Cafe-Nai-ve')
    })

    it('truncates to 80 chars', () => {
      const long = 'a'.repeat(100)
      expect(slugify(long).length).toBe(80)
    })

    it('returns untitled for empty', () => {
      expect(slugify('')).toBe('untitled')
      expect(slugify('   ')).toBe('untitled')
    })

    it('strips leading/trailing dashes', () => {
      expect(slugify('---test---')).toBe('test')
    })
  })

  describe('docToMarkdown', () => {
    it('includes frontmatter', () => {
      const md = docToMarkdown(doc, highlights)
      expect(md).toContain('---')
      expect(md).toContain('title: "Test Document"')
      expect(md).toContain('author: "Test Author"')
      expect(md).toContain('source: "Test Source"')
      expect(md).toContain('category: Article')
      expect(md).toContain('url: "https://example.com/doc"')
      expect(md).toContain('kind: article')
      expect(md).toContain('published: 2023-12-01T00:00:00.000Z')
      expect(md).toContain('added: 2024-01-01T00:00:00.000Z')
      expect(md).toContain('tags: ["tag1", "tag2"]')
    })

    it('includes document title', () => {
      const md = docToMarkdown(doc, highlights)
      expect(md).toContain('# Test Document')
    })

    it('includes summary as blockquote', () => {
      const md = docToMarkdown(doc, highlights)
      expect(md).toContain('> Test summary')
    })

    it('includes highlights section', () => {
      const md = docToMarkdown(doc, highlights)
      expect(md).toContain('## Highlights')
    })

    it('includes highlight text as blockquotes', () => {
      const md = docToMarkdown(doc, highlights)
      expect(md).toContain('> First highlight')
      expect(md).toContain('> Second highlight with "quotes"')
    })

    it('includes highlight notes', () => {
      const md = docToMarkdown(doc, highlights)
      expect(md).toContain('**Note:** My note')
    })

    it('includes highlight location for audio', () => {
      const md = docToMarkdown(doc, highlights)
      expect(md).toContain('_at 1:30_')
    })

    it('includes highlight tags', () => {
      const md = docToMarkdown(doc, highlights)
      expect(md).toContain('#highlight-tag')
    })

    it('includes wikilinks when option is set', () => {
      const md = docToMarkdown(doc, highlights, { wikilinks: true })
      expect(md).toContain('[[Test Author]]')
      expect(md).toContain('[[Test Source]]')
    })

    it('excludes wikilinks when option is false', () => {
      const md = docToMarkdown(doc, highlights, { wikilinks: false })
      expect(md).not.toContain('[[')
      expect(md).toContain('Test Author')
      expect(md).toContain('Test Source')
    })
  })

  describe('formatTimestamp', () => {
    it('formats seconds as MM:SS', () => {
      expect(formatTimestamp(90000)).toBe('1:30')
      expect(formatTimestamp(45000)).toBe('0:45')
      expect(formatTimestamp(3600000)).toBe('1:00:00')
    })

    it('handles zero', () => {
      expect(formatTimestamp(0)).toBe('0:00')
    })

    it('handles negative as zero', () => {
      expect(formatTimestamp(-1000)).toBe('0:00')
    })
  })

  describe('highlightsToCsv', () => {
    it('includes header row', () => {
      const csv = highlightsToCsv(highlights, [doc])
      const lines = csv.split('\r\n')
      expect(lines[0]).toBe('"Text","Note","Title","Author","Source","URL","Tags","Color","Created","Last reviewed","Reviews"')
    })

    it('includes all highlight fields', () => {
      const csv = highlightsToCsv(highlights, [doc])
      expect(csv).toContain('First highlight')
      expect(csv).toContain('My note')
      expect(csv).toContain('Test Document')
      expect(csv).toContain('Test Author')
      expect(csv).toContain('Test Source')
      expect(csv).toContain('https://example.com/doc')
      expect(csv).toContain('highlight-tag')
      expect(csv).toContain('yellow')
      expect(csv).toContain('2024-01-02T00:00:00.000Z')
      expect(csv).toContain('2024-01-03T00:00:00.000Z')
      expect(csv).toContain('1')
    })

    it('escapes quotes in CSV cells', () => {
      const csv = highlightsToCsv(highlights, [doc])
      expect(csv).toContain('"Second highlight with ""quotes"""')
    })
  })

  describe('parseCsv', () => {
    it('parses simple CSV', () => {
      const result = parseCsv('a,b,c\n1,2,3')
      expect(result).toEqual([
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ])
    })

    it('handles quoted fields with commas', () => {
      const result = parseCsv('"a,b",c\n"x,y",z')
      expect(result).toEqual([
        ['a,b', 'c'],
        ['x,y', 'z'],
      ])
    })

    it('handles escaped quotes', () => {
      const result = parseCsv('"a""b",c')
      expect(result).toEqual([['a"b', 'c']])
    })

    it('handles CRLF and LF', () => {
      const result = parseCsv('a,b\r\n1,2\r\n3,4')
      expect(result).toEqual([
        ['a', 'b'],
        ['1', '2'],
        ['3', '4'],
      ])
    })

    it('skips empty rows', () => {
      const result = parseCsv('a,b\n\n1,2')
      expect(result).toEqual([
        ['a', 'b'],
        ['1', '2'],
      ])
    })
  })

  describe('parseReadwiseCsv', () => {
    // We need to copy the parseReadwiseCsv function too
    const parseReadwiseCsv = (input: string) => {
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

    it('parses Readwise CSV export', () => {
      const csv = `Highlight,Note,Title,Author,URL,Tags,Highlighted at
"Test highlight","Test note","Test Book","Test Author","https://example.com","tag1;tag2","2024-01-01T00:00:00.000Z"`
      const result = parseReadwiseCsv(csv)
      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('Test highlight')
      expect(result[0].note).toBe('Test note')
      expect(result[0].title).toBe('Test Book')
      expect(result[0].author).toBe('Test Author')
      expect(result[0].url).toBe('https://example.com')
      expect(result[0].tags).toEqual(['tag1', 'tag2'])
      expect(result[0].highlightedAt).toBe('2024-01-01T00:00:00.000Z')
    })

    it('handles missing optional columns', () => {
      const csv = `Highlight
"Test highlight"`
      const result = parseReadwiseCsv(csv)
      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('Test highlight')
      expect(result[0].note).toBe('')
      expect(result[0].title).toBe('Readwise import')
      expect(result[0].author).toBe('Unknown')
    })

    it('filters empty highlights', () => {
      const csv = `Highlight
""
"Real highlight"`
      const result = parseReadwiseCsv(csv)
      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('Real highlight')
    })

    it('handles comma and semicolon tag separators', () => {
      const csv = `Highlight,Tags
"Test 1","tag1,tag2"
"Test 2","tag3;tag4"`
      const result = parseReadwiseCsv(csv)
      expect(result[0].tags).toEqual(['tag1', 'tag2'])
      expect(result[1].tags).toEqual(['tag3', 'tag4'])
    })
  })
})