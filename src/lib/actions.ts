import { randomBytes } from 'node:crypto'
import type {
  AppData,
  Category,
  Doc,
  Highlight,
  HighlightColor,
  IntegrationId,
  Rating,
  Settings,
  SourceKind,
} from '@/dashboard/types'
import { createSeedData } from '@/dashboard/data'
import {
  db,
  deleteDocRow,
  deleteHighlightRow,
  enqueue,
  findDocByUrl,
  getDoc,
  getHighlight,
  getMeta,
  insertDoc,
  insertHighlight,
  listDocs,
  setMeta,
  updateDocRow,
  updateHighlightRow,
} from './db'
import { getState, applyReview, saveReview } from './state'
import { addSource, pollSource } from './feeds'

type Json = Record<string, unknown>

export type ActionResult = {
  data: AppData
  id?: string
  counts?: { docs: number; highlights: number }
  error?: string
}

const COLORS = ['clay', 'sage', 'ink', 'sky', 'sand', 'moss', 'rose', 'slate']
const DAY_MS = 86_400_000

function uid(prefix: string): string {
  return `${prefix}-${randomBytes(8).toString('hex')}`
}

export async function applyAction(type: string, payload: Json): Promise<ActionResult> {
  switch (type) {
    case 'rateHighlight': {
      const highlight = getHighlight(String(payload.id))
      if (!highlight) return { data: getState(), error: 'Highlight not found' }
      const { highlight: next, review } = applyReview(highlight, payload.rating as Rating)
      updateHighlightRow(next.id, next)
      saveReview(review)
      return { data: getState() }
    }

    case 'addHighlight': {
      const input = (payload.input ?? {}) as {
        id?: string
        docId?: string
        text?: string
        note?: string
        tags?: string[]
        color?: HighlightColor
        location?: Highlight['location']
        source?: Highlight['source']
      }
      const text = (input.text ?? '').trim()
      if (!text || !input.docId) return { data: getState(), error: 'Nothing to save' }
      const now = new Date().toISOString()
      const highlight: Highlight = {
        id: input.id ? String(input.id) : uid('hl'),
        docId: input.docId,
        text,
        note: (input.note ?? '').trim(),
        tags: input.tags ?? [],
        createdAt: now,
        favorite: false,
        color: input.color ?? 'yellow',
        lastReviewed: null,
        reviewCount: 0,
        dueAt: now,
        intervalDays: 0,
        ease: 2.5,
        lapses: 0,
        location: input.location,
        source: input.source ?? 'reader',
      }
      insertHighlight(highlight)
      return { data: getState(), id: highlight.id }
    }

    case 'updateHighlight': {
      const id = String(payload.id)
      updateHighlightRow(id, (payload.patch ?? {}) as Partial<Highlight>)
      return { data: getState() }
    }

    case 'deleteHighlight': {
      deleteHighlightRow(String(payload.id))
      return { data: getState() }
    }

    case 'toggleHighlightFavorite': {
      const highlight = getHighlight(String(payload.id))
      if (highlight) updateHighlightRow(highlight.id, { favorite: !highlight.favorite })
      return { data: getState() }
    }

    case 'addDoc': {
      const input = (payload.input ?? {}) as {
        id?: string
        title?: string
        author?: string
        source?: string
        url?: string
        category?: Category
        summary?: string
        content?: string[]
        tags?: string[]
        kind?: Doc['kind']
        cover?: string
        audioUrl?: string
        durationSec?: number
      }
      const url = (input.url ?? '').trim()
      if (url) {
        const existing = findDocByUrl(url)
        if (existing) return { data: getState(), id: existing.id }
      }
      const content = (input.content ?? []).filter(Boolean)
      const words = content.join(' ').split(/\s+/).filter(Boolean).length
      const doc: Doc = {
        id: input.id ? String(input.id) : uid('doc'),
        title: (input.title ?? '').trim() || 'Untitled',
        author: (input.author ?? '').trim() || 'Unknown',
        source: (input.source ?? '').trim() || 'Personal import',
        url,
        category: input.category ?? 'Article',
        addedAt: new Date().toISOString(),
        minutes: Math.max(1, Math.round(words / 220)),
        progress: 0,
        favorite: false,
        archived: false,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        summary: (input.summary ?? '').trim() || (content[0] ? `${content[0].slice(0, 120)}…` : 'A saved page.'),
        content,
        tags: input.tags ?? [],
        kind: input.kind ?? 'article',
        cover: input.cover,
        audioUrl: input.audioUrl,
        durationSec: input.durationSec,
        status: 'ready',
        transcript: [],
        chapters: [],
      }
      insertDoc(doc)
      return { data: getState(), id: doc.id }
    }

    case 'updateDoc': {
      updateDocRow(String(payload.id), (payload.patch ?? {}) as Partial<Doc>)
      return { data: getState() }
    }

    case 'toggleDocFavorite': {
      const doc = getDoc(String(payload.id))
      if (doc) updateDocRow(doc.id, { favorite: !doc.favorite })
      return { data: getState() }
    }

    case 'archiveDoc': {
      updateDocRow(String(payload.id), { archived: Boolean(payload.archived) })
      return { data: getState() }
    }

    case 'deleteDoc': {
      deleteDocRow(String(payload.id))
      return { data: getState() }
    }

    case 'updateSettings': {
      const current = getMeta('settings', createSeedData().settings)
      setMeta('settings', { ...current, ...(payload.patch as Partial<Settings>) })
      return { data: getState() }
    }

    case 'setTheme': {
      const current = getMeta('settings', createSeedData().settings)
      setMeta('settings', { ...current, theme: payload.theme })
      return { data: getState() }
    }

    case 'updateIntegration': {
      const integrations = getMeta<Record<string, unknown>>('integrations', {})
      const id = payload.id as IntegrationId
      const patch = (payload.patch ?? {}) as Record<string, unknown>
      integrations[id] = { ...(integrations[id] as Record<string, unknown>), ...patch }
      setMeta('integrations', integrations)
      return { data: getState() }
    }

    case 'toggleIntegration': {
      const integrations = getMeta<Record<string, Record<string, unknown>>>('integrations', {})
      const id = payload.id as IntegrationId
      const entry = integrations[id] ?? { connected: false, lastSync: null, config: '' }
      integrations[id] = {
        ...entry,
        connected: !entry.connected,
        lastSync: !entry.connected ? new Date().toISOString() : entry.lastSync,
      }
      setMeta('integrations', integrations)
      return { data: getState() }
    }

    case 'syncIntegration': {
      const integrations = getMeta<Record<string, Record<string, unknown>>>('integrations', {})
      const id = payload.id as IntegrationId
      integrations[id] = {
        ...(integrations[id] ?? { connected: false, config: '' }),
        lastSync: new Date().toISOString(),
      }
      setMeta('integrations', integrations)
      return { data: getState() }
    }

    case 'importBackup': {
      return importBackup(payload.payload)
    }

    case 'addImportRecord': {
      const imports = getMeta<AppData['imports']>('imports', [])
      imports.unshift({
        id: uid('import'),
        name: String(payload.name ?? 'Import'),
        date: new Date().toISOString(),
        count: Number(payload.count ?? 0),
      })
      setMeta('imports', imports.slice(0, 12))
      return { data: getState() }
    }

    case 'resetAll': {
      const settings = getMeta('settings', createSeedData().settings)
      db().exec('DELETE FROM documents; DELETE FROM highlights; DELETE FROM sources; DELETE FROM jobs;')
      db().exec('DELETE FROM documents_fts; DELETE FROM highlights_fts;')
      setMeta('imports', [])
      setMeta('review', createSeedData().review)
      setMeta('settings', {
        ...createSeedData().settings,
        displayName: settings.displayName,
        email: settings.email,
        theme: settings.theme,
        fontScale: settings.fontScale,
        reduceMotion: settings.reduceMotion,
        dailyGoal: settings.dailyGoal,
        language: settings.language,
      })
      return { data: getState() }
    }

    case 'addSource': {
      const input = (payload.input ?? {}) as {
        url?: string
        kind?: SourceKind
        title?: string
        tags?: string[]
      }
      const created = addSource({
        url: String(input.url ?? ''),
        kind: input.kind,
        title: input.title,
        tags: input.tags,
      })
      if (created.error && !created.id) return { data: getState(), error: created.error }
      if (created.id) {
        const poll = await pollSource(created.id)
        return { data: getState(), id: created.id, counts: { docs: poll.added, highlights: 0 }, error: poll.error }
      }
      return { data: getState(), error: created.error }
    }

    case 'pollSource': {
      const poll = await pollSource(String(payload.id))
      return { data: getState(), counts: { docs: poll.added, highlights: 0 }, error: poll.error }
    }

    case 'deleteSource': {
      db().prepare('DELETE FROM sources WHERE id = ?').run(String(payload.id))
      return { data: getState() }
    }

    case 'enqueueTranscribe': {
      const docId = String(payload.id)
      const doc = getDoc(docId)
      if (!doc) return { data: getState(), error: 'Document not found' }
      enqueue('transcribe', { docId })
      updateDocRow(docId, { status: 'transcribing' })
      return { data: getState(), id: docId }
    }

    case 'refresh':
      return { data: getState() }

    default:
      return { data: getState(), error: `Unknown action: ${type}` }
  }
}

function importBackup(payload: unknown): ActionResult {
  const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null
  if (!isObject(payload)) return { data: getState(), error: 'Invalid backup file' }
  const candidate =
    isObject(payload.data) && Array.isArray((payload.data as Json).docs)
      ? (payload.data as Json)
      : payload
  if (!Array.isArray(candidate.docs) || !Array.isArray(candidate.highlights)) {
    return { data: getState(), error: 'Backup needs docs and highlights arrays' }
  }

  let addedDocs = 0
  let addedHighlights = 0
  const docIds = new Set(listDocs(true).map((doc) => doc.id))

  for (const raw of candidate.docs as unknown[]) {
    if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.title !== 'string') continue
    if (docIds.has(raw.id)) continue
    if (typeof raw.url === 'string' && raw.url && findDocByUrl(raw.url)) continue
    const content = Array.isArray(raw.content) ? raw.content.filter((item): item is string => typeof item === 'string') : []
    const doc: Doc = {
      id: raw.id,
      title: raw.title,
      author: typeof raw.author === 'string' ? raw.author : 'Unknown',
      source: typeof raw.source === 'string' ? raw.source : 'Import',
      url: typeof raw.url === 'string' ? raw.url : '',
      category: (typeof raw.category === 'string' ? raw.category : 'Article') as Category,
      addedAt: typeof raw.addedAt === 'string' ? raw.addedAt : new Date().toISOString(),
      minutes: typeof raw.minutes === 'number' ? raw.minutes : 1,
      progress: typeof raw.progress === 'number' ? raw.progress : 0,
      favorite: Boolean(raw.favorite),
      archived: Boolean(raw.archived),
      color: typeof raw.color === 'string' ? raw.color : 'clay',
      summary: typeof raw.summary === 'string' ? raw.summary : '',
      content,
      tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      kind: typeof raw.kind === 'string' ? (raw.kind as Doc['kind']) : 'article',
      status: 'ready',
      transcript: [],
      chapters: [],
    }
    try {
      insertDoc(doc)
      docIds.add(doc.id)
      addedDocs += 1
    } catch {
      // Skip rows that clash with an existing URL.
    }
  }

  const highlightIds = new Set(getState().highlights.map((highlight) => highlight.id))
  for (const raw of candidate.highlights as unknown[]) {
    if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.text !== 'string') continue
    if (typeof raw.docId !== 'string' || !docIds.has(raw.docId)) continue
    if (highlightIds.has(raw.id)) continue
    const now = new Date().toISOString()
    const highlight: Highlight = {
      id: raw.id,
      docId: raw.docId,
      text: raw.text,
      note: typeof raw.note === 'string' ? raw.note : '',
      tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
      favorite: Boolean(raw.favorite),
      color: (typeof raw.color === 'string' ? raw.color : 'yellow') as HighlightColor,
      lastReviewed: typeof raw.lastReviewed === 'string' ? raw.lastReviewed : null,
      reviewCount: typeof raw.reviewCount === 'number' ? raw.reviewCount : 0,
      dueAt: typeof raw.dueAt === 'string' ? raw.dueAt : now,
      intervalDays: typeof raw.intervalDays === 'number' ? raw.intervalDays : 0,
      ease: typeof raw.ease === 'number' ? raw.ease : 2.5,
      lapses: typeof raw.lapses === 'number' ? raw.lapses : 0,
      source: 'import',
    }
    insertHighlight(highlight)
    highlightIds.add(highlight.id)
    addedHighlights += 1
  }

  return {
    data: getState(),
    counts: { docs: addedDocs, highlights: addedHighlights },
  }
}

export const REVIEW_INTERVALS: Record<Rating, string> = {
  again: '10 minutes',
  hard: '1 day',
  good: '3 days',
  easy: '7 days',
}

export { DAY_MS }
