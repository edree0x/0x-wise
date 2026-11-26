import { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { createSeedData } from '@/dashboard/data'
import type { Doc, Highlight, IntegrationId, Settings, Source } from '@/dashboard/types'

export const dataDir = process.env.OXW_DATA_DIR
  ? path.resolve(process.env.OXW_DATA_DIR)
  : path.join(process.cwd(), 'data')

export const mediaDir = path.join(dataDir, 'media')
export const vaultDir = path.join(dataDir, 'export')

let cached: DatabaseSync | null = null

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'article',
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Article',
  added_at TEXT NOT NULL,
  published_at TEXT,
  minutes INTEGER NOT NULL DEFAULT 1,
  progress INTEGER NOT NULL DEFAULT 0,
  favorite INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT 'clay',
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  cover TEXT,
  audio_url TEXT,
  duration_sec INTEGER,
  lang TEXT,
  source_id TEXT,
  transcript TEXT NOT NULL DEFAULT '[]',
  chapters TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ready',
  error TEXT,
  hash TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_docs_added ON documents(deleted, added_at DESC);
CREATE INDEX IF NOT EXISTS idx_docs_source ON documents(source_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_docs_url ON documents(url) WHERE url <> '';

CREATE TABLE IF NOT EXISTS highlights (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL,
  text TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  color TEXT NOT NULL DEFAULT 'yellow',
  created_at TEXT NOT NULL,
  favorite INTEGER NOT NULL DEFAULT 0,
  last_reviewed TEXT,
  review_count INTEGER NOT NULL DEFAULT 0,
  due_at TEXT NOT NULL,
  interval_days REAL NOT NULL DEFAULT 0,
  ease REAL NOT NULL DEFAULT 2.5,
  lapses INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  source TEXT NOT NULL DEFAULT 'reader',
  deleted INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hl_doc ON highlights(doc_id, deleted);
CREATE INDEX IF NOT EXISTS idx_hl_due ON highlights(deleted, due_at);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  site_url TEXT NOT NULL DEFAULT '',
  icon_url TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  poll_minutes INTEGER NOT NULL DEFAULT 30,
  last_polled_at TEXT,
  etag TEXT,
  last_modified TEXT,
  error TEXT,
  rules TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  run_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, run_at);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  id UNINDEXED,
  title,
  author,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE VIRTUAL TABLE IF NOT EXISTS highlights_fts USING fts5(
  id UNINDEXED,
  text,
  note,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
`

export function nowIso(): string {
  return new Date().toISOString()
}

export function db(): DatabaseSync {
  if (cached) return cached
  mkdirSync(dataDir, { recursive: true })
  mkdirSync(mediaDir, { recursive: true })
  const handle = new DatabaseSync(path.join(dataDir, '0xwise.db'))
  handle.exec(SCHEMA)
  cached = handle
  bootstrap(handle)
  return handle
}

function settingDefaults(): Record<string, unknown> {
  const seed = createSeedData()
  return {
    settings: seed.settings,
    review: seed.review,
    integrations: seed.integrations,
    imports: seed.imports,
  }
}

function bootstrap(handle: DatabaseSync): void {
  const userCount = handle.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }
  if (Number(userCount.n) === 0) {
    const email = process.env.OXW_EMAIL || 'me@0xwise.local'
    const password = process.env.OXW_PASSWORD || '0xwise'
    const salt = randomBytes(16).toString('hex')
    const hash = scryptSync(password, salt, 64).toString('hex')
    handle
      .prepare('INSERT INTO users (id, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)')
      .run('user-owner', email, hash, salt, nowIso())
  }

  const defaults = settingDefaults()
  const settings = defaults.settings as { email?: string }
  defaults.settings = {
    ...settings,
    email: process.env.OXW_EMAIL || settings.email || 'me@0xwise.local',
  }
  const insert = handle.prepare('INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(defaults)) {
    insert.run(key, JSON.stringify(value))
  }
}

export function getMeta<T>(key: string, fallback: T): T {
  const row = db().prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined
  if (!row) return fallback
  try {
    return JSON.parse(row.value) as T
  } catch {
    return fallback
  }
}

export function setMeta(key: string, value: unknown): void {
  db()
    .prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value))
}

export function auditLog(eventType: string, userId: string, details?: Record<string, unknown>): void {
  const id = `audit-${randomBytes(8).toString('hex')}`
  db()
    .prepare('INSERT INTO audit_log (id, event_type, user_id, details, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, eventType, userId, details ? JSON.stringify(details) : null, nowIso())
  // Trim to last 500 rows
  db().prepare('DELETE FROM audit_log WHERE id NOT IN (SELECT id FROM audit_log ORDER BY created_at DESC LIMIT 500)').run()
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function verifyPassword(password: string, salt: string, expected: string): boolean {
  const actual = scryptSync(password, salt, 64)
  const target = Buffer.from(expected, 'hex')
  if (actual.length !== target.length) return false
  return timingSafeEqual(actual, target)
}

type DocRow = {
  id: string
  kind: string
  title: string
  author: string
  source: string
  url: string
  category: string
  added_at: string
  published_at: string | null
  minutes: number
  progress: number
  favorite: number
  archived: number
  color: string
  summary: string
  content: string
  tags: string
  cover: string | null
  audio_url: string | null
  duration_sec: number | null
  lang: string | null
  source_id: string | null
  transcript: string
  chapters: string
  status: string
  error: string | null
  word_count: number
}

type HighlightRow = {
  id: string
  doc_id: string
  text: string
  note: string
  tags: string
  color: string
  created_at: string
  favorite: number
  last_reviewed: string | null
  review_count: number
  due_at: string
  interval_days: number
  ease: number
  lapses: number
  location: string | null
  source: string
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function rowToDoc(row: DocRow): Doc {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    source: row.source,
    url: row.url,
    category: row.category as Doc['category'],
    addedAt: row.added_at,
    minutes: Number(row.minutes),
    progress: Number(row.progress),
    favorite: Boolean(row.favorite),
    archived: Boolean(row.archived),
    color: row.color,
    summary: row.summary,
    content: parseJson<string[]>(row.content, []),
    tags: parseJson<string[]>(row.tags, []),
    kind: row.kind as Doc['kind'],
    cover: row.cover ?? undefined,
    audioUrl: row.audio_url ?? undefined,
    durationSec: row.duration_sec == null ? undefined : Number(row.duration_sec),
    publishedAt: row.published_at ?? undefined,
    lang: row.lang ?? undefined,
    sourceId: row.source_id ?? undefined,
    transcript: parseJson(row.transcript, []),
    chapters: parseJson(row.chapters, []),
    status: row.status as Doc['status'],
    error: row.error ?? undefined,
  }
}

export function rowToHighlight(row: HighlightRow): Highlight {
  return {
    id: row.id,
    docId: row.doc_id,
    text: row.text,
    note: row.note,
    tags: parseJson<string[]>(row.tags, []),
    createdAt: row.created_at,
    favorite: Boolean(row.favorite),
    color: row.color as Highlight['color'],
    lastReviewed: row.last_reviewed,
    reviewCount: Number(row.review_count),
    dueAt: row.due_at,
    location: parseJson(row.location, undefined),
    source: row.source as Highlight['source'],
    intervalDays: Number(row.interval_days),
    ease: Number(row.ease),
    lapses: Number(row.lapses),
  }
}

export function listDocs(includeDeleted = false): Doc[] {
  const rows = db()
    .prepare(
      `SELECT * FROM documents ${includeDeleted ? '' : 'WHERE deleted = 0'} ORDER BY added_at DESC`,
    )
    .all() as unknown as DocRow[]
  return rows.map(rowToDoc)
}

export function getDoc(id: string): Doc | null {
  const row = db().prepare('SELECT * FROM documents WHERE id = ? AND deleted = 0').get(id) as
    | DocRow
    | undefined
  return row ? rowToDoc(row) : null
}

export function findDocByUrl(url: string): Doc | null {
  if (!url) return null
  const row = db().prepare('SELECT * FROM documents WHERE url = ? AND deleted = 0').get(url) as
    | DocRow
    | undefined
  return row ? rowToDoc(row) : null
}

export function listHighlights(): Highlight[] {
  const rows = db()
    .prepare('SELECT * FROM highlights WHERE deleted = 0 ORDER BY created_at DESC')
    .all() as unknown as HighlightRow[]
  return rows.map(rowToHighlight)
}

export function getHighlight(id: string): Highlight | null {
  const row = db().prepare('SELECT * FROM highlights WHERE id = ? AND deleted = 0').get(id) as
    | HighlightRow
    | undefined
  return row ? rowToHighlight(row) : null
}

export function insertDoc(doc: Doc & { hash?: string }): void {
  const now = nowIso()
  db()
    .prepare(
      `INSERT INTO documents (id, kind, title, author, source, url, category, added_at, published_at,
        minutes, progress, favorite, archived, color, summary, content, tags, cover, audio_url,
        duration_sec, lang, source_id, transcript, chapters, status, error, hash, word_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      doc.id,
      doc.kind ?? 'article',
      doc.title,
      doc.author,
      doc.source,
      doc.url,
      doc.category,
      doc.addedAt,
      doc.publishedAt ?? null,
      doc.minutes,
      doc.progress,
      doc.favorite ? 1 : 0,
      doc.archived ? 1 : 0,
      doc.color,
      doc.summary,
      JSON.stringify(doc.content),
      JSON.stringify(doc.tags),
      doc.cover ?? null,
      doc.audioUrl ?? null,
      doc.durationSec ?? null,
      doc.lang ?? null,
      doc.sourceId ?? null,
      JSON.stringify(doc.transcript ?? []),
      JSON.stringify(doc.chapters ?? []),
      doc.status ?? 'ready',
      doc.error ?? null,
      doc.hash ?? null,
      doc.content.join(' ').split(/\s+/).filter(Boolean).length,
      now,
      now,
    )
  indexDoc(doc)
}

export function updateDocRow(id: string, patch: Partial<Doc>): void {
  const current = getDoc(id)
  if (!current) return
  const next: Doc = { ...current, ...patch }
  db()
    .prepare(
      `UPDATE documents SET title=?, author=?, source=?, url=?, category=?, minutes=?, progress=?,
        favorite=?, archived=?, color=?, summary=?, content=?, tags=?, cover=?, audio_url=?,
        duration_sec=?, lang=?, source_id=?, transcript=?, chapters=?, status=?, error=?,
        published_at=?, updated_at=? WHERE id=?`,
    )
    .run(
      next.title,
      next.author,
      next.source,
      next.url,
      next.category,
      next.minutes,
      next.progress,
      next.favorite ? 1 : 0,
      next.archived ? 1 : 0,
      next.color,
      next.summary,
      JSON.stringify(next.content),
      JSON.stringify(next.tags),
      next.cover ?? null,
      next.audioUrl ?? null,
      next.durationSec ?? null,
      next.lang ?? null,
      next.sourceId ?? null,
      JSON.stringify(next.transcript ?? []),
      JSON.stringify(next.chapters ?? []),
      next.status ?? 'ready',
      next.error ?? null,
      next.publishedAt ?? null,
      nowIso(),
      id,
    )
  indexDoc(next)
}

export function deleteDocRow(id: string): void {
  db().prepare('UPDATE documents SET deleted = 1, updated_at = ? WHERE id = ?').run(nowIso(), id)
  db().prepare('UPDATE highlights SET deleted = 1, updated_at = ? WHERE doc_id = ?').run(nowIso(), id)
  db().prepare('DELETE FROM documents_fts WHERE id = ?').run(id)
  db().prepare('DELETE FROM highlights_fts WHERE id IN (SELECT id FROM highlights WHERE doc_id = ?)').run(id)
}

export function indexDoc(doc: Doc): void {
  db().prepare('DELETE FROM documents_fts WHERE id = ?').run(doc.id)
  db()
    .prepare('INSERT INTO documents_fts (id, title, author, body) VALUES (?, ?, ?, ?)')
    .run(doc.id, doc.title, doc.author, `${doc.summary}\n${doc.content.join('\n')}`)
}

export function insertHighlight(highlight: Highlight): void {
  db()
    .prepare(
      `INSERT INTO highlights (id, doc_id, text, note, tags, color, created_at, favorite,
        last_reviewed, review_count, due_at, interval_days, ease, lapses, location, source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      highlight.id,
      highlight.docId,
      highlight.text,
      highlight.note,
      JSON.stringify(highlight.tags),
      highlight.color,
      highlight.createdAt,
      highlight.favorite ? 1 : 0,
      highlight.lastReviewed,
      highlight.reviewCount,
      highlight.dueAt,
      highlight.intervalDays ?? 0,
      highlight.ease ?? 2.5,
      highlight.lapses ?? 0,
      highlight.location ? JSON.stringify(highlight.location) : null,
      highlight.source ?? 'reader',
      nowIso(),
    )
  indexHighlight(highlight)
}

export function updateHighlightRow(id: string, patch: Partial<Highlight>): void {
  const current = getHighlight(id)
  if (!current) return
  const next = { ...current, ...patch }
  db()
    .prepare(
      `UPDATE highlights SET text=?, note=?, tags=?, color=?, favorite=?, last_reviewed=?,
        review_count=?, due_at=?, interval_days=?, ease=?, lapses=?, location=?, updated_at=? WHERE id=?`,
    )
    .run(
      next.text,
      next.note,
      JSON.stringify(next.tags),
      next.color,
      next.favorite ? 1 : 0,
      next.lastReviewed,
      next.reviewCount,
      next.dueAt,
      next.intervalDays ?? 0,
      next.ease ?? 2.5,
      next.lapses ?? 0,
      next.location ? JSON.stringify(next.location) : null,
      nowIso(),
      id,
    )
  indexHighlight(next)
}

export function deleteHighlightRow(id: string): void {
  db().prepare('UPDATE highlights SET deleted = 1, updated_at = ? WHERE id = ?').run(nowIso(), id)
  db().prepare('DELETE FROM highlights_fts WHERE id = ?').run(id)
}

export function indexHighlight(highlight: Highlight): void {
  db().prepare('DELETE FROM highlights_fts WHERE id = ?').run(highlight.id)
  db()
    .prepare('INSERT INTO highlights_fts (id, text, note) VALUES (?, ?, ?)')
    .run(highlight.id, highlight.text, highlight.note)
}

export function toFtsQuery(input: string): string {
  const tokens = input
    .replace(/["'*():\-^]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
  if (!tokens.length) return ''
  return tokens.map((token) => `"${token}"*`).join(' AND ')
}

export function search(text: string): { docIds: string[]; highlightIds: string[] } {
  const query = toFtsQuery(text)
  if (!query) return { docIds: [], highlightIds: [] }
  try {
    const docs = db()
      .prepare('SELECT id FROM documents_fts WHERE documents_fts MATCH ? ORDER BY rank LIMIT 50')
      .all(query) as { id: string }[]
    const highlights = db()
      .prepare('SELECT id FROM highlights_fts WHERE highlights_fts MATCH ? ORDER BY rank LIMIT 50')
      .all(query) as { id: string }[]
    return { docIds: docs.map((row) => row.id), highlightIds: highlights.map((row) => row.id) }
  } catch {
    return { docIds: [], highlightIds: [] }
  }
}

export function listSources(): Source[] {
  const rows = db().prepare('SELECT * FROM sources ORDER BY created_at DESC').all() as unknown as Array<{
    id: string
    kind: string
    title: string
    url: string
    site_url: string
    icon_url: string
    enabled: number
    poll_minutes: number
    last_polled_at: string | null
    error: string | null
    rules: string
    created_at: string
  }>
  const counts = db()
    .prepare('SELECT source_id, COUNT(*) AS n FROM documents WHERE deleted = 0 AND source_id IS NOT NULL GROUP BY source_id')
    .all() as { source_id: string; n: number }[]
  const countMap = new Map(counts.map((row) => [row.source_id, Number(row.n)]))
  return rows.map((row) => {
    const rules = parseJson<{ tags?: string[]; autoFullText?: boolean }>(row.rules, {})
    return {
      id: row.id,
      kind: row.kind as Source['kind'],
      title: row.title,
      url: row.url,
      siteUrl: row.site_url,
      iconUrl: row.icon_url,
      enabled: Boolean(row.enabled),
      pollMinutes: Number(row.poll_minutes),
      lastPolledAt: row.last_polled_at,
      error: row.error,
      createdAt: row.created_at,
      autoFullText: rules.autoFullText ?? true,
      tags: rules.tags ?? [],
      itemCount: countMap.get(row.id) ?? 0,
    }
  })
}

export function enqueue(kind: string, payload: Record<string, unknown>, runAt = nowIso()): string {
  const id = `job-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
  db()
    .prepare('INSERT INTO jobs (id, kind, payload, status, run_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, kind, JSON.stringify(payload), 'queued', runAt, nowIso())
  return id
}

export function updateSettingsMeta(patch: Partial<Settings>): void {
  const current = getMeta<Settings>('settings', createSeedData().settings)
  setMeta('settings', { ...current, ...patch })
}

export function presetIntegrations(ids: IntegrationId[]): void {
  const current = getMeta<Record<string, unknown>>('integrations', {})
  const next = { ...current }
  for (const id of ids) {
    next[id] = { connected: false, lastSync: null, config: '' }
  }
  setMeta('integrations', next)
}
