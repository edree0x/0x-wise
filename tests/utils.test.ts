import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatShortDate,
  relativeTime,
  dueLabel,
  estimateMinutes,
  splitParagraphs,
  highlightsToCSV,
  libraryToMarkdown,
  clamp,
  wordCount,
} from '@/dashboard/utils'
import type { Doc, Highlight } from '@/dashboard/types'

describe('dashboard/utils', () => {
  describe('formatDate', () => {
    it('formats a valid ISO date', () => {
      const result = formatDate('2024-03-15T10:30:00.000Z')
      expect(result).toMatch(/Mar 15, 2024/)
    })

    it('returns em dash for invalid date', () => {
      const result = formatDate('not-a-date')
      expect(result).toBe('—')
    })
  })

  describe('formatShortDate', () => {
    it('formats a valid ISO date without year', () => {
      const result = formatShortDate('2024-03-15T10:30:00.000Z')
      expect(result).toMatch(/Mar 15/)
    })

    it('returns em dash for invalid date', () => {
      const result = formatShortDate('not-a-date')
      expect(result).toBe('—')
    })
  })

  describe('relativeTime', () => {
    it('returns "Just now" for very recent times', () => {
      const now = new Date().toISOString()
      expect(relativeTime(now)).toBe('Just now')
    })

    it('returns minutes for recent times', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      expect(relativeTime(fiveMinAgo)).toBe('5 min ago')
    })

    it('returns hours for older times', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
      expect(relativeTime(threeHoursAgo)).toBe('3 hr ago')
    })

    it('returns "Yesterday" for 1 day ago', () => {
      const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
      expect(relativeTime(yesterday)).toBe('Yesterday')
    })

    it('returns days for older dates', () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      expect(relativeTime(fiveDaysAgo)).toBe('5 days ago')
    })

    it('returns "Never" for null', () => {
      expect(relativeTime(null)).toBe('Never')
    })

    it('returns "Never" for invalid date', () => {
      expect(relativeTime('not-a-date')).toBe('Never')
    })
  })

  describe('dueLabel', () => {
    it('returns "Ready now" for past dates', () => {
      const past = new Date(Date.now() - 1000).toISOString()
      expect(dueLabel(past)).toBe('Ready now')
    })

    it('returns "Tomorrow" for 1 day', () => {
      const tomorrow = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString()
      expect(dueLabel(tomorrow)).toBe('Tomorrow')
    })

    it('returns "In N days" for future dates', () => {
      const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
      expect(dueLabel(future)).toBe('In 5 days')
    })
  })

  describe('estimateMinutes', () => {
    it('returns 1 for empty text', () => {
      expect(estimateMinutes('')).toBe(1)
      expect(estimateMinutes('   ')).toBe(1)
    })

    it('estimates minutes based on 220 words per minute', () => {
      const text = 'word '.repeat(220)
      expect(estimateMinutes(text)).toBe(1)
      const text2 = 'word '.repeat(440)
      expect(estimateMinutes(text2)).toBe(2)
    })

    it('rounds up', () => {
      const text = 'word '.repeat(330) // 1.5 minutes
      expect(estimateMinutes(text)).toBe(2)
    })
  })

  describe('splitParagraphs', () => {
    it('splits on double newlines', () => {
      const result = splitParagraphs('Para 1\n\nPara 2\n\nPara 3')
      expect(result).toEqual(['Para 1', 'Para 2', 'Para 3'])
    })

    it('handles CRLF', () => {
      const result = splitParagraphs('Para 1\r\n\r\nPara 2')
      expect(result).toEqual(['Para 1', 'Para 2'])
    })

    it('trims whitespace', () => {
      const result = splitParagraphs('  Para 1  \n\n  Para 2  ')
      expect(result).toEqual(['Para 1', 'Para 2'])
    })

    it('filters empty paragraphs', () => {
      const result = splitParagraphs('Para 1\n\n\n\nPara 2')
      expect(result).toEqual(['Para 1', 'Para 2'])
    })
  })

  describe('highlightsToCSV', () => {
    const docs: Doc[] = [
      {
        id: 'doc-1',
        title: 'Test Doc',
        author: 'Author Name',
        source: 'Source Name',
        url: 'https://example.com',
        category: 'Article',
        addedAt: '2024-01-01T00:00:00.000Z',
        minutes: 5,
        progress: 0,
        favorite: false,
        archived: false,
        color: 'clay',
        summary: 'Summary',
        content: ['para 1'],
        tags: ['tag1'],
        kind: 'article',
      },
    ]

    const highlights: Highlight[] = [
      {
        id: 'hl-1',
        docId: 'doc-1',
        text: 'Highlight text',
        note: 'My note',
        tags: ['tag1', 'tag2'],
        color: 'yellow',
        createdAt: '2024-01-02T00:00:00.000Z',
        favorite: false,
        lastReviewed: '2024-01-03T00:00:00.000Z',
        reviewCount: 2,
        dueAt: '2024-01-04T00:00:00.000Z',
        intervalDays: 3,
        ease: 2.5,
        lapses: 0,
        location: undefined,
        source: 'reader',
      },
    ]

    it('generates CSV with header', () => {
      const csv = highlightsToCSV(highlights, docs)
      const lines = csv.split('\r\n')
      expect(lines[0]).toBe('"Text","Note","Title","Author","Source","Tags","Color","Created","Last reviewed","Reviews"')
    })

    it('escapes quotes in CSV cells', () => {
      const highlightsWithQuotes: Highlight[] = [
        {
          ...highlights[0],
          text: 'He said "hello"',
          note: 'Note with "quotes"',
        },
      ]
      const csv = highlightsToCSV(highlightsWithQuotes, docs)
      expect(csv).toContain('"He said ""hello"""')
      expect(csv).toContain('"Note with ""quotes"""')
    })

    it('includes all highlight fields', () => {
      const csv = highlightsToCSV(highlights, docs)
      expect(csv).toContain('Highlight text')
      expect(csv).toContain('My note')
      expect(csv).toContain('Test Doc')
      expect(csv).toContain('Author Name')
      expect(csv).toContain('Source Name')
      expect(csv).toContain('tag1, tag2')
      expect(csv).toContain('yellow')
      expect(csv).toContain('Jan 2, 2024')
      expect(csv).toContain('Jan 3, 2024')
      expect(csv).toContain('2')
    })
  })

  describe('libraryToMarkdown', () => {
    const docs: Doc[] = [
      {
        id: 'doc-1',
        title: 'Test Doc',
        author: 'Author Name',
        source: 'Source Name',
        url: 'https://example.com',
        category: 'Article',
        addedAt: '2024-01-01T00:00:00.000Z',
        minutes: 5,
        progress: 0,
        favorite: false,
        archived: false,
        color: 'clay',
        summary: 'Summary text',
        content: ['para 1'],
        tags: ['tag1'],
        kind: 'article',
      },
    ]

    const highlights: Highlight[] = [
      {
        id: 'hl-1',
        docId: 'doc-1',
        text: 'Highlight text',
        note: 'My note',
        tags: ['tag1'],
        color: 'yellow',
        createdAt: '2024-01-02T00:00:00.000Z',
        favorite: false,
        lastReviewed: null,
        reviewCount: 0,
        dueAt: '2024-01-04T00:00:00.000Z',
        intervalDays: 3,
        ease: 2.5,
        lapses: 0,
        location: undefined,
        source: 'reader',
      },
    ]

    it('includes document title', () => {
      const md = libraryToMarkdown(docs, highlights)
      expect(md).toContain('## Test Doc')
    })

    it('includes author and source', () => {
      const md = libraryToMarkdown(docs, highlights)
      expect(md).toContain('*Author Name* — Source Name · Article')
    })

    it('includes summary', () => {
      const md = libraryToMarkdown(docs, highlights)
      expect(md).toContain('Summary text')
    })

    it('includes highlights as blockquotes', () => {
      const md = libraryToMarkdown(docs, highlights)
      expect(md).toContain('> Highlight text')
    })

    it('includes highlight notes', () => {
      const md = libraryToMarkdown(docs, highlights)
      expect(md).toContain('Note: My note')
    })

    it('includes highlight tags as hashtags', () => {
      const md = libraryToMarkdown(docs, highlights)
      expect(md).toContain('#tag1')
    })
  })

  describe('clamp', () => {
    it('returns value within bounds', () => {
      expect(clamp(5, 0, 10)).toBe(5)
    })

    it('returns min when below', () => {
      expect(clamp(-5, 0, 10)).toBe(0)
    })

    it('returns max when above', () => {
      expect(clamp(15, 0, 10)).toBe(10)
    })
  })

  describe('wordCount', () => {
    it('counts words correctly', () => {
      expect(wordCount('')).toBe(0)
      expect(wordCount('   ')).toBe(0)
      expect(wordCount('hello')).toBe(1)
      expect(wordCount('hello world')).toBe(2)
      expect(wordCount('  hello   world  ')).toBe(2)
      expect(wordCount('hello\nworld\ntest')).toBe(3)
    })
  })
})