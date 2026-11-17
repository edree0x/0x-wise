import { json, withUser } from '@/lib/http'
import { fetchFeedEpisodes } from '@/lib/feeds'

export async function GET(request: Request) {
  return withUser(async () => {
    const { searchParams } = new URL(request.url)
    const feedUrl = searchParams.get('feedUrl') ?? ''
    if (!feedUrl.trim() || !/^https?:\/\//i.test(feedUrl)) {
      return json({ episodes: [], error: 'A valid feedUrl is required' }, 400)
    }
    try {
      const episodes = await fetchFeedEpisodes(feedUrl.trim(), 50)
      return json({ episodes })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load episodes'
      return json({ episodes: [], error: message }, 400)
    }
  })
}
