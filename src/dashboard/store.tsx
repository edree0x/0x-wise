'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  AppData,
  Category,
  Doc,
  Highlight,
  HighlightColor,
  IntegrationId,
  IntegrationState,
  Rating,
  Settings,
  Source,
  SourceKind,
  ThemeName,
  ToastKind,
} from './types'
import { createSeedData } from './data'

type Toast = { id: number; message: string; kind: ToastKind }

type NewDocInput = {
  id?: string
  title: string
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

type NewHighlightInput = {
  id?: string
  docId: string
  text: string
  note?: string
  tags?: string[]
  color?: HighlightColor
  source?: Highlight['source']
  location?: Highlight['location']
}

type ImportResult = { docs: number; highlights: number }

type SourceInput = {
  url: string
  kind?: SourceKind
  title?: string
  tags?: string[]
}

type ActionResult = {
  data?: AppData
  id?: string
  counts?: { docs: number; highlights: number }
  error?: string
}

type Actions = {
  rateHighlight: (id: string, rating: Rating) => void
  addHighlight: (input: NewHighlightInput) => string | null
  updateHighlight: (id: string, patch: Partial<Highlight>) => void
  deleteHighlight: (id: string) => void
  toggleHighlightFavorite: (id: string) => void
  addDoc: (input: NewDocInput) => string
  updateDoc: (id: string, patch: Partial<Doc>) => void
  toggleDocFavorite: (id: string) => void
  archiveDoc: (id: string, archived: boolean) => void
  deleteDoc: (id: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  setTheme: (theme: ThemeName) => void
  updateIntegration: (id: IntegrationId, patch: Partial<IntegrationState>) => void
  toggleIntegration: (id: IntegrationId) => void
  syncIntegration: (id: IntegrationId) => void
  importBackup: (payload: unknown) => Promise<ImportResult | null>
  addImportRecord: (name: string, count: number) => void
  resetAll: () => void
  refresh: () => void
  ingest: (docId: string, url?: string) => Promise<{ ok: boolean; error?: string } | null>
  addSource: (input: SourceInput) => Promise<ActionResult | null>
  pollSource: (id: string) => Promise<ActionResult | null>
  deleteSource: (id: string) => void
  upload: (file: File) => Promise<{ ok: boolean; id?: string; error?: string } | null>
  transcribe: (id: string) => void
}

type StoreValue = {
  data: AppData
  ready: boolean
  actions: Actions
  toast: Toast | null
  showToast: (message: string, kind?: ToastKind) => void
  dismissToast: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

const COLORS = ['clay', 'sage', 'ink', 'sky', 'sand', 'moss', 'rose', 'slate']

function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).slice(2)
  return `${prefix}-${random.slice(0, 16)}`
}

function minutesOf(content: string[]): number {
  const words = content.join(' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 220))
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const seed = useMemo(() => createSeedData(), [])
  const [data, setData] = useState<AppData>(seed)
  const [ready, setReady] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<number | null>(null)
  const toastId = useRef(0)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const sequence = useRef(0)

  const dismissToast = useCallback(() => {
    setToast(null)
    if (toastTimer.current !== null) {
      window.clearTimeout(toastTimer.current)
      toastTimer.current = null
    }
  }, [])

  const showToast = useCallback((message: string, kind: ToastKind = 'default') => {
    toastId.current += 1
    setToast({ id: toastId.current, message, kind })
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    },
    [],
  )

  const applyState = useCallback((next: AppData) => {
    setData(next)
    setReady(true)
  }, [])

  const request = useCallback(
    async (
      path: string,
      init?: RequestInit,
      options: { quiet?: boolean } = {},
    ): Promise<ActionResult | null> => {
      let response: Response
      try {
        response = await fetch(path, init)
      } catch {
        if (!options.quiet) showToast('Cannot reach the server', 'error')
        return null
      }
      if (response.status === 401) {
        window.location.href = '/login'
        return null
      }
      let body: ActionResult = {}
      try {
        body = (await response.json()) as ActionResult
      } catch {
        body = {}
      }
      if (!response.ok && !body.error) {
        body.error = `Request failed (${response.status})`
      }
      if (body.error && !options.quiet) showToast(body.error, 'error')
      if (body.data) setData(body.data)
      setReady(true)
      return body
    },
    [showToast],
  )

  const send = useCallback(
    (type: string, payload: Record<string, unknown> = {}, options: { quiet?: boolean } = {}) => {
      const ticket = (sequence.current += 1)
      const run = queue.current.then(async () => {
        const result = await request(
          '/api/actions',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ type, payload }),
          },
          options,
        )
        // A newer action has already produced fresher state; skip this stale snapshot.
        if (result?.data && ticket !== sequence.current) return result
        return result
      })
      queue.current = run.catch(() => undefined)
      return run
    },
    [request],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await request('/api/state', undefined, { quiet: true })
      if (cancelled) return
      if (!result?.data) setReady(true)
      else applyState(result.data)
    })()
    const onFocus = () => {
      // Keep the review queue honest when another tab adds a highlight.
      void request('/api/state', undefined, { quiet: true })
    }
    const timer = window.setInterval(onFocus, 120_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [request, applyState])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = data.settings.theme
    root.style.setProperty('--font-scale', String(data.settings.fontScale))
    root.classList.toggle('reduce-motion', data.settings.reduceMotion)
    root.lang = data.settings.language === 'ar' ? 'ar' : 'en'
    root.dir = data.settings.language === 'ar' ? 'rtl' : 'ltr'
    const colors: Record<ThemeName, string> = { light: '#f6f2ea', sepia: '#f3e9d6', dark: '#17181b' }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', colors[data.settings.theme])
  }, [data.settings.theme, data.settings.fontScale, data.settings.reduceMotion, data.settings.language])

  const actions = useMemo<Actions>(() => {
    return {
      rateHighlight: (id, rating) => {
        void send('rateHighlight', { id, rating })
      },

      addHighlight: (input) => {
        const text = input.text.trim()
        if (!text || !input.docId) return null
        const id = input.id ?? newId('hl')
        const now = new Date().toISOString()
        const highlight: Highlight = {
          id,
          docId: input.docId,
          text,
          note: input.note?.trim() ?? '',
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
          source: input.source ?? 'reader',
          location: input.location,
        }
        setData((current) => ({ ...current, highlights: [highlight, ...current.highlights] }))
        void send('addHighlight', { input: { ...input, id } })
        return id
      },

      updateHighlight: (id, patch) => {
        setData((current) => ({
          ...current,
          highlights: current.highlights.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        }))
        void send('updateHighlight', { id, patch })
      },

      deleteHighlight: (id) => {
        setData((current) => ({
          ...current,
          highlights: current.highlights.filter((item) => item.id !== id),
        }))
        void send('deleteHighlight', { id })
      },

      toggleHighlightFavorite: (id) => {
        setData((current) => ({
          ...current,
          highlights: current.highlights.map((item) =>
            item.id === id ? { ...item, favorite: !item.favorite } : item,
          ),
        }))
        void send('toggleHighlightFavorite', { id })
      },

      addDoc: (input) => {
        const id = input.id ?? newId('doc')
        if (data.docs.some((doc) => doc.id === id)) return id
        const content = input.content?.filter(Boolean) ?? []
        const doc: Doc = {
          id,
          title: input.title.trim() || 'Untitled',
          author: input.author?.trim() || 'Unknown',
          source: input.source?.trim() || 'Personal import',
          url: input.url?.trim() || '',
          category: input.category ?? 'Article',
          addedAt: new Date().toISOString(),
          minutes: input.durationSec ? Math.max(1, Math.round(input.durationSec / 60)) : minutesOf(content),
          progress: 0,
          favorite: false,
          archived: false,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          summary: input.summary?.trim() || (content[0] ? `${content[0].slice(0, 120)}…` : 'A saved page.'),
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
        setData((current) => ({ ...current, docs: [doc, ...current.docs] }))
        void send('addDoc', { input: { ...input, id } })
        return id
      },

      updateDoc: (id, patch) => {
        setData((current) => ({
          ...current,
          docs: current.docs.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc)),
        }))
        void send('updateDoc', { id, patch })
      },

      toggleDocFavorite: (id) => {
        setData((current) => ({
          ...current,
          docs: current.docs.map((doc) => (doc.id === id ? { ...doc, favorite: !doc.favorite } : doc)),
        }))
        void send('toggleDocFavorite', { id })
      },

      archiveDoc: (id, archived) => {
        setData((current) => ({
          ...current,
          docs: current.docs.map((doc) => (doc.id === id ? { ...doc, archived } : doc)),
        }))
        void send('archiveDoc', { id, archived })
      },

      deleteDoc: (id) => {
        setData((current) => ({
          ...current,
          docs: current.docs.filter((doc) => doc.id !== id),
          highlights: current.highlights.filter((highlight) => highlight.docId !== id),
        }))
        void send('deleteDoc', { id })
      },

      updateSettings: (patch) => {
        setData((current) => ({ ...current, settings: { ...current.settings, ...patch } }))
        void send('updateSettings', { patch })
      },

      setTheme: (theme) => {
        setData((current) => ({ ...current, settings: { ...current.settings, theme } }))
        void send('setTheme', { theme })
      },

      updateIntegration: (id, patch) => {
        setData((current) => ({
          ...current,
          integrations: { ...current.integrations, [id]: { ...current.integrations[id], ...patch } },
        }))
        void send('updateIntegration', { id, patch })
      },

      toggleIntegration: (id) => {
        setData((current) => {
          const entry = current.integrations[id]
          return {
            ...current,
            integrations: {
              ...current.integrations,
              [id]: {
                ...entry,
                connected: !entry.connected,
                lastSync: !entry.connected ? new Date().toISOString() : entry.lastSync,
              },
            },
          }
        })
        void send('toggleIntegration', { id })
      },

      syncIntegration: (id) => {
        setData((current) => ({
          ...current,
          integrations: {
            ...current.integrations,
            [id]: { ...current.integrations[id], lastSync: new Date().toISOString() },
          },
        }))
        void send('syncIntegration', { id })
      },

      importBackup: async (payload) => {
        const result = await send('importBackup', { payload })
        if (!result?.counts) return null
        return result.counts
      },

      addImportRecord: (name, count) => {
        setData((current) => ({
          ...current,
          imports: [
            { id: newId('import'), name, date: new Date().toISOString(), count },
            ...current.imports,
          ].slice(0, 12),
        }))
        void send('addImportRecord', { name, count })
      },

      resetAll: () => {
        void send('resetAll')
      },

      refresh: () => {
        void send('refresh')
      },

      ingest: async (docId, url) => {
        const result = await request('/api/ingest', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ docId, url }),
        })
        if (!result) return null
        if (result.error) return { ok: false, error: result.error }
        void send('refresh', {}, { quiet: true })
        return { ok: true }
      },

      addSource: async (input) => {
        const result = await send('addSource', { input })
        return result
      },

      pollSource: async (id) => {
        const result = await send('pollSource', { id })
        return result
      },

      deleteSource: (id) => {
        setData((current) => ({
          ...current,
          sources: (current.sources ?? []).filter((source) => source.id !== id),
        }))
        void send('deleteSource', { id })
      },

      upload: async (file) => {
        const form = new FormData()
        form.append('file', file)
        const result = await request('/api/upload', { method: 'POST', body: form })
        if (!result) return null
        if (result.error) return { ok: false, error: result.error }
        if (result.data) setData(result.data)
        else void send('refresh', {}, { quiet: true })
        return { ok: true, id: result.id }
      },

      transcribe: (id) => {
        setData((current) => ({
          ...current,
          docs: current.docs.map((doc) => (doc.id === id ? { ...doc, status: 'transcribing' } : doc)),
        }))
        void send('enqueueTranscribe', { id })
      },
    }
  }, [data.docs, request, send])

  const value = useMemo<StoreValue>(
    () => ({ data, ready, actions, toast, showToast, dismissToast }),
    [data, ready, actions, toast, showToast, dismissToast],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside StoreProvider')
  return value
}
