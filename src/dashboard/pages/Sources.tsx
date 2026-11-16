import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { Icon } from '../icons'
import { ConfirmDialog, EmptyState } from '../ui'
import { relativeTime } from '../utils'
import type { SourceKind } from '../types'

const KINDS: { id: SourceKind; label: string; hint: string }[] = [
  { id: 'rss', label: 'RSS', hint: 'Blogs, newsletters and news sites' },
  { id: 'podcast', label: 'Podcast', hint: 'Shows with audio enclosures' },
  { id: 'youtube', label: 'YouTube', hint: 'Channel or playlist feed' },
  { id: 'newsletter', label: 'Newsletter', hint: 'Public newsletter archive feed' },
]

const KIND_LABEL: Record<SourceKind, string> = {
  rss: 'RSS',
  podcast: 'Podcast',
  youtube: 'YouTube',
  newsletter: 'Newsletter',
}

export function SourcesPage({
  onOpenEpisode,
  onOpenDoc,
}: {
  onOpenEpisode: (id: string) => void
  onOpenDoc: (id: string) => void
}) {
  const { data, actions, showToast } = useStore()
  const [url, setUrl] = useState('')
  const [kind, setKind] = useState<SourceKind>('rss')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [polling, setPolling] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const sources = data.sources ?? []
  const recent = useMemo(
    () =>
      [...data.docs]
        .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
        .slice(0, 8),
    [data.docs],
  )

  const add = async (event: FormEvent) => {
    event.preventDefault()
    if (!url.trim() || busy) return
    setBusy(true)
    const result = await actions.addSource({ url: url.trim(), kind, title: title.trim() || undefined })
    setBusy(false)
    if (!result) return
    if (result.error) {
      showToast(result.error, 'error')
      return
    }
    const added = result.counts?.docs ?? 0
    showToast(
      added > 0
        ? `Feed added · ${added} new item${added === 1 ? '' : 's'}`
        : 'Feed added · nothing new right now',
      'success',
    )
    setUrl('')
    setTitle('')
  }

  const poll = async (id: string, name: string) => {
    setPolling(id)
    const result = await actions.pollSource(id)
    setPolling(null)
    if (!result) return
    if (result.error) {
      showToast(`${name}: ${result.error}`, 'error')
      return
    }
    const added = result.counts?.docs ?? 0
    showToast(`${name} · ${added ? `${added} new` : 'up to date'}`, 'success')
  }

  const pollAll = async () => {
    for (const source of sources) {
      await poll(source.id, source.title)
    }
  }

  const upload = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    const result = await actions.upload(file)
    setUploading(false)
    if (!result) return
    if (!result.ok) {
      showToast(result.error ?? 'Could not read that file', 'error')
      return
    }
    showToast('Book imported', 'success')
    if (result.id) onOpenDoc(result.id)
  }

  return (
    <div className="page sources-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Sources</p>
          <h1>Feeds &amp; books.</h1>
          <p className="page-sub">
            Every feed you add is polled on a schedule. Articles land in the library, episodes land in
            Listen, and EPUB/PDF uploads become books with highlights.
          </p>
        </div>
        <div className="head-actions">
          {sources.length ? (
            <button
              type="button"
              className="btn btn--soft btn--small"
              disabled={polling !== null}
              onClick={() => void pollAll()}
            >
              <Icon name="sync" size={16} />
              {polling ? 'Polling…' : 'Poll all feeds'}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--primary btn--small"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Icon name="upload" size={16} />
            {uploading ? 'Reading book…' : 'Upload EPUB / PDF'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".epub,.pdf,application/epub+zip,application/pdf"
            hidden
            onChange={(event) => {
              void upload(event.target.files?.[0] ?? null)
              event.target.value = ''
            }}
          />
        </div>
      </header>

      <section className="panel">
        <div className="panel-head">
          <h2>Add a feed</h2>
          <p>Paste an RSS or Atom URL. Podcasts and YouTube feeds work the same way.</p>
        </div>
        <form className="source-form" onSubmit={add}>
          <label className="field-label source-form-url" htmlFor="source-url">
            <span>Feed URL</span>
            <input
              id="source-url"
              className="input"
              type="url"
              placeholder="https://example.com/feed.xml"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
            />
          </label>
          <label className="field-label" htmlFor="source-kind">
            <span>Type</span>
            <select
              id="source-kind"
              className="input"
              value={kind}
              onChange={(event) => setKind(event.target.value as SourceKind)}
            >
              {KINDS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} — {option.hint}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label" htmlFor="source-title">
            <span>Name (optional)</span>
            <input
              id="source-title"
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Taken from the feed title"
            />
          </label>
          <button type="submit" className="btn btn--primary" disabled={busy || !url.trim()}>
            {busy ? 'Adding…' : 'Add feed'}
          </button>
        </form>
      </section>

      {sources.length ? (
        <section className="panel">
          <div className="panel-head">
            <h2>Your feeds</h2>
            <p>{sources.length} source{sources.length === 1 ? '' : 's'} · stored and polled on this machine.</p>
          </div>
          <ul className="source-list">
            {sources.map((source) => (
              <li key={source.id} className="source-row">
                <span className={`source-icon source-icon--${source.kind}`}>
                  <Icon name={source.kind === 'podcast' ? 'listen' : source.kind === 'youtube' ? 'external' : 'rss'} size={17} />
                </span>
                <div className="source-copy">
                  <strong>{source.title}</strong>
                  <span>
                    {KIND_LABEL[source.kind]} · {source.url}
                  </span>
                  <span className="source-meta">
                    {source.itemCount ?? 0} item{source.itemCount === 1 ? '' : 's'}
                    {source.lastPolledAt ? ` · checked ${relativeTime(source.lastPolledAt)}` : ' · never checked'}
                    {source.pollMinutes ? ` · every ${source.pollMinutes} min` : ''}
                  </span>
                  {source.error ? <span className="source-error">{source.error}</span> : null}
                </div>
                <div className="source-actions">
                  <button
                    type="button"
                    className="icon-button"
                    title="Poll now"
                    aria-label={`Poll ${source.title}`}
                    disabled={polling === source.id}
                    onClick={() => void poll(source.id, source.title)}
                  >
                    <Icon name="sync" size={17} />
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button--danger"
                    title="Remove feed"
                    aria-label={`Remove ${source.title}`}
                    onClick={() => setPendingDelete(source.id)}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState
          icon="rss"
          title="No sources yet"
          body="Add your first feed above, or upload an EPUB/PDF. Nothing is preloaded — the library only holds what you choose."
        />
      )}

      <section className="panel">
        <div className="panel-head panel-head--row">
          <div>
            <h2>Recently added</h2>
            <p>The newest items from your feeds, uploads and clips.</p>
          </div>
          {recent.some((doc) => doc.kind === 'podcast') ? (
            <button type="button" className="link-button" onClick={() => onOpenEpisode(recent.find((doc) => doc.kind === 'podcast')!.id)}>
              <Icon name="listen" size={15} /> Open Listen
            </button>
          ) : null}
        </div>
        {recent.length ? (
          <ul className="recent-list">
            {recent.map((doc) => (
              <li key={doc.id}>
                <button type="button" className="recent-row" onClick={() => onOpenDoc(doc.id)}>
                  <span className="recent-dot" data-color={doc.color} />
                  <span className="recent-copy">
                    <strong>{doc.title}</strong>
                    <span>
                      {doc.source} · {doc.category} · {relativeTime(doc.addedAt)}
                    </span>
                  </span>
                  {doc.status === 'fetching' ? <span className="recent-status">fetching…</span> : null}
                  {doc.status === 'error' ? <span className="recent-status recent-status--error">failed</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel-empty">Nothing added yet.</p>
        )}
      </section>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this feed?"
        body="The feed is deleted. Documents and highlights already imported stay in your library."
        confirmLabel="Remove feed"
        danger
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) actions.deleteSource(pendingDelete)
          setPendingDelete(null)
          showToast('Feed removed')
        }}
      />
    </div>
  )
}
