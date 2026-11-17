import { json, withUser } from '@/lib/http'

export type SearchResult = {
  id: string
  source: 'apple' | 'index'
  name: string
  author: string
  url: string
  feedUrl?: string
  artwork: string
  description: string
  categories: string[]
  episodeCount?: number
}

type ApplePodcast = {
  collectionId: number
  collectionName: string
  artistName: string
  artworkUrl600: string
  feedUrl?: string
  collectionViewUrl: string
  trackCount?: number
  genres?: string[]
  description?: string
}

type PodcastIndexPodcast = {
  id: number
  title: string
  author: string
  url: string
  feedUrl?: string
  image: string
  description: string
  categories: Record<string, string>
  language: string
}

async function searchApple(term: string): Promise<SearchResult[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=podcast&entity=podcast&limit=20`
  const res = await fetch(url, {
    headers: { 'user-agent': '0xwise/0.1' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return []
  const data = (await res.json()) as { results: ApplePodcast[] }
  return (data.results ?? [])
    .filter((p) => p.feedUrl)
    .map((p) => ({
      id: `apple-${p.collectionId}`,
      source: 'apple' as const,
      name: p.collectionName,
      author: p.artistName,
      url: p.collectionViewUrl,
      feedUrl: p.feedUrl,
      artwork: p.artworkUrl600,
      description: p.description ?? '',
      categories: p.genres ?? [],
      episodeCount: p.trackCount,
    }))
}

async function searchPodcastIndex(term: string): Promise<SearchResult[]> {
  const apiKey = process.env.PODCAST_INDEX_API_KEY
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET
  if (!apiKey || !apiSecret) return []

  const now = Math.floor(Date.now() / 1000)
  const authString = apiKey + apiSecret + now
  const authHash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(authString)).then((buf) =>
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
  )

  const url = `https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(term)}&max=20`
  const res = await fetch(url, {
    headers: {
      'user-agent': '0xwise/0.1',
      'x-auth-date': String(now),
      'x-auth-key': apiKey,
      'x-auth-hash': authHash,
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return []
  const data = (await res.json()) as { feeds?: PodcastIndexPodcast[] }
  return (data.feeds ?? [])
    .filter((p) => p.feedUrl)
    .map((p) => ({
      id: `index-${p.id}`,
      source: 'index' as const,
      name: p.title,
      author: p.author ?? '',
      url: p.url ?? '',
      feedUrl: p.feedUrl,
      artwork: p.image ?? '',
      description: p.description ?? '',
      categories: Object.values(p.categories ?? {}),
    }))
}



export async function GET(request: Request) {
  return withUser(async () => {
    const { searchParams } = new URL(request.url)
    const term = searchParams.get('q') ?? ''
    const sources = searchParams.get('sources')?.split(',') ?? ['apple', 'index']

    if (!term.trim()) return json({ results: [] })

    const results: SearchResult[] = []
    if (sources.includes('apple')) {
      const apple = await searchApple(term.trim())
      results.push(...apple)
    }
    if (sources.includes('index')) {
      const index = await searchPodcastIndex(term.trim())
      results.push(...index)
    }

    // Deduplicate by feedUrl
    const seen = new Set<string>()
    const unique = results.filter((r) => {
      if (!r.feedUrl) return true
      if (seen.has(r.feedUrl)) return false
      seen.add(r.feedUrl)
      return true
    })

    return json({ results: unique })
  })
}
