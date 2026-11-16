import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Icon } from '../icons'
import { AddDocModal, Cover, EmptyState } from '../ui'
import type { Category, Doc } from '../types'

const FILTERS: (Category | 'All')[] = ['All', 'Article', 'Book', 'Newsletter', 'Tweet', 'PDF']

type SortMode = 'recent' | 'title' | 'progress' | 'length'

export function LibraryPage({ onOpenDoc }: { onOpenDoc: (id: string) => void }) {
  const { data, actions, showToast } = useStore()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | 'All'>('All')
  const [favorites, setFavorites] = useState(false)
  const [archived, setArchived] = useState(false)
  const [sort, setSort] = useState<SortMode>('recent')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [addOpen, setAddOpen] = useState(false)

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    const list = data.docs.filter((doc) => {
      if (doc.archived !== archived) return false
      if (category !== 'All' && doc.category !== category) return false
      if (favorites && !doc.favorite) return false
      if (!term) return true
      return (
        doc.title.toLowerCase().includes(term) ||
        doc.author.toLowerCase().includes(term) ||
        doc.source.toLowerCase().includes(term) ||
        doc.tags.some((tag) => tag.toLowerCase().includes(term))
      )
    })
    return [...list].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'progress') return b.progress - a.progress
      if (sort === 'length') return b.minutes - a.minutes
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    })
  }, [data.docs, query, category, favorites, archived, sort])

  const continueDoc = useMemo(
    () =>
      [...data.docs]
        .filter((doc) => !doc.archived && doc.progress > 0 && doc.progress < 100)
        .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())[0],
    [data.docs],
  )

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const doc of data.docs) {
      if (doc.archived) continue
      map.set(doc.category, (map.get(doc.category) ?? 0) + 1)
    }
    return map
  }, [data.docs])

  const totalActive = data.docs.filter((doc) => !doc.archived).length
  const highlightCount = data.highlights.length

  return (
    <div className="page library-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Reader</p>
          <h1>Your library</h1>
          <p className="page-sub">
            {totalActive} document{totalActive === 1 ? '' : 's'} · {highlightCount} highlight
            {highlightCount === 1 ? '' : 's'} saved on this device.
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn--primary" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={16} /> Add document
          </button>
        </div>
      </header>

      {continueDoc ? (
        <button type="button" className="continue-card" onClick={() => onOpenDoc(continueDoc.id)}>
          <Cover doc={continueDoc} size="sm" />
          <span className="continue-body">
            <span className="continue-label">Continue reading</span>
            <strong>{continueDoc.title}</strong>
            <span className="continue-meta">
              {continueDoc.author} · {continueDoc.progress}% complete
            </span>
            <span className="continue-track">
              <span style={{ width: `${continueDoc.progress}%` }} />
            </span>
          </span>
          <span className="continue-go">
            <Icon name="right" size={18} />
          </span>
        </button>
      ) : null}

      <div className="library-toolbar">
        <label className="search-field">
          <Icon name="search" size={17} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles, authors, tags…"
            aria-label="Search library"
          />
          {query ? (
            <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <Icon name="close" size={14} />
            </button>
          ) : null}
        </label>

        <div className="toolbar-right">
          <label className="select-wrap">
            <span className="sr-only">Sort by</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
              <option value="recent">Recently added</option>
              <option value="title">Title A–Z</option>
              <option value="progress">Most progress</option>
              <option value="length">Longest read</option>
            </select>
            <Icon name="down" size={14} />
          </label>
          <div className="view-toggle" role="group" aria-label="Layout">
            <button
              type="button"
              className={view === 'grid' ? 'is-active' : ''}
              onClick={() => setView('grid')}
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
            >
              <Icon name="grid" size={16} />
            </button>
            <button
              type="button"
              className={view === 'list' ? 'is-active' : ''}
              onClick={() => setView('list')}
              aria-label="List view"
              aria-pressed={view === 'list'}
            >
              <Icon name="list" size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="filter-row">
        <div className="chip-row" role="group" aria-label="Filter by category">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              className={`chip${category === item ? ' is-active' : ''}`}
              onClick={() => setCategory(item)}
            >
              {item}
              {item !== 'All' ? <span>{counts.get(item) ?? 0}</span> : <span>{totalActive}</span>}
            </button>
          ))}
        </div>
        <div className="chip-row">
          <button
            type="button"
            className={`chip chip--icon${favorites ? ' is-active' : ''}`}
            onClick={() => setFavorites((value) => !value)}
          >
            <Icon name={favorites ? 'starFilled' : 'star'} size={14} /> Favorites
          </button>
          <button
            type="button"
            className={`chip chip--icon${archived ? ' is-active' : ''}`}
            onClick={() => setArchived((value) => !value)}
          >
            <Icon name="archive" size={14} /> Archived
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={archived ? 'archive' : 'book'}
          title={archived ? 'Nothing archived' : 'No documents here yet'}
          body={
            query
              ? 'No title, author, or tag matches that search. Try a shorter phrase.'
              : archived
                ? 'Documents you archive will wait here without cluttering the shelf.'
                : 'Add an article, a chapter, or a page you want to keep. It all stays on this device.'
          }
          action={
            !archived ? (
              <button type="button" className="btn btn--primary" onClick={() => setAddOpen(true)}>
                <Icon name="plus" size={16} /> Add your first document
              </button>
            ) : undefined
          }
        />
      ) : view === 'grid' ? (
        <div className="doc-grid">
          {visible.map((doc) => (
            <DocCard
              key={doc.id}
              doc={doc}
              highlightCount={data.highlights.filter((highlight) => highlight.docId === doc.id).length}
              onOpen={() => onOpenDoc(doc.id)}
              onFavorite={() => actions.toggleDocFavorite(doc.id)}
            />
          ))}
        </div>
      ) : (
        <div className="doc-list">
          {visible.map((doc) => (
            <DocRow
              key={doc.id}
              doc={doc}
              highlightCount={data.highlights.filter((highlight) => highlight.docId === doc.id).length}
              onOpen={() => onOpenDoc(doc.id)}
              onFavorite={() => actions.toggleDocFavorite(doc.id)}
            />
          ))}
        </div>
      )}

      <AddDocModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(id) => {
          showToast('Document added to your library', 'success')
          onOpenDoc(id)
        }}
      />
    </div>
  )
}

function DocCard({
  doc,
  highlightCount,
  onOpen,
  onFavorite,
}: {
  doc: Doc
  highlightCount: number
  onOpen: () => void
  onFavorite: () => void
}) {
  return (
    <article className={`doc-card${doc.archived ? ' is-archived' : ''}`}>
      <button type="button" className="doc-cover-button" onClick={onOpen} aria-label={`Read ${doc.title}`}>
        <Cover doc={doc} />
        <span className="doc-cover-overlay">
          <span className="doc-open-pill">Open <Icon name="right" size={13} /></span>
        </span>
      </button>
      <button
        type="button"
        className={`cover-star${doc.favorite ? ' is-on' : ''}`}
        onClick={onFavorite}
        aria-label={doc.favorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Icon name={doc.favorite ? 'starFilled' : 'star'} size={15} />
      </button>
      <div className="doc-card-body">
        <button type="button" className="doc-title-button" onClick={onOpen}>
          {doc.title}
        </button>
        <p className="doc-byline">
          {doc.author} · {doc.source}
        </p>
        <div className="doc-progress-row">
          <span className="doc-track">
            <span style={{ width: `${doc.progress}%` }} />
          </span>
          <span>{doc.progress}%</span>
        </div>
        <p className="doc-foot">
          {doc.minutes} min read · {highlightCount} highlight{highlightCount === 1 ? '' : 's'}
        </p>
      </div>
    </article>
  )
}

function DocRow({
  doc,
  highlightCount,
  onOpen,
  onFavorite,
}: {
  doc: Doc
  highlightCount: number
  onOpen: () => void
  onFavorite: () => void
}) {
  return (
    <article className={`doc-row${doc.archived ? ' is-archived' : ''}`}>
      <button type="button" className="doc-row-cover" onClick={onOpen} aria-label={`Read ${doc.title}`}>
        <Cover doc={doc} size="sm" />
      </button>
      <div className="doc-row-main">
        <button type="button" className="doc-title-button" onClick={onOpen}>
          {doc.title}
        </button>
        <p className="doc-byline">
          {doc.author} · {doc.source} · {doc.category}
        </p>
        <div className="doc-progress-row doc-progress-row--wide">
          <span className="doc-track">
            <span style={{ width: `${doc.progress}%` }} />
          </span>
          <span>{doc.progress}%</span>
        </div>
      </div>
      <div className="doc-row-meta">
        <span>{doc.minutes} min</span>
        <span>{highlightCount} highlights</span>
      </div>
      <button
        type="button"
        className={`icon-button${doc.favorite ? ' is-on' : ''}`}
        onClick={onFavorite}
        aria-label={doc.favorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Icon name={doc.favorite ? 'starFilled' : 'star'} size={17} />
      </button>
    </article>
  )
}
