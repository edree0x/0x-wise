import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Icon } from '../icons'
import { ColorDots, ConfirmDialog, EmptyState, Tag } from '../ui'
import type { Highlight, HighlightColor } from '../types'
import { dueLabel, formatDate } from '../utils'

const COLOR_FILTERS: { id: HighlightColor | 'all'; label: string }[] = [
  { id: 'all', label: 'All colors' },
  { id: 'yellow', label: 'Yellow' },
  { id: 'blue', label: 'Blue' },
  { id: 'green', label: 'Green' },
  { id: 'pink', label: 'Pink' },
]

export function HighlightsPage({ onOpenDoc }: { onOpenDoc: (id: string) => void }) {
  const { data, actions, showToast } = useStore()
  const [query, setQuery] = useState('')
  const [docFilter, setDocFilter] = useState('all')
  const [colorFilter, setColorFilter] = useState<HighlightColor | 'all'>('all')
  const [favorites, setFavorites] = useState(false)
  const [sort, setSort] = useState<'newest' | 'oldest' | 'due'>('newest')
  const [editing, setEditing] = useState<string | null>(null)
  const [draftNote, setDraftNote] = useState('')
  const [draftTags, setDraftTags] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Highlight | null>(null)

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    const list = data.highlights.filter((highlight) => {
      if (docFilter !== 'all' && highlight.docId !== docFilter) return false
      if (colorFilter !== 'all' && highlight.color !== colorFilter) return false
      if (favorites && !highlight.favorite) return false
      if (!term) return true
      return (
        highlight.text.toLowerCase().includes(term) ||
        highlight.note.toLowerCase().includes(term) ||
        highlight.tags.some((tag) => tag.toLowerCase().includes(term))
      )
    })
    return [...list].sort((a, b) => {
      if (sort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      if (sort === 'due') return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [data.highlights, query, docFilter, colorFilter, favorites, sort])

  const startEditing = (highlight: Highlight) => {
    setEditing(highlight.id)
    setDraftNote(highlight.note)
    setDraftTags(highlight.tags.join(', '))
  }

  const saveEditing = (highlight: Highlight) => {
    actions.updateHighlight(highlight.id, {
      note: draftNote.trim(),
      tags: draftTags
        .split(',')
        .map((tag) => tag.trim().replace(/^#/, ''))
        .filter(Boolean),
    })
    setEditing(null)
    showToast('Highlight updated', 'success')
  }

  const total = data.highlights.length
  const withNotes = data.highlights.filter((highlight) => highlight.note.trim()).length

  return (
    <div className="page highlights-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Review</p>
          <h1>Highlights</h1>
          <p className="page-sub">
            {total} saved passage{total === 1 ? '' : 's'} · {withNotes} with your own note.
          </p>
        </div>
        <div className="head-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setFavorites(false)
              setColorFilter('all')
              setDocFilter('all')
              setSort('due')
            }}
          >
            <Icon name="clock" size={16} /> Sort by due
          </button>
        </div>
      </header>

      <div className="library-toolbar">
        <label className="search-field">
          <Icon name="search" size={17} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search quotes, notes, tags…"
            aria-label="Search highlights"
          />
          {query ? (
            <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <Icon name="close" size={14} />
            </button>
          ) : null}
        </label>
        <div className="toolbar-right">
          <label className="select-wrap select-wrap--wide">
            <span className="sr-only">Filter by document</span>
            <select value={docFilter} onChange={(event) => setDocFilter(event.target.value)}>
              <option value="all">All documents</option>
              {data.docs.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
            <Icon name="down" size={14} />
          </label>
          <label className="select-wrap">
            <span className="sr-only">Sort highlights</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="due">Due first</option>
            </select>
            <Icon name="down" size={14} />
          </label>
        </div>
      </div>

      <div className="filter-row">
        <div className="chip-row" role="group" aria-label="Filter by color">
          {COLOR_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip chip--icon${colorFilter === item.id ? ' is-active' : ''}`}
              onClick={() => setColorFilter(item.id)}
            >
              {item.id !== 'all' ? <span className={`color-swatch color-swatch--${item.id}`} /> : null}
              {item.label}
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
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="highlighter"
          title={total ? 'No highlights match' : 'Your first highlight is waiting'}
          body={
            total
              ? 'Try a different color, document, or search term.'
              : 'Open a document, select a sentence, and it will appear here with a note and tags.'
          }
          action={
            data.docs[0] ? (
              <button type="button" className="btn btn--primary" onClick={() => onOpenDoc(data.docs[0].id)}>
                <Icon name="book" size={16} /> Open a document
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="highlight-list">
          {filtered.map((highlight) => {
            const doc = data.docs.find((item) => item.id === highlight.docId)
            const isDue = new Date(highlight.dueAt).getTime() <= Date.now()
            const isEditing = editing === highlight.id
            return (
              <article key={highlight.id} className={`highlight-card hl-surface--${highlight.color}`}>
                <span className={`highlight-edge edge--${highlight.color}`} />
                <div className="highlight-top">
                  <button type="button" className="highlight-source" onClick={() => doc && onOpenDoc(doc.id)}>
                    {doc?.title ?? 'Unknown source'}
                  </button>
                  <span className={`due-pill${isDue ? ' is-due' : ''}`}>
                    {isDue ? 'Due now' : dueLabel(highlight.dueAt)}
                  </span>
                </div>
                <blockquote className="highlight-quote">{highlight.text}</blockquote>

                {isEditing ? (
                  <div className="highlight-editor">
                    <label className="field-label">
                      <span>Your note</span>
                      <textarea
                        className="text-input text-area"
                        rows={3}
                        value={draftNote}
                        onChange={(event) => setDraftNote(event.target.value)}
                        placeholder="What does this mean to you?"
                      />
                    </label>
                    <label className="field-label">
                      <span>Tags, separated by commas</span>
                      <input
                        className="text-input"
                        value={draftTags}
                        onChange={(event) => setDraftTags(event.target.value)}
                        placeholder="attention, practice"
                      />
                    </label>
                    <div className="editor-actions">
                      <ColorDots
                        value={highlight.color}
                        onChange={(value) => actions.updateHighlight(highlight.id, { color: value })}
                        size="sm"
                      />
                      <span className="editor-spacer" />
                      <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                      <button type="button" className="btn btn--primary btn--small" onClick={() => saveEditing(highlight)}>
                        Save changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {highlight.note ? (
                      <div className="highlight-note">
                        <Icon name="pencil" size={13} />
                        <p>{highlight.note}</p>
                      </div>
                    ) : null}
                    {highlight.tags.length ? (
                      <div className="tag-row">
                        {highlight.tags.map((tag) => (
                          <Tag key={tag}>{tag}</Tag>
                        ))}
                      </div>
                    ) : null}
                    <div className="highlight-foot">
                      <span className="highlight-meta">
                        {formatDate(highlight.createdAt)} · reviewed {highlight.reviewCount}×
                      </span>
                      <div className="highlight-actions">
                        <button
                          type="button"
                          className={`text-button${highlight.favorite ? ' is-on' : ''}`}
                          onClick={() => actions.toggleHighlightFavorite(highlight.id)}
                        >
                          <Icon name={highlight.favorite ? 'starFilled' : 'star'} size={14} />
                          {highlight.favorite ? 'Saved' : 'Favorite'}
                        </button>
                        <button type="button" className="text-button" onClick={() => startEditing(highlight)}>
                          <Icon name="pencil" size={14} /> Edit
                        </button>
                        {doc ? (
                          <button type="button" className="text-button" onClick={() => onOpenDoc(doc.id)}>
                            <Icon name="book" size={14} /> Context
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="text-button text-button--danger"
                          onClick={() => setPendingDelete(highlight)}
                        >
                          <Icon name="trash" size={14} /> Delete
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </article>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this highlight?"
        body="The quote, its note, and its review history will be removed from this device."
        confirmLabel="Delete highlight"
        danger
        onConfirm={() => {
          if (pendingDelete) {
            actions.deleteHighlight(pendingDelete.id)
            showToast('Highlight deleted')
          }
        }}
      />
    </div>
  )
}
