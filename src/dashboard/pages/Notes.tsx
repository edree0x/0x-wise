import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Icon } from '../icons'
import { EmptyState, Tag } from '../ui'
import type { Highlight } from '../types'

export function NotesPage({ onOpenDoc }: { onOpenDoc: (id: string) => void }) {
  const { data, actions, showToast } = useStore()
  const [tab, setTab] = useState<'notes' | 'empty'>('notes')
  const [query, setQuery] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const notes = useMemo(
    () => data.highlights.filter((highlight) => highlight.note.trim().length > 0),
    [data.highlights],
  )
  const empty = useMemo(
    () => data.highlights.filter((highlight) => !highlight.note.trim()),
    [data.highlights],
  )

  const source = tab === 'notes' ? notes : empty
  const term = query.trim().toLowerCase()
  const filtered = source.filter((highlight) => {
    if (!term) return true
    const doc = data.docs.find((item) => item.id === highlight.docId)
    return (
      highlight.text.toLowerCase().includes(term) ||
      highlight.note.toLowerCase().includes(term) ||
      (doc?.title.toLowerCase().includes(term) ?? false) ||
      highlight.tags.some((tag) => tag.toLowerCase().includes(term))
    )
  })

  const grouped = useMemo(() => {
    const map = new Map<string, Highlight[]>()
    for (const highlight of filtered) {
      const list = map.get(highlight.docId) ?? []
      list.push(highlight)
      map.set(highlight.docId, list)
    }
    return [...map.entries()]
  }, [filtered])

  const save = (highlight: Highlight) => {
    const value = drafts[highlight.id]
    if (value === undefined) return
    actions.updateHighlight(highlight.id, { note: value.trim() })
    setDrafts((current) => {
      const next = { ...current }
      delete next[highlight.id]
      return next
    })
    showToast('Note saved', 'success')
  }

  return (
    <div className="page notes-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Review</p>
          <h1>Notes</h1>
          <p className="page-sub">
            {notes.length} note{notes.length === 1 ? '' : 's'} in your own words · {empty.length}{' '}
            highlight{empty.length === 1 ? '' : 's'} still waiting for one.
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn--ghost" onClick={() => onOpenDoc(data.docs[0]?.id ?? '')}>
            <Icon name="book" size={16} /> Read something
          </button>
        </div>
      </header>

      <div className="notes-tabs" role="tablist" aria-label="Note filter">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'notes'}
          className={tab === 'notes' ? 'is-active' : ''}
          onClick={() => setTab('notes')}
        >
          With notes <span>{notes.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'empty'}
          className={tab === 'empty' ? 'is-active' : ''}
          onClick={() => setTab('empty')}
        >
          Needs a note <span>{empty.length}</span>
        </button>
      </div>

      <div className="library-toolbar library-toolbar--plain">
        <label className="search-field">
          <Icon name="search" size={17} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes, quotes, sources…"
            aria-label="Search notes"
          />
          {query ? (
            <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <Icon name="close" size={14} />
            </button>
          ) : null}
        </label>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          icon={tab === 'notes' ? 'notes' : 'highlighter'}
          title={tab === 'notes' ? 'No notes yet' : 'Every highlight has a note'}
          body={
            tab === 'notes'
              ? 'A paraphrase in your own words is worth more than a copied quote. Add one from any highlight.'
              : 'Nothing left to annotate. Keep reading and the next idea will arrive soon.'
          }
          action={
            tab === 'notes' ? (
              <button type="button" className="btn btn--primary" onClick={() => setTab('empty')}>
                Browse highlights
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="note-groups">
          {grouped.map(([docId, highlights]) => {
            const doc = data.docs.find((item) => item.id === docId)
            return (
              <section key={docId} className="note-group">
                <header className="note-group-head">
                  <span className="note-group-mark" data-color={doc?.color ?? 'clay'} />
                  <div>
                    <button type="button" onClick={() => doc && onOpenDoc(doc.id)}>
                      {doc?.title ?? 'Unknown source'}
                    </button>
                    <span>
                      {doc?.author ?? ''}
                      {doc?.category ? ` · ${doc.category}` : ''}
                    </span>
                  </div>
                  <span className="note-group-count">
                    {highlights.length} {highlights.length === 1 ? 'note' : 'notes'}
                  </span>
                </header>
                <div className="note-grid">
                  {highlights.map((highlight) => {
                    const value = drafts[highlight.id] ?? highlight.note
                    const dirty = drafts[highlight.id] !== undefined && drafts[highlight.id] !== highlight.note
                    return (
                      <article key={highlight.id} className={`note-card hl-surface--${highlight.color}`}>
                        <blockquote>{highlight.text}</blockquote>
                        <label className="note-field">
                          <span className="sr-only">Your note</span>
                          <textarea
                            className="note-textarea"
                            rows={3}
                            value={value}
                            onChange={(event) =>
                              setDrafts((current) => ({ ...current, [highlight.id]: event.target.value }))
                            }
                            placeholder="Write the thought in your own words…"
                          />
                        </label>
                        <div className="note-card-foot">
                          <div className="tag-row">
                            {highlight.tags.slice(0, 3).map((tag) => (
                              <Tag key={tag}>{tag}</Tag>
                            ))}
                          </div>
                          <div className="note-actions">
                            {dirty ? (
                              <>
                                <button
                                  type="button"
                                  className="text-button"
                                  onClick={() =>
                                    setDrafts((current) => {
                                      const next = { ...current }
                                      delete next[highlight.id]
                                      return next
                                    })
                                  }
                                >
                                  Reset
                                </button>
                                <button
                                  type="button"
                                  className="btn btn--primary btn--small"
                                  onClick={() => save(highlight)}
                                >
                                  Save note
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => doc && onOpenDoc(doc.id)}
                              >
                                <Icon name="book" size={14} /> Read context
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
