import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import dns from 'node:dns/promises'
import net from 'node:net'
import { randomBytes } from 'node:crypto'
import type { Doc } from '@/dashboard/types'
import { findDocByUrl, getDoc, insertDoc, updateDocRow } from './db'

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 0xwise/0.1'

const COLORS = ['clay', 'sage', 'ink', 'sky', 'sand', 'moss', 'rose', 'slate']

function isPrivateIp(address: string): boolean {
  if (net.isIPv4(address)) {
    const parts = address.split('.').map(Number)
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true
    if (parts[0] === 169 && parts[1] === 254) return true
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
    if (parts[0] === 192 && parts[1] === 168) return true
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true
    return false
  }
  const lower = address.toLowerCase()
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')
}

export async function assertPublicUrl(input: string): Promise<URL> {
  const url = new URL(input)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http(s) URLs are supported')
  const hostname = url.hostname
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.internal')) {
    throw new Error('Local addresses are blocked')
  }
  if (net.isIP(hostname) && isPrivateIp(hostname)) throw new Error('Private addresses are blocked')
  try {
    const resolved = await dns.lookup(hostname, { all: true })
    if (resolved.some((entry) => isPrivateIp(entry.address))) throw new Error('Private addresses are blocked')
  } catch (error) {
    if (error instanceof Error && error.message.includes('blocked')) throw error
    // DNS failures are surfaced by fetch itself.
  }
  return url
}

function metaContent(document: Document, selector: string): string {
  const element = document.querySelector(selector)
  return element?.getAttribute('content')?.trim() ?? ''
}

function textOf(element: Element | null): string {
  if (!element) return ''
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim()
}

export function blocksFromHtml(html: string, baseUrl: string): string[] {
  const dom = new JSDOM(`<body>${html}</body>`, { url: baseUrl })
  const body = dom.window.document.body
  const blocks: string[] = []

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase()
      if (tag === 'script' || tag === 'style' || tag === 'noscript') continue
      if (/^h[1-3]$/.test(tag)) {
        const text = textOf(child)
        if (text) blocks.push(`## ${text}`)
        continue
      }
      if (/^h[4-6]$/.test(tag)) {
        const text = textOf(child)
        if (text) blocks.push(`### ${text}`)
        continue
      }
      if (tag === 'p') {
        const text = textOf(child)
        if (text.length > 1) blocks.push(text)
        continue
      }
      if (tag === 'blockquote') {
        const text = textOf(child)
        if (text) blocks.push(`> ${text}`)
        continue
      }
      if (tag === 'ul' || tag === 'ol') {
        for (const item of Array.from(child.querySelectorAll('li'))) {
          const text = textOf(item)
          if (text) blocks.push(`- ${text}`)
        }
        continue
      }
      if (tag === 'figure' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main') {
        walk(child)
        continue
      }
      if (tag === 'img') {
        const src = (child as HTMLImageElement).src
        const alt = (child as HTMLImageElement).alt
        if (src && /^https?:/i.test(src)) blocks.push(`![${alt || ''}](${src})`)
        continue
      }
      walk(child)
    }
  }

  walk(body)
  dom.window.close()
  return blocks.filter((block) => block.replace(/^[#>\-!\s]+/, '').length > 1)
}

export type Extraction = {
  title: string
  author: string
  source: string
  summary: string
  content: string[]
  cover?: string
  lang?: string
  publishedAt?: string
  url: string
}

export async function extractUrl(input: string): Promise<Extraction> {
  const url = await assertPublicUrl(input)
  const response = await fetch(url, {
    headers: {
      'user-agent': UA,
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'en,ar;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(25_000),
  })
  if (!response.ok) throw new Error(`Page responded ${response.status}`)
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('html') && !contentType.includes('xml')) {
    throw new Error('That URL is not an HTML page')
  }
  const finalUrl = response.url || url.toString()
  const html = await response.text()
  const dom = new JSDOM(html, { url: finalUrl })
  const document = dom.window.document

  const ogTitle = metaContent(document, 'meta[property="og:title"]') || metaContent(document, 'meta[name="twitter:title"]')
  const ogDescription =
    metaContent(document, 'meta[property="og:description"]') ||
    metaContent(document, 'meta[name="description"]') ||
    metaContent(document, 'meta[name="twitter:description"]')
  const ogImage =
    metaContent(document, 'meta[property="og:image"]') ||
    metaContent(document, 'meta[name="twitter:image"]')
  const ogSite = metaContent(document, 'meta[property="og:site_name"]')
  const authorMeta =
    metaContent(document, 'meta[name="author"]') ||
    metaContent(document, 'meta[property="article:author"]') ||
    metaContent(document, 'meta[name="twitter:creator"]')
  const publishedMeta =
    metaContent(document, 'meta[property="article:published_time"]') ||
    metaContent(document, 'meta[name="date"]') ||
    metaContent(document, 'meta[itemprop="datePublished"]')

  let article: {
    title?: string | null
    byline?: string | null
    content?: string | null
    textContent?: string | null
    excerpt?: string | null
    siteName?: string | null
    lang?: string | null
  } | null = null
  try {
    const reader = new Readability(document.cloneNode(true) as Document, { charThreshold: 140 })
    article = reader.parse()
  } catch {
    article = null
  }

  const content = blocksFromHtml(article?.content ?? document.body?.innerHTML ?? '', finalUrl)
  const words = content.join(' ').split(/\s+/).filter(Boolean).length
  const title = (article?.title || ogTitle || textOf(document.querySelector('title')) || url.hostname).trim()

  dom.window.close()

  if (words < 40) {
    throw new Error('Could not find readable text on that page (it may be paywalled or script-rendered)')
  }

  return {
    title,
    author: (article?.byline || authorMeta || 'Unknown').replace(/\s+/g, ' ').trim(),
    source: (article?.siteName || ogSite || url.hostname.replace(/^www\./, '')).trim(),
    summary: (article?.excerpt || ogDescription || content[0] || '').replace(/\s+/g, ' ').slice(0, 400),
    content,
    cover: ogImage || undefined,
    lang: article?.lang || document.documentElement.lang || undefined,
    publishedAt: publishedMeta ? new Date(publishedMeta).toISOString() : undefined,
    url: finalUrl,
  }
}

export async function ingestIntoDoc(docId: string, url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const extraction = await extractUrl(url)
    const doc = getDoc(docId)
    if (!doc) return { ok: false, error: 'Document not found' }
    const words = extraction.content.join(' ').split(/\s+/).filter(Boolean).length
    updateDocRow(docId, {
      title: extraction.title,
      author: extraction.author,
      source: extraction.source,
      summary: extraction.summary,
      content: extraction.content,
      cover: extraction.cover,
      lang: extraction.lang,
      publishedAt: extraction.publishedAt,
      minutes: Math.max(1, Math.round(words / 220)),
      status: 'ready',
      error: undefined,
    })
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Extraction failed'
    updateDocRow(docId, { status: 'error', error: message })
    return { ok: false, error: message }
  }
}

export function createBookmarkDoc(input: {
  title: string
  url?: string
  category?: Doc['category']
  source?: string
  summary?: string
}): Doc {
  const url = (input.url ?? '').trim()
  const existing = url ? findDocByUrl(url) : null
  if (existing) return existing
  const doc: Doc = {
    id: `doc-${randomBytes(8).toString('hex')}`,
    title: input.title.trim() || 'Untitled',
    author: 'Unknown',
    source: input.source?.trim() || (url ? new URL(url).hostname.replace(/^www\./, '') : 'Personal import'),
    url,
    category: input.category ?? 'Article',
    addedAt: new Date().toISOString(),
    minutes: 1,
    progress: 0,
    favorite: false,
    archived: false,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    summary: input.summary ?? 'Fetching the article…',
    content: [],
    tags: [],
    kind: 'article',
    status: 'fetching',
    transcript: [],
    chapters: [],
  }
  insertDoc(doc)
  return doc
}
