import { useMemo, useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { Icon } from '../icons'
import { Cover, EmptyState, Modal, ProgressRing } from '../ui'
import { relativeTime } from '../utils'
import type { Doc } from '../types'

function durationLabel(doc: Doc): string {
  if (!doc.durationSec) return `${doc.minutes} min`
  const total = Math.max(0, Math.round(doc.durationSec))
  const hours = Math.floor(total / 3600)
  const minutes = Math.round((total % 3600) / 60)
  return hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`
}

const FILTERS = ['All', 'Unplayed', 'In progress', 'Finished'] as const
type Filter = (typeof FILTERS)[number]

export function ListenPage({
  onOpenEpisode,
  onOpenDoc,
  onOpenSources,
}: {
  onOpenEpisode: (id: string) => void
  onOpenDoc: (id: string) => void
  onOpenSources: () => void
}) {
  const { data, actions, showToast } = useStore()
  const [filter, setFilter] = useState<Filter>('All')
  const [addOpen, setAddOpen] = useState(false)

  const episodes = useMemo(
    () =>
      data.docs
        .filter((doc) => doc.kind === 'podcast' || doc.kind === 'youtube' || doc.category === 'Podcast')
        .filter((doc) => !doc.archived)
        .sort(
          (a, b) =>
            new Date(b.publishedAt ?? b.addedAt).getTime() - new Date(a.publishedAt ?? a.addedAt).getTime(),
        ),
    [data.docs],
  )

  const visible = useMemo(() => {
    return episodes.filter((doc) => {
      if (filter === 'Unplayed') return doc.progress === 0
      if (filter === 'In progress') return doc.progress > 0 && doc.progress < 95
      if (filter === 'Finished') return doc.progress >= 95
      return true
    })
  }, [episodes, filter])

  const totalSeconds = episodes.reduce(
    (sum, doc) => sum + (doc.durationSec || doc.minutes * 60),
    0,
  )
  const totalLabel = (() => {
    const total = Math.round(totalSeconds / 60)
    const hours = Math.floor(total / 60)
    const minutes = total % 60
    if (!hours) return `${minutes} min`
    return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`
  })()

  return (
    <div className="page listen-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Listen</p>
          <h1>Podcasts &amp; talks.</h1>
          <p className="page-sub">
            {episodes.length
              ? `${episodes.length} episode${episodes.length === 1 ? '' : 's'} · ${totalLabel} of audio`
              : 'Add a podcast feed and every new episode lands here, ready to transcribe and highlight.'}
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn--soft btn--small" onClick={onOpenSources}>
            <Icon name="rss" size={16} />
            <span>Sources</span>
          </button>
          <button type="button" className="btn btn--primary btn--small" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={16} />
            <span>Add podcast</span>
          </button>
        </div>
      </header>

      {episodes.length ? (
        <>
          <div className="segmented" role="tablist" aria-label="Filter episodes">
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={filter === item}
                className={`segmented-item${filter === item ? ' is-active' : ''}`}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {visible.length ? (
            <div className="episode-grid">
              {visible.map((doc) => (
                <article key={doc.id} className="episode-card">
                  <button
                    type="button"
                    className="episode-cover"
                    onClick={() => onOpenEpisode(doc.id)}
                    aria-label={`Open ${doc.title}`}
                  >
                    <Cover doc={doc} size="md" />
                    <span className="episode-play">
                      <Icon name="play" size={18} />
                    </span>
                  </button>
                  <div className="episode-copy">
                    <p className="episode-source">
                      {doc.source}
                      {doc.publishedAt ? ` · ${relativeTime(doc.publishedAt)}` : ''}
                    </p>
                    <button type="button" className="episode-title" onClick={() => onOpenEpisode(doc.id)}>
                      {doc.title}
                    </button>
                    <p className="episode-meta">
                      {durationLabel(doc)}
                      {doc.transcript?.length ? ' · transcript ready' : ' · no transcript yet'}
                    </p>
                    <div className="episode-foot">
                      <span className="episode-progress">
                        <span style={{ width: `${Math.min(100, Math.max(0, doc.progress))}%` }} />
                      </span>
                      <ProgressRing value={doc.progress} max={100} size={34} label={`${doc.progress}%`} />
                    </div>
                    <div className="episode-links">
                      <button type="button" className="link-button" onClick={() => onOpenEpisode(doc.id)}>
                        <Icon name="listen" size={14} /> Listen &amp; transcript
                      </button>
                      <button type="button" className="link-button" onClick={() => onOpenDoc(doc.id)}>
                        <Icon name="notes" size={14} /> Notes
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="listen"
              title="Nothing in this filter"
              body="Try another filter, or add a new feed to bring in more episodes."
              action={
                <button type="button" className="btn btn--primary btn--small" onClick={() => setFilter('All')}>
                  Show all episodes
                </button>
              }
            />
          )}
        </>
      ) : (
        <EmptyState
          icon="listen"
          title="No podcasts yet"
          body="Add a podcast RSS feed (or a YouTube channel) and 0x wise will download new episodes and transcribe them locally."
          action={
            <>
              <button type="button" className="btn btn--primary btn--small" onClick={() => setAddOpen(true)}>
                <Icon name="plus" size={16} /> Add a podcast
              </button>
              <button type="button" className="btn btn--soft btn--small" onClick={onOpenSources}>
                <Icon name="rss" size={16} /> Manage sources
              </button>
            </>
          }
        />
      )}

      <AddPodcastModal open={addOpen} onClose={() => setAddOpen(false)} onDone={showToast} actions={actions} />
    </div>
  )
}

function AddPodcastModal({
  open,
  onClose,
  onDone,
  actions,
}: {
  open: boolean
  onClose: () => void
  onDone: (message: string, kind?: 'success' | 'error') => void
  actions: ReturnType<typeof useStore>['actions']
}) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!url.trim() || busy) return
    setBusy(true)
    const result = await actions.addSource({ url: url.trim(), kind: 'podcast' })
    setBusy(false)
    if (!result) return
    if (result.error) {
      onDone(result.error, 'error')
      return
    }
    onDone(
      `Added feed${result.counts?.docs ? ` · ${result.counts.docs} episode${result.counts.docs === 1 ? '' : 's'}` : ''}`,
      'success',
    )
    setUrl('')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a podcast" subtitle="Paste the RSS feed URL from Apple Podcasts, Overcast, Spotify or the show's own site.">
      <form className="modal-form" onSubmit={submit}>
        <label className="field-label" htmlFor="podcast-url">
          <span>Feed URL</span>
          <input
            id="podcast-url"
            className="input"
            type="url"
            placeholder="https://example.com/feed.xml"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            autoFocus
          />
        </label>
        <div className="modal-foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy || !url.trim()}>
            {busy ? 'Adding…' : 'Add feed'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
