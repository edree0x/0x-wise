import { useMemo, useState, type FormEvent } from 'react'
import { useStore, makePreviewEpisodeId, type DiscoverResult, type PreviewEpisode } from '../store'
import { Icon } from '../icons'
import { EmptyState } from '../ui'
import { relativeTime } from '../utils'

function durationLabel(seconds?: number): string {
  if (!seconds) return ''
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.round((total % 3600) / 60)
  return hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`
}

export function DiscoverPage({ onOpenEpisode }: { onOpenEpisode: (id: string) => void }) {
  const { data, actions, showToast } = useStore()
  const [term, setTerm] = useState('')
  const [useApple, setUseApple] = useState(true)
  const [useIndex, setUseIndex] = useState(true)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<DiscoverResult[]>([])
  const [searched, setSearched] = useState(false)

  const [expandedFeed, setExpandedFeed] = useState<string | null>(null)
  const [episodesByFeed, setEpisodesByFeed] = useState<Record<string, PreviewEpisode[]>>({})
  const [episodesLoading, setEpisodesLoading] = useState<string | null>(null)

  const [rssUrl, setRssUrl] = useState('')
  const [rssBusy, setRssBusy] = useState(false)
  const [following, setFollowing] = useState<string | null>(null)

  const followedFeedUrls = useMemo(() => new Set((data.sources ?? []).map((s) => s.url)), [data.sources])

  const search = async (event?: FormEvent) => {
    event?.preventDefault()
    const q = term.trim()
    if (!q || busy) return
    const selected = [useApple ? 'apple' : null, useIndex ? 'index' : null].filter(Boolean) as string[]
    if (!selected.length) {
      showToast('Choose at least one source', 'error')
      return
    }
    setBusy(true)
    setSearched(true)
    const found = await actions.discover(q, selected)
    setResults(found)
    setExpandedFeed(null)
    setBusy(false)
  }

  const togglePreview = async (result: DiscoverResult) => {
    if (!result.feedUrl) return
    if (expandedFeed === result.feedUrl) {
      setExpandedFeed(null)
      return
    }
    actions.setPreviewShow({
      feedUrl: result.feedUrl,
      name: result.name,
      author: result.author,
      artwork: result.artwork,
    })
    setExpandedFeed(result.feedUrl)
    if (episodesByFeed[result.feedUrl]) return
    setEpisodesLoading(result.feedUrl)
    const episodes = await actions.fetchPreviewEpisodes(result.feedUrl)
    setEpisodesByFeed((current) => ({ ...current, [result.feedUrl]: episodes }))
    setEpisodesLoading(null)
  }

  const follow = async (result: { feedUrl?: string; name: string }) => {
    if (!result.feedUrl || following) return
    setFollowing(result.feedUrl)
    const res = await actions.followShow({ feedUrl: result.feedUrl, name: result.name })
    setFollowing(null)
    if (!res) return
    if (res.error && !res.id) {
      showToast(res.error, 'error')
      return
    }
    if (res.error && res.id) {
      showToast(res.error, 'error')
      return
    }
    const added = res.counts?.docs ?? 0
    showToast(added > 0 ? `Followed · ${added} episode${added === 1 ? '' : 's'} added` : 'Podcast saved to your library', 'success')
  }

  const addRss = async (event: FormEvent) => {
    event.preventDefault()
    const url = rssUrl.trim()
    if (!url || rssBusy) return
    setRssBusy(true)
    const res = await actions.followShow({ feedUrl: url })
    setRssBusy(false)
    if (!res) return
    if (res.error && !res.id) {
      showToast(res.error, 'error')
      return
    }
    const added = res.counts?.docs ?? 0
    showToast(added > 0 ? `Added feed · ${added} episode${added === 1 ? '' : 's'}` : 'Feed added to your library', 'success')
    setRssUrl('')
  }

  return (
    <div className="page discover-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Discover</p>
          <h1>Find podcasts.</h1>
          <p className="page-sub">
            Search Apple Podcasts and Podcast Index, preview episodes without subscribing, or follow shows to save them to your library.
          </p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-head">
          <h2>Search podcasts</h2>
          <p>Choose sources, search once, and browse merged results.</p>
        </div>
        <form className="discover-search" onSubmit={search}>
          <label className="field-label discover-search-field" htmlFor="discover-q">
            <span>Search</span>
            <input
              id="discover-q"
              className="input"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search by show, topic, or creator"
            />
          </label>
          <div className="discover-source-toggles" role="group" aria-label="Search sources">
            <label className="check-row">
              <input type="checkbox" checked={useApple} onChange={(e) => setUseApple(e.target.checked)} />
              <span>Apple Podcasts</span>
            </label>
            <label className="check-row">
              <input type="checkbox" checked={useIndex} onChange={(e) => setUseIndex(e.target.checked)} />
              <span>Podcast Index</span>
            </label>
          </div>
          <button type="submit" className="btn btn--primary" disabled={busy || !term.trim()}>
            <Icon name="search" size={16} />
            {busy ? 'Searching…' : 'Search'}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Add by RSS URL</h2>
          <p>Paste a podcast feed URL to follow it directly.</p>
        </div>
        <form className="source-form" onSubmit={addRss}>
          <label className="field-label source-form-url" htmlFor="discover-rss-url">
            <span>Feed URL</span>
            <input
              id="discover-rss-url"
              className="input"
              type="url"
              value={rssUrl}
              onChange={(e) => setRssUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
            />
          </label>
          <button type="submit" className="btn btn--soft" disabled={rssBusy || !rssUrl.trim()}>
            <Icon name="plus" size={16} />
            {rssBusy ? 'Adding…' : 'Add feed'}
          </button>
        </form>
      </section>

      {results.length ? (
        <section className="panel">
          <div className="panel-head">
            <h2>Results</h2>
            <p>{results.length} show{results.length === 1 ? '' : 's'} found. Preview plays episodes without saving to your library.</p>
          </div>
          <ul className="discover-results">
            {results.map((result) => {
              const followed = result.feedUrl ? followedFeedUrls.has(result.feedUrl) : false
              const expanded = expandedFeed === result.feedUrl
              const loading = episodesLoading === result.feedUrl
              const episodes = result.feedUrl ? episodesByFeed[result.feedUrl] ?? [] : []
              return (
                <li key={`${result.source}-${result.id}`} className="discover-result">
                  <div className="discover-result-main">
                    <span className="discover-artwork" aria-hidden="true">
                      {result.artwork ? <img src={result.artwork} alt="" loading="lazy" /> : <Icon name="listen" size={20} />}
                    </span>
                    <div className="discover-copy">
                      <p className="discover-meta-line">
                        <span className="tag-pill">{result.source === 'apple' ? 'Apple' : 'Podcast Index'}</span>
                        {result.author ? <span>{result.author}</span> : null}
                        {result.episodeCount ? <span>{result.episodeCount} episodes</span> : null}
                      </p>
                      <h3>{result.name}</h3>
                      {result.description ? <p className="discover-desc">{result.description}</p> : null}
                      {result.categories?.length ? (
                        <p className="discover-cats">{result.categories.slice(0, 4).join(' · ')}</p>
                      ) : null}
                    </div>
                    <div className="discover-actions">
                      <button
                        type="button"
                        className="btn btn--soft btn--small"
                        disabled={!result.feedUrl || loading}
                        onClick={() => void togglePreview(result)}
                      >
                        <Icon name={expanded ? 'up' : 'play'} size={15} />
                        {expanded ? 'Hide episodes' : loading ? 'Loading…' : 'Preview episodes'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--primary btn--small"
                        disabled={!result.feedUrl || followed || following === result.feedUrl}
                        onClick={() => void follow(result)}
                      >
                        <Icon name={followed ? 'check' : 'plus'} size={15} />
                        {followed ? 'Following' : following === result.feedUrl ? 'Saving…' : 'Follow'}
                      </button>
                    </div>
                  </div>
                  {expanded ? (
                    <div className="discover-episodes">
                      {loading ? (
                        <p className="panel-empty">Loading episodes…</p>
                      ) : episodes.length ? (
                        <ul className="discover-episode-list">
                          {episodes.map((episode) => {
                            const previewId = makePreviewEpisodeId(result.feedUrl, episode.id)
                            return (
                              <li key={previewId} className="discover-episode">
                                <button
                                  type="button"
                                  className="discover-episode-play"
                                  disabled={!episode.audioUrl}
                                  onClick={() => onOpenEpisode(previewId)}
                                  aria-label={episode.audioUrl ? `Play ${episode.title}` : 'No audio available'}
                                  title={episode.audioUrl ? 'Play preview' : 'No audio available'}
                                >
                                  <Icon name="play" size={16} />
                                </button>
                                <div className="discover-episode-copy">
                                  <strong>{episode.title}</strong>
                                  <span className="discover-episode-meta">
                                    {episode.publishedAt ? relativeTime(episode.publishedAt) : ''}
                                    {episode.publishedAt && episode.durationSec ? ' · ' : ''}
                                    {durationLabel(episode.durationSec)}
                                    {!episode.audioUrl ? ' · No audio file' : ''}
                                  </span>
                                  {episode.description ? <p>{episode.description}</p> : null}
                                </div>
                                <div className="discover-episode-actions">
                                  <button
                                    type="button"
                                    className="btn btn--ghost btn--small"
                                    disabled={!episode.audioUrl}
                                    onClick={() => onOpenEpisode(previewId)}
                                  >
                                    Play
                                  </button>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      ) : (
                        <p className="panel-empty">No episodes found in this feed.</p>
                      )}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : searched && !busy ? (
        <EmptyState
          icon="search"
          title="No podcasts found"
          body="Try a different search term or enable another source."
        />
      ) : null}
    </div>
  )
}
