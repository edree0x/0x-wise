export type Category = 'Article' | 'Book' | 'Newsletter' | 'Tweet' | 'PDF' | 'Podcast' | 'YouTube'

export type DocKind = 'article' | 'book' | 'epub' | 'pdf' | 'podcast' | 'youtube' | 'newsletter' | 'tweet'

export type TranscriptSegment = {
  start: number
  end: number
  text: string
  speaker?: string
}

export type Doc = {
  id: string
  title: string
  author: string
  source: string
  url: string
  category: Category
  addedAt: string
  minutes: number
  progress: number
  favorite: boolean
  archived: boolean
  color: string
  summary: string
  content: string[]
  tags: string[]
  /** Optional — present on media and imported items. */
  kind?: DocKind
  cover?: string
  audioUrl?: string
  durationSec?: number
  publishedAt?: string
  lang?: string
  sourceId?: string
  transcript?: TranscriptSegment[]
  chapters?: { title: string; start: number }[]
  status?: 'fetching' | 'ready' | 'error' | 'transcribing'
  error?: string
}

export type HighlightColor = 'yellow' | 'blue' | 'green' | 'pink'

export type HighlightLocation =
  | { type: 'quote'; prefix: string; suffix: string; start: number }
  | { type: 'cfi'; cfi: string }
  | { type: 'page'; page: number; rects?: number[][] }
  | { type: 'audio'; startMs: number; endMs: number }

export type Highlight = {
  id: string
  docId: string
  text: string
  note: string
  tags: string[]
  createdAt: string
  favorite: boolean
  color: HighlightColor
  lastReviewed: string | null
  reviewCount: number
  dueAt: string
  /** Optional — extra scheduling and origin metadata. */
  location?: HighlightLocation
  source?: 'reader' | 'extension' | 'podcast' | 'manual' | 'import'
  intervalDays?: number
  ease?: number
  lapses?: number
}

export type ThemeName = 'light' | 'sepia' | 'dark'

export type Settings = {
  displayName: string
  email: string
  dailyGoal: number
  theme: ThemeName
  fontScale: number
  reduceMotion: boolean
  language?: 'en' | 'ar'
  reviewLimit?: number
}

export type ReviewState = {
  streak: number
  lastReviewDate: string | null
  reviewsToday: number
  reviewsDate: string
}

export type IntegrationId =
  | 'obsidian'
  | 'notion'
  | 'logseq'
  | 'csv'
  | 'rss'
  | 'webhook'
  | 'extension'
  | 'api'
  | 'readwise'

export type IntegrationState = {
  connected: boolean
  lastSync: string | null
  config: string
}

export type ImportRecord = {
  id: string
  name: string
  date: string
  count: number
}

export type AppData = {
  version: number
  docs: Doc[]
  highlights: Highlight[]
  sources: Source[]
  settings: Settings
  review: ReviewState
  integrations: Record<IntegrationId, IntegrationState>
  imports: ImportRecord[]
}

export type Rating = 'again' | 'hard' | 'good' | 'easy'

export type ToastKind = 'default' | 'success' | 'error'

export type SourceKind = 'rss' | 'podcast' | 'youtube' | 'newsletter'

export type Source = {
  id: string
  kind: SourceKind
  title: string
  url: string
  siteUrl: string
  iconUrl: string
  enabled: boolean
  pollMinutes: number
  lastPolledAt: string | null
  error: string | null
  createdAt: string
  autoFullText?: boolean
  tags?: string[]
  itemCount?: number
  unreadCount?: number
}
