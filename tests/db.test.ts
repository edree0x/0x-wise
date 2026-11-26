import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db, nowIso, hashToken, verifyPassword, search, indexDoc, indexHighlight, listDocs, listHighlights, insertDoc, insertHighlight, getDoc, getHighlight, findDocByUrl, updateDocRow, deleteDocRow, updateHighlightRow, deleteHighlightRow, toFtsQuery } from '@/lib/db'
import type { Doc, Highlight } from '@/dashboard/types'
import { getTestDataDir } from './setup'

describe('lib/db - SQLite with FTS5', () => {
  const testDoc: Doc = {
    id: 'doc-test-1',
    title: 'Test Document About AI',
    author: 'John Author',
    source: 'Test Blog',
    url: 'https://example.com/ai-article',
    category: 'Article',
    addedAt: nowIso(),
    minutes: 10,
    progress: 0,
    favorite: false,
    archived: false,
    color: 'clay',
    summary: 'This article discusses artificial intelligence and machine learning.',
    content: ['First paragraph about AI.', 'Second paragraph about neural networks.'],
    tags: ['ai', 'ml'],
    kind: 'article',
  }

  const testHighlight: Highlight = {
    id: 'hl-test-1',
    docId: 'doc-test-1',
    text: 'Machine learning is a subset of AI',
    note: 'Important concept',
    tags: ['ml', 'concept'],
    color: 'yellow',
    createdAt: nowIso(),
    favorite: false,
    lastReviewed: null,
    reviewCount: 0,
    dueAt: nowIso(),
    intervalDays: 0,
    ease: 2.5,
    lapses: 0,
    location: undefined,
    source: 'reader',
  }

  describe('Database initialization', () => {
    it('creates database file in temp directory', () => {
      const handle = db()
      expect(handle).toBeDefined()
      // Check that tables exist by running a query
      const tables = handle.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
      const tableNames = tables.map((t) => t.name)
      expect(tableNames).toContain('users')
      expect(tableNames).toContain('documents')
      expect(tableNames).toContain('highlights')
      expect(tableNames).toContain('sources')
      expect(tableNames).toContain('jobs')
      expect(tableNames).toContain('meta')
      expect(tableNames).toContain('documents_fts')
      expect(tableNames).toContain('highlights_fts')
    })

    it('creates FTS5 virtual tables', () => {
      const handle = db()
      const ftsTables = handle
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND sql LIKE '%fts5%'")
        .all() as { name: string }[]
      expect(ftsTables.map((t) => t.name)).toContain('documents_fts')
      expect(ftsTables.map((t) => t.name)).toContain('highlights_fts')
    })

    it('uses WAL journal mode', () => {
      const handle = db()
      const pragma = handle.prepare('PRAGMA journal_mode').get() as { journal_mode: string }
      expect(pragma.journal_mode).toBe('wal')
    })

    it('has foreign keys enabled', () => {
      const handle = db()
      const pragma = handle.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }
      expect(pragma.foreign_keys).toBe(1)
    })
  })

  describe('Bootstrap and seeding', () => {
    it('creates default user on first run', () => {
      const handle = db()
      const user = handle.prepare('SELECT * FROM users WHERE id = ?').get('user-owner') as
        | { id: string; email: string; password_hash: string; salt: string }
        | undefined
      expect(user).toBeDefined()
      expect(user?.email).toBe('me@0xwise.local')
    })

    it('seeds meta with default settings', () => {
      const handle = db()
      const meta = handle.prepare('SELECT * FROM meta').all() as { key: string; value: string }[]
      const keys = meta.map((m) => m.key)
      expect(keys).toContain('settings')
      expect(keys).toContain('review')
      expect(keys).toContain('integrations')
      expect(keys).toContain('imports')
    })
  })

  describe('Password hashing and verification', () => {
    it('verifies correct password from seed', () => {
      const handle = db()
      const user = handle.prepare('SELECT salt, password_hash FROM users WHERE id = ?').get('user-owner') as
        | { salt: string; password_hash: string }
        | undefined
      expect(user).toBeDefined()
      const result = verifyPassword('0xwise', user!.salt, user!.password_hash)
      expect(result).toBe(true)
    })

    it('rejects wrong password', () => {
      const handle = db()
      const user = handle.prepare('SELECT salt, password_hash FROM users WHERE id = ?').get('user-owner') as
        | { salt: string; password_hash: string }
        | undefined
      const result = verifyPassword('wrong', user!.salt, user!.password_hash)
      expect(result).toBe(false)
    })
  })

  describe('Token hashing', () => {
    it('hashToken produces SHA-256', () => {
      const token = 'test-token'
      const hash = hashToken(token)
      expect(hash).toHaveLength(64)
      expect(hashToken(token)).toBe(hash)
    })
  })

  describe('Document CRUD', () => {
    it('inserts and retrieves a document', () => {
      insertDoc(testDoc)
      const retrieved = getDoc(testDoc.id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.title).toBe(testDoc.title)
      expect(retrieved?.author).toBe(testDoc.author)
      expect(retrieved?.content).toEqual(testDoc.content)
      expect(retrieved?.tags).toEqual(testDoc.tags)
    })

    it('finds document by URL', () => {
      insertDoc(testDoc)
      const found = findDocByUrl(testDoc.url)
      expect(found).toBeDefined()
      expect(found?.id).toBe(testDoc.id)
    })

    it('returns null for non-existent URL', () => {
      const found = findDocByUrl('https://nonexistent.com')
      expect(found).toBeNull()
    })

    it('lists documents', () => {
      insertDoc(testDoc)
      const docs = listDocs()
      expect(docs.length).toBeGreaterThanOrEqual(1)
      expect(docs.find((d) => d.id === testDoc.id)).toBeDefined()
    })

    it('updates a document', () => {
      insertDoc(testDoc)
      updateDocRow(testDoc.id, { title: 'Updated Title', favorite: true })
      const updated = getDoc(testDoc.id)
      expect(updated?.title).toBe('Updated Title')
      expect(updated?.favorite).toBe(true)
    })

    it('soft deletes a document', () => {
      insertDoc(testDoc)
      deleteDocRow(testDoc.id)
      const deleted = getDoc(testDoc.id)
      expect(deleted).toBeNull()
      // But exists in listDocs with includeDeleted
      const all = listDocs(true)
      expect(all.find((d) => d.id === testDoc.id)).toBeDefined()
    })
  })

  describe('Highlight CRUD', () => {
    beforeEach(() => {
      insertDoc(testDoc)
    })

    it('inserts and retrieves a highlight', () => {
      insertHighlight(testHighlight)
      const retrieved = getHighlight(testHighlight.id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.text).toBe(testHighlight.text)
      expect(retrieved?.note).toBe(testHighlight.note)
      expect(retrieved?.tags).toEqual(testHighlight.tags)
    })

    it('lists highlights', () => {
      insertHighlight(testHighlight)
      const highlights = listHighlights()
      expect(highlights.length).toBeGreaterThanOrEqual(1)
      expect(highlights.find((h) => h.id === testHighlight.id)).toBeDefined()
    })

    it('updates a highlight', () => {
      insertHighlight(testHighlight)
      updateHighlightRow(testHighlight.id, { text: 'Updated text', favorite: true })
      const updated = getHighlight(testHighlight.id)
      expect(updated?.text).toBe('Updated text')
      expect(updated?.favorite).toBe(true)
    })

    it('soft deletes a highlight', () => {
      insertHighlight(testHighlight)
      deleteHighlightRow(testHighlight.id)
      const deleted = getHighlight(testHighlight.id)
      expect(deleted).toBeNull()
    })
  })

  describe('FTS5 Search', () => {
    beforeEach(() => {
      insertDoc(testDoc)
      insertHighlight(testHighlight)
    })

    it('searches documents by title', () => {
      const result = search('AI')
      expect(result.docIds).toContain(testDoc.id)
    })

    it('searches documents by content', () => {
      const result = search('neural')
      expect(result.docIds).toContain(testDoc.id)
    })

    it('searches highlights by text', () => {
      const result = search('Machine learning')
      expect(result.highlightIds).toContain(testHighlight.id)
    })

    it('searches highlights by note', () => {
      const result = search('Important')
      expect(result.highlightIds).toContain(testHighlight.id)
    })

    it('returns empty for no matches', () => {
      const result = search('nonexistenttermxyz')
      expect(result.docIds).toHaveLength(0)
      expect(result.highlightIds).toHaveLength(0)
    })

    it('toFtsQuery builds proper FTS5 query', () => {
      expect(toFtsQuery('hello world')).toBe('"hello"* AND "world"*')
      expect(toFtsQuery('AI & ML')).toBe('"ai"* AND "ml"*')
      expect(toFtsQuery('')).toBe('')
      expect(toFtsQuery('   ')).toBe('')
    })

    it('limits query tokens to 8', () => {
      const manyTokens = 'one two three four five six seven eight nine ten'
      const query = toFtsQuery(manyTokens)
      const tokenCount = query.split(' AND ').length
      expect(tokenCount).toBeLessThanOrEqual(8)
    })
  })

  describe('FTS Indexing', () => {
    it('indexDoc adds to FTS', () => {
      insertDoc(testDoc)
      // Search should find it
      const result = search('artificial')
      expect(result.docIds).toContain(testDoc.id)
    })

    it('indexHighlight adds to FTS', () => {
      insertDoc(testDoc)
      insertHighlight(testHighlight)
      const result = search('subset')
      expect(result.highlightIds).toContain(testHighlight.id)
    })

    it('updateDocRow reindexes', () => {
      insertDoc(testDoc)
      updateDocRow(testDoc.id, { title: 'New Title About Rust' })
      const result = search('Rust')
      expect(result.docIds).toContain(testDoc.id)
      // Old title should not match
      const oldResult = search('AI')
      expect(oldResult.docIds).not.toContain(testDoc.id)
    })

    it('updateHighlightRow reindexes', () => {
      insertDoc(testDoc)
      insertHighlight(testHighlight)
      updateHighlightRow(testHighlight.id, { text: 'Updated highlight about Go' })
      const result = search('Go')
      expect(result.highlightIds).toContain(testHighlight.id)
    })

    it('deleteDocRow removes from FTS', () => {
      insertDoc(testDoc)
      deleteDocRow(testDoc.id)
      const result = search('AI')
      expect(result.docIds).not.toContain(testDoc.id)
    })

    it('deleteHighlightRow removes from FTS', () => {
      insertDoc(testDoc)
      insertHighlight(testHighlight)
      deleteHighlightRow(testHighlight.id)
      const result = search('subset')
      expect(result.highlightIds).not.toContain(testHighlight.id)
    })
  })
})