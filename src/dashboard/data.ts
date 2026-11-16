import type { AppData, IntegrationId, IntegrationState } from './types'

const DAY = 86_400_000

export function daysFromNow(days: number): string {
  return new Date(Date.now() + days * DAY).toISOString()
}

export function dateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const INTEGRATION_IDS: IntegrationId[] = [
  'obsidian',
  'notion',
  'logseq',
  'csv',
  'rss',
  'webhook',
  'extension',
  'api',
  'readwise',
]

export const integrationMeta: {
  id: IntegrationId
  name: string
  description: string
  kind: string
}[] = [
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Write every highlight into a vault folder as Markdown, with frontmatter and wikilinks.',
    kind: 'Markdown vault',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Push highlights into a Notion database using an internal integration token.',
    kind: 'Database sync',
  },
  {
    id: 'logseq',
    name: 'Logseq',
    description: 'Export a Logseq-friendly Markdown graph with one page per document.',
    kind: 'Markdown graph',
  },
  {
    id: 'csv',
    name: 'CSV',
    description: 'Download a spreadsheet-friendly export of every highlight and note.',
    kind: 'File export',
  },
  {
    id: 'rss',
    name: 'RSS feeds',
    description: 'Poll your feeds and drop new articles straight into the reading queue.',
    kind: 'Feed reader',
  },
  {
    id: 'webhook',
    name: 'Webhook',
    description: 'POST a JSON payload to your own endpoint whenever a highlight is saved.',
    kind: 'Automation',
  },
  {
    id: 'extension',
    name: 'Browser extension',
    description: 'Clip pages and selections from Chrome, Edge or Brave straight into 0x wise.',
    kind: 'Clipper',
  },
  {
    id: 'api',
    name: 'Readwise-compatible API',
    description: 'Expose /api/v2/highlights so existing Readwise clients and plugins can connect.',
    kind: 'API',
  },
  {
    id: 'readwise',
    name: 'Import from Readwise',
    description: 'Bring an existing Readwise export (CSV or JSON) into 0x wise.',
    kind: 'Import',
  },
]

function integrationState(): Record<IntegrationId, IntegrationState> {
  return INTEGRATION_IDS.reduce(
    (acc, id) => {
      acc[id] = { connected: false, lastSync: null, config: '' }
      return acc
    },
    {} as Record<IntegrationId, IntegrationState>,
  )
}

export function createSeedData(): AppData {
  return {
    version: 1,
    docs: [],
    highlights: [],
    sources: [],
    settings: {
      displayName: 'Reader',
      email: 'reader@0xwise.local',
      dailyGoal: 10,
      theme: 'light',
      fontScale: 1,
      reduceMotion: false,
      language: 'en',
      reviewLimit: 15,
    },
    review: {
      streak: 0,
      lastReviewDate: null,
      reviewsToday: 0,
      reviewsDate: dateKey(),
    },
    integrations: integrationState(),
    imports: [],
  }
}
