import { getState } from '@/lib/state'
import { highlightsToCsv, libraryToMarkdown, readwiseV2Response, writeObsidianVault } from '@/lib/export'
import { json, withUser } from '@/lib/http'

function attachment(body: string, filename: string, type: string) {
  return new Response(body, {
    headers: {
      'content-type': `${type}; charset=utf-8`,
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
}

export async function GET(request: Request) {
  return withUser(async () => {
    const url = new URL(request.url)
    const format = url.searchParams.get('format') ?? 'json'
    const state = getState()
    const stamp = new Date().toISOString().slice(0, 10)

    if (format === 'markdown' || format === 'md') {
      return attachment(libraryToMarkdown(), `0xwise-library-${stamp}.md`, 'text/markdown')
    }
    if (format === 'csv') {
      return attachment(highlightsToCsv(state.highlights, state.docs), `0xwise-highlights-${stamp}.csv`, 'text/csv')
    }
    if (format === 'readwise') {
      return json(readwiseV2Response({ pageSize: 1000 }))
    }
    if (format === 'obsidian' || format === 'logseq') {
      const dir =
        url.searchParams.get('dir') ||
        (format === 'obsidian' ? state.integrations.obsidian?.config : state.integrations.logseq?.config) ||
        ''
      if (!dir) return json({ error: 'Set a vault folder path first' }, { status: 400 })
      try {
        const result = writeObsidianVault(dir)
        return json({ ok: true, ...result })
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Could not write vault' }, { status: 400 })
      }
    }
    if (format === 'backup') {
      return attachment(JSON.stringify(state, null, 2), `0xwise-backup-${stamp}.json`, 'application/json')
    }
    return json(state)
  })
}
