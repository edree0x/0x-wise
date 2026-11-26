import { test, describe, beforeEach, afterEach, assert } from 'node:test'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Import the db module
const { db, nowIso, hashToken, verifyPassword, search, indexDoc, indexHighlight, listDocs, listHighlights, insertDoc, insertHighlight, getDoc, getHighlight, findDocByUrl, updateDocRow, deleteDocRow, updateHighlightRow, deleteHighlightRow, toFtsQuery } = await import('../src/lib/db.js')
const { Doc, Highlight } = await import('../src/dashboard/types.js')

let testDataDir
let originalDataDir

function getTestDataDir() {
  return testDataDir
}

beforeEach(() => {
  // Create a unique temp directory for this test
  testDataDir = path.join(os.tmpdir(), `oxw-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`)
  mkdirSync(testDataDir, { recursive: true })
  mkdirSync(path.join(testDataDir, 'media'), { recursive: true })
  mkdirSync(path.join(testDataDir, 'export'), { recursive: true })

  // Save original and override OXW_DATA_DIR
  originalDataDir = process.env.OXW_DATA_DIR
  process.env.OXW_DATA_DIR = testDataDir

  // Clear require cache to force re-initialization of db with new path
  // Note: ES modules don't have require cache, but we can re-import
})

afterEach(() => {
  // Restore original env
  if (originalDataDir !== undefined) {
    process.env.OXW_DATA_DIR = originalDataDir
  } else {
    delete process.env.OXW_DATA_DIR
  }

  // Clean up test directory
  try {
    rmSync(testDataDir, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
})

const testDoc = {
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

const testHighlight = {
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

describe('lib/db - SQLite with FTS5', () => {
  describe('Database initialization', () => {
    test('creates database file in temp directory', () => {
      const handle = db()
      assert.ok(handle)
      // Check that tables exist by running a query
      const tables = handle.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
      const tableNames = tables.map((t) => t.name)
      assert.ok(tableNames.includes('users'))
      assert.ok(tableNames.includes('documents'))
      assert.ok(tableNames.includes('highlights'))
      assert.ok(tableNames.includes('sources'))
      assert.ok(tableNames.includes('jobs'))
      assert.ok(tableNames.includes('meta'))
      assert.ok(tableNames.includes('documents_fts'))
      assert.ok(tableNames.includes('highlights_fts'))
    })

    test('creates FTS5 virtual tables', () => {
      const handle = db()
      const ftsTables = handle.prepare("SELECT name FROM sqlite_master WHERE type='table' AND sql LIKE '%fts5%'").all()
      const names = ftsTables.map((t) => t.name)
      assert.ok(names.includes('documents_fts'))
      assert.ok(names.includes('highlights_fts'))
    })

    test('uses WAL journal mode', () => {
      const handle = db()
      const pragma = handle.prepare('PRAGMA journal_mode').get()
      assert.strictEqual(pragma.journal_mode, 'wal')
    })

    test('has foreign keys enabled', () => {
      const handle = db()
      const pragma = handle.prepare('PRAGMA foreign_keys').get()
      assert.strictEqual(pragma.foreign_keys, 1)
    })
  })

  describe('Bootstrap and seeding', () => {
    test('creates default user on first run', () => {
      const handle = db()
      const user = handle.prepare('SELECT * FROM users WHERE id = ?').get('user-owner')
      assert.ok(user)
      assert.strictEqual(user.email, 'me@0xwise.local')
    })

    test('seeds meta with default settings', () => {
      const handle = db()
      const meta = handle.prepare('SELECT * FROM meta').all()
      const keys = meta.map((m) => m.key)
      assert.ok(keys.includes('settings'))
      assert.ok(keys.includes('review'))
      assert.ok(keys.includes('integrations'))
      assert.ok(keys.includes('imports'))
    })
  })

  describe('Password hashing and verification', () => {
    test('verifies correct password from seed', () => {
      const handle = db()
      const user = handle.prepare('SELECT salt, password_hash FROM users WHERE id = ?').get('user-owner')
      assert.ok(user)
      const result = verifyPassword('0xwise', user.salt, user.password_hash)
      assert.strictEqual(result, true)
    })

    test('rejects wrong password', () => {
      const handle = db()
      const user = handle.prepare('SELECT salt, password_hash FROM users WHERE id = ?').get('user-owner')
      const result = verifyPassword('wrong', user.salt, user.password_hash)
      assert.strictEqual(result, false)
    })
  })

  describe('Token hashing', () => {
    test('hashToken produces SHA-256', () => {
      const token = 'test-token'
      const hash = hashToken(token)
      assert.strictEqual(hash.length, 64)
      assert.strictEqual(hashToken(token), hash)
    })
  })

  describe('Document CRUD', () => {
    test('inserts and retrieves a document', () => {
      insertDoc(testDoc)
      const retrieved = getDoc(testDoc.id)
      assert.ok(retrieved)
      assert.strictEqual(retrieved.title, testDoc.title)
      assert.strictEqual(retrieved.author, testDoc.author)
      assert.deepStrictEqual(retrieved.content, testDoc.content)
      assert.deepStrictEqual(retrieved.tags, testDoc.tags)
    })

    test('finds document by URL', () => {
      insertDoc(testDoc)
      const found = findDocByUrl(testDoc.url)
      assert.ok(found)
      assert.strictEqual(found.id, testDoc.id)
    })

    test('returns null for non-existent URL', () => {
      const found = findDocByUrl('https://nonexistent.com')
      assert.strictEqual(found, null)
    })

    test('lists documents', () => {
      insertDoc(testDoc)
      const docs = listDocs()
      assert.ok(docs.length >= 1)
      assert.ok(docs.find((d) => d.id === testDoc.id))
    })

    test('updates a document', () => {
      insertDoc(testDoc)
      updateDocRow(testDoc.id, { title: 'Updated Title', favorite: true })
      const updated = getDoc(testDoc.id)
      assert.strictEqual(updated.title, 'Updated Title')
      assert.strictEqual(updated.favorite, true)
    })

    test('soft deletes a document', () => {
      insertDoc(testDoc)
      deleteDocRow(testDoc.id)
      const deleted = getDoc(testDoc.id)
      assert.strictEqual(deleted, null)
      // But exists in listDocs with includeDeleted
      const all = listDocs(true)
      assert.ok(all.find((d) => d.id === testDoc.id))
    })
  })

  describe('Highlight CRUD', () => {
    beforeEach(() => {
      insertDoc(testDoc)
    })

    test('inserts and retrieves a highlight', () => {
      insertHighlight(testHighlight)
      const retrieved = getHighlight(testHighlight.id)
      assert.ok(retrieved)
      assert.strictEqual(retrieved.text, testHighlight.text)
      assert.strictEqual(retrieved.note, testHighlight.note)
      assert.deepStrictEqual(retrieved.tags, testHighlight.tags)
    })

    test('lists highlights', () => {
      insertHighlight(testHighlight)
      const highlights = listHighlights()
      assert.ok(highlights.length >= 1)
      assert.ok(highlights.find((h) => h.id === testHighlight.id))
    })

    test('updates a highlight', () => {
      insertHighlight(testHighlight)
      updateHighlightRow(testHighlight.id, { text: 'Updated text', favorite: true })
      const updated = getHighlight(testHighlight.id)
      assert.strictEqual(updated.text, 'Updated text')
      assert.strictEqual(updated.favorite, true)
    })

    test('soft deletes a highlight', () => {
      insertHighlight(testHighlight)
      deleteHighlightRow(testHighlight.id)
      const deleted = getHighlight(testHighlight.id)
      assert.strictEqual(deleted, null)
    })
  })

  describe('FTS5 Search', () => {
    beforeEach(() => {
      insertDoc(testDoc)
      insertHighlight(testHighlight)
    })

    test('searches documents by title', () => {
      const result = search('AI')
      assert.ok(result.docIds.includes(testDoc.id))
    })

    test('searches documents by content', () => {
      const result = search('neural')
      assert.ok(result.docIds.includes(testDoc.id))
    })

    test('searches highlights by text', () => {
      const result = search('Machine learning')
      assert.ok(result.highlightIds.includes(testHighlight.id))
    })

    test('searches highlights by note', () => {
      const result = search('Important')
      assert.ok(result.highlightIds.includes(testHighlight.id))
    })

    test('returns empty for no matches', () => {
      const result = search('nonexistenttermxyz')
      assert.strictEqual(result.docIds.length, 0)
      assert.strictEqual(result.highlightIds.length, 0)
    })

    test('toFtsQuery builds proper FTS5 query', () => {
      assert.strictEqual(toFtsQuery('hello world'), '"hello"* AND "world"*')
      assert.strictEqual(toFtsQuery('AI & ML'), '"ai"* AND "ml"*')
      assert.strictEqual(toFtsQuery(''), '')
      assert.strictEqual(toFtsQuery('   '), '')
    })

    test('limits query tokens to 8', () => {
      const manyTokens = 'one two three four five six seven eight nine ten'
      const query = toFtsQuery(manyTokens)
      const tokenCount = query.split(' AND ').length
      assert.ok(tokenCount <= 8)
    })
  })

  describe('FTS Indexing', () => {
    test('indexDoc adds to FTS', () => {
      insertDoc(testDoc)
      // Search should find it
      const result = search('artificial')
      assert.ok(result.docIds.includes(testDoc.id))
    })

    test('indexHighlight adds to FTS', () => {
      insertDoc(testDoc)
      insertHighlight(testHighlight)
      const result = search('subset')
      assert.ok(result.highlightIds.includes(testHighlight.id))
    })

    test('updateDocRow reindexes', () => {
      insertDoc(testDoc)
      updateDocRow(testDoc.id, { title: 'New Title About Rust' })
      const result = search('Rust')
      assert.ok(result.docIds.includes(testDoc.id))
      // Old title should not match
      const oldResult = search('AI')
      assert.ok(!oldResult.docIds.includes(testDoc.id))
    })

    test('updateHighlightRow reindexes', () => {
      insertDoc(testDoc)
      insertHighlight(testHighlight)
      updateHighlightRow(testHighlight.id, { text: 'Updated highlight about Go' })
      const result = search('Go')
      assert.ok(result.highlightIds.includes(testHighlight.id))
    })

    test('deleteDocRow removes from FTS', () => {
      insertDoc(testDoc)
      deleteDocRow(testDoc.id)
      const result = search('AI')
      assert.ok(!result.docIds.includes(testDoc.id))
    })

    test('deleteHighlightRow removes from FTS', () => {
      insertDoc(testDoc)
      insertHighlight(testHighlight)
      deleteHighlightRow(testHighlight.id)
      const result = search('subset')
      assert.ok(!result.highlightIds.includes(testHighlight.id))
    })
  })
})