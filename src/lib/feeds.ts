import Parser from 'rss-parser'
import { randomBytes } from 'node:crypto'
import { db, findDocByUrl, getMeta, insertDoc, nowIso, updateDocRow } from './db'
import type { Doc, Source } from '@/dashboard/types'

type FeedItem = {
  title?: string
  link?: string
  guid?: string
  pubDate?: string
  isoDate?: string
  creator?: string
  author?: string
  contentSnippet?: string
  content?: string
  summary?: string
  enclosure?: { url?: string; length?: string; type?: string }
  'content:encoded'?: string
  'dc:creator'?: string
  itunes?: { duration?: string; image?: string; author?: string }
  image?: { url?: string } | string
}

const COLORS = ['clay', 'sage', 'ink', 'sky', 'sand', 'moss', 'rose', 'slate']

function unwrapCdata(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}

export function htmlToParagraphs(html: string): string[] {
  if (!html) return []
  const withBreaks = unwrapCdata(html)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, '\n\n')
    .replace(/<h[1-3][^>]*>/gi, '\n\n## ')
    .replace(/<h[4-6][^>]*>/gi, '\n\n### ')
    .replace(/<blockquote[^>]*>/gi, '\n\n> ')
    .replace(/<li[^>]*>/gi, '\n\n- ')
  return withBreaks
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1)
}

export function parseDuration(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parts = value.split(':').map((part) => Number(part))
  if (parts.some((part) => Number.isNaN(part))) {
    const num = Number(value)
    return Number.isNaN(num) ? undefined : num
  }
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0]
}

function stripHtml(value: string | undefined): string {
  if (!value) return ''
  return unwrapCdata(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function fetchText(
  url: string,
  options: { etag?: string | null; lastModified?: string | null } = {},
): Promise<{ status: number; body: string; etag: string | null; lastModified: string | null }> {
  const headers: Record<string, string> = {
    'user-agent': '0xwise/0.1 (+self-hosted reader)',
    accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8',
  }
  if (options.etag) headers['if-none-match'] = options.etag
  if (options.lastModified) headers['if-modified-since'] = options.lastModified

  const response = await fetch(url, {
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  })
  return {
    status: response.status,
    body: response.status === 304 ? '' : await response.text(),
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
  }
}

export type PollResult = { added: number; checked: number; error?: string }

export async function pollSource(sourceId: string): Promise<PollResult> {
  const source = db()
    .prepare(
      'SELECT id, kind, title, url, site_url, icon_url, etag, last_modified, rules FROM sources WHERE id = ?',
    )
    .get(sourceId) as
    | {
        id: string
        kind: string
        title: string
        url: string
        site_url: string
        icon_url: string
        etag: string | null
        last_modified: string | null
        rules: string
      }
    | undefined
  if (!source) return { added: 0, checked: 0, error: 'Source not found' }

  try {
    const response = await fetchText(source.url, {
      etag: source.etag,
      lastModified: source.last_modified,
    })
    if (response.status === 304) {
      db().prepare('UPDATE sources SET last_polled_at = ?, error = NULL WHERE id = ?').run(nowIso(), source.id)
      return { added: 0, checked: 0 }
    }
    if (response.status >= 400) {
      throw new Error(`Feed responded ${response.status}`)
    }

    const parser = new Parser({
      customFields: { item: ['content:encoded', 'dc:creator', 'itunes', 'image'] },
    })
    const feed = await parser.parseString(response.body)
    const rules = (() => {
      try {
        return JSON.parse(source.rules) as { tags?: string[] }
      } catch {
        return {}
      }
    })()
    const tags = Array.isArray(rules.tags) ? rules.tags : []
    const items = (feed.items ?? []).slice(0, 80) as FeedItem[]
    let added = 0

    for (const item of items) {
      const link = (item.link ?? '').trim()
      if (!link) continue
      if (findDocByUrl(link)) continue

      const encoded = item['content:encoded'] ?? item.content ?? item.summary ?? ''
      const paragraphs = htmlToParagraphs(encoded)
      const isPodcast = source.kind === 'podcast' || Boolean(item.enclosure?.url && item.enclosure.type?.includes('audio'))
      const audioUrl = item.enclosure?.url
      const duration = parseDuration(item.itunes?.duration)
      const published = item.isoDate ?? (item.pubDate ? new Date(item.pubDate).toISOString() : undefined)
      const cover =
        typeof item.image === 'string' ? item.image : item.image?.url ?? item.itunes?.image ?? source.icon_url ?? undefined
      const summary = stripHtml(item.contentSnippet ?? item.summary ?? encoded).slice(0, 320)
      const words = paragraphs.join(' ').split(/\s+/).filter(Boolean).length

      const doc: Doc = {
        id: `doc-${randomBytes(8).toString('hex')}`,
        title: stripHtml(item.title) || 'Untitled',
        author: stripHtml(item.creator ?? item['dc:creator'] ?? item.author ?? item.itunes?.author) ||
          stripHtml(feed.title) || source.title,
        source: source.title,
        url: link,
        category: isPodcast ? 'Podcast' : 'Article',
        addedAt: nowIso(),
        minutes: isPodcast && duration
          ? Math.max(1, Math.round(duration / 60))
          : Math.max(1, Math.round(words / 220)),
        progress: 0,
        favorite: false,
        archived: false,
        color: COLORS[added % COLORS.length],
        summary: summary || (isPodcast ? 'Podcast episode' : 'From your RSS feed'),
        content: paragraphs,
        tags,
        kind: isPodcast ? 'podcast' : 'article',
        cover,
        audioUrl,
        durationSec: duration,
        publishedAt: published,
        sourceId: source.id,
        status: 'ready',
        transcript: [],
        chapters: [],
      }
      insertDoc(doc)
      added += 1
    }

    db()
      .prepare(
        'UPDATE sources SET last_polled_at = ?, etag = ?, last_modified = ?, error = NULL, title = COALESCE(NULLIF(?, \'\'), title) WHERE id = ?',
      )
      .run(nowIso(), response.etag, response.lastModified, stripHtml(feed.title), source.id)

    return { added, checked: items.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Feed failed'
    db().prepare('UPDATE sources SET last_polled_at = ?, error = ? WHERE id = ?').run(nowIso(), message, source.id)
    return { added: 0, checked: 0, error: message }
  }
}

export async function pollAllSources(): Promise<{ source: string; result: PollResult }[]> {
  const rows = db()
    .prepare('SELECT id, title FROM sources WHERE enabled = 1')
    .all() as { id: string; title: string }[]
  const results: { source: string; result: PollResult }[] = []
  for (const row of rows) {
    results.push({ source: row.title, result: await pollSource(row.id) })
  }
  return results
}

export function addSource(input: {
  url: string
  kind?: Source['kind']
  title?: string
  tags?: string[]
}): { id: string; error?: string } {
  const url = input.url.trim()
  if (!/^https?:\/\//i.test(url)) return { id: '', error: 'Enter a valid http(s) URL' }
  const existing = db().prepare('SELECT id FROM sources WHERE url = ?').get(url) as { id: string } | undefined
  if (existing) return { id: existing.id, error: 'Already subscribed' }
  const id = `src-${randomBytes(8).toString('hex')}`
  db()
    .prepare(
      `INSERT INTO sources (id, kind, title, url, site_url, icon_url, enabled, poll_minutes, rules, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, 30, ?, ?)`,
    )
    .run(
      id,
      input.kind ?? 'rss',
      input.title?.trim() || url.replace(/^https?:\/\//, '').replace(/\/$/, ''),
      url,
      new URL(url).origin,
      '',
      JSON.stringify({ tags: input.tags ?? [], autoFullText: true }),
      nowIso(),
    )
  return { id }
}
