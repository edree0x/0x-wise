import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { Icon } from '../icons'
import { ColorDots, ConfirmDialog, Cover, EmptyState, Tag } from '../ui'
import type { Highlight, HighlightColor } from '../types'
import { clamp, formatDate } from '../utils'

export function ReaderPage({
  docId,
  onBack,
  onOpenDoc,
}: {
  docId: string
  onBack: () => void
  onOpenDoc: (id: string) => void
}) {
  const { data, actions, showToast } = useStore()
  const doc = data.docs.find((item) => item.id === docId)
  const highlights = useMemo(
    () => data.highlights.filter((highlight) => highlight.docId === docId),
    [data.highlights, docId],
  )
  const articleRef = useRef<HTMLElement>(null)
  const progressRef = useRef(0)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [selection, setSelection] = useState('')
  const [color, setColor] = useState<HighlightColor>('yellow')
  const [note, setNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setScrollProgress(0)
    progressRef.current = 0
    window.scrollTo({ top: 0 })
  }, [docId])

  useEffect(() => {
    if (!doc) return
    const onScroll = () => {
      const article = articleRef.current
      if (!article) return
      const rect = article.getBoundingClientRect()
      const total = rect.height - window.innerHeight * 0.7
      const pct = total > 0 ? clamp((-rect.top + 120) / total, 0, 1) : 1
      progressRef.current = Math.round(pct * 100)
      setScrollProgress(progressRef.current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      const next = Math.max(doc.progress, progressRef.current)
      if (next > doc.progress) actions.updateDoc(doc.id, { progress: next })
    }
    // The cleanup intentionally captures the doc's progress at mount time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

  if (!doc) {
    return (
      <div className="page">
        <EmptyState
          icon="book"
          title="This document is gone"
          body="It may have been deleted or the link is out of date."
          action={
            <button type="button" className="btn btn--primary" onClick={onBack}>
              Back to library
            </button>
          }
        />
      </div>
    )
  }

  const readTime = doc.content.join(' ').split(/\s+/).filter(Boolean).length
  const nextDoc = data.docs.find((item) => item.id !== doc.id && !item.archived)

  const captureSelection = () => {
    const active = window.getSelection()
    if (!active || active.isCollapsed) return
    const range = active.getRangeAt(0)
    if (!articleRef.current?.contains(range.commonAncestorContainer)) return
    const text = active.toString().replace(/\s+/g, ' ').trim()
    if (text.length < 3) return
    setSelection(text)
    setColor('yellow')
    setNote('')
  }

  const saveHighlight = () => {
    if (!selection) return
    actions.addHighlight({ docId: doc.id, text: selection, note, color })
    showToast('Highlight saved', 'success')
    window.getSelection()?.removeAllRanges()
    setSelection('')
    setNote('')
  }

  const cancelSelection = () => {
    window.getSelection()?.removeAllRanges()
    setSelection('')
    setNote('')
  }

  const scrollToHighlight = (id: string) => {
    const target = document.getElementById(`mark-${id}`)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.classList.add('is-flash')
    window.setTimeout(() => target.classList.remove('is-flash'), 1400)
  }

  return (
    <div className="page reader-page">
      <div className="reading-progress" aria-hidden="true">
        <span style={{ width: `${scrollProgress}%` }} />
      </div>

      <header className="reader-bar">
        <button type="button" className="reader-back" onClick={onBack}>
          <Icon name="left" size={17} />
          <span>Library</span>
        </button>
        <div className="reader-bar-title">
          <span>{doc.title}</span>
          <small>{scrollProgress}% read</small>
        </div>
        <div className="reader-bar-actions">
          <button
            type="button"
            className={`icon-button${doc.favorite ? ' is-on' : ''}`}
            onClick={() => actions.toggleDocFavorite(doc.id)}
            aria-label={doc.favorite ? 'Remove from favorites' : 'Add to favorites'}
            title="Favorite"
          >
            <Icon name={doc.favorite ? 'starFilled' : 'star'} size={18} />
          </button>
          <button
            type="button"
            className="btn btn--soft btn--small"
            onClick={() => {
              actions.updateDoc(doc.id, { progress: 100 })
              showToast('Marked as finished', 'success')
            }}
          >
            <Icon name="check" size={15} /> Finished
          </button>
        </div>
      </header>

      <div className="reader-layout">
        <article
          className="reader-article"
          ref={articleRef}
          onMouseUp={() => window.setTimeout(captureSelection, 0)}
          onTouchEnd={() => window.setTimeout(captureSelection, 120)}
          onKeyUp={(event) => {
            if (event.shiftKey) window.setTimeout(captureSelection, 0)
          }}
        >
          <header className="article-head">
            <div className="article-cover">
              <Cover doc={doc} size="lg" />
            </div>
            <div className="article-head-text">
              <p className="eyebrow">
                {doc.category} · {doc.source}
              </p>
              <h1>{doc.title}</h1>
              <p className="article-byline">
                By {doc.author} · {doc.minutes} min read · Added {formatDate(doc.addedAt)}
              </p>
              {doc.tags.length ? (
                <div className="tag-row">
                  {doc.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
              ) : null}
              <p className="article-summary">{doc.summary}</p>
              {doc.url ? (
                <a className="article-link" href={doc.url} target="_blank" rel="noreferrer">
                  <Icon name="link" size={14} /> View original
                </a>
              ) : null}
            </div>
          </header>

          <div className="reader-tip">
            <Icon name="highlighter" size={16} />
            Select any sentence to save a highlight. Everything stays on this machine.
          </div>

          {doc.audioUrl ? (
            <audio className="reader-audio" src={doc.audioUrl} controls preload="metadata" />
          ) : null}

          <div className="article-body">
            {doc.content.length ? (
              renderBlocks(doc.content, highlights)
            ) : (
              <p className="article-empty">
                This is a bookmark. Add a note or open the original link above to read it.
              </p>
            )}
          </div>

          <footer className="article-foot">
            <div className="article-foot-card">
              <p className="eyebrow">Keep going</p>
              <h3>{doc.progress >= 100 ? 'You finished this one.' : 'Leave a mark before you go.'}</h3>
              <p>
                {highlights.length
                  ? `${highlights.length} highlight${highlights.length === 1 ? '' : 's'} from this piece are waiting in your review queue.`
                  : 'Select a sentence above to start your own collection of ideas.'}
              </p>
              {nextDoc ? (
                <button type="button" className="btn btn--ghost" onClick={() => onOpenDoc(nextDoc.id)}>
                  Next: {nextDoc.title} <Icon name="right" size={15} />
                </button>
              ) : null}
            </div>
          </footer>
        </article>

        <aside className="reader-rail">
          <section className="rail-card">
            <header className="side-head">
              <h2>In this document</h2>
              <span className="side-count">{highlights.length}</span>
            </header>
            {highlights.length ? (
              <ul className="rail-highlights">
                {highlights.map((highlight) => (
                  <li key={highlight.id}>
                    <button type="button" onClick={() => scrollToHighlight(highlight.id)}>
                      <span className={`dot dot--${highlight.color}`} />
                      <span>
                        <span className="rail-quote">{highlight.text}</span>
                        {highlight.note ? <span className="rail-note">{highlight.note}</span> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="side-note">No highlights yet. Select a sentence in the article to make one.</p>
            )}
          </section>

          <section className="rail-card">
            <h2 className="side-title">Details</h2>
            <dl className="detail-list">
              <div>
                <dt>Progress</dt>
                <dd>{Math.max(doc.progress, scrollProgress)}%</dd>
              </div>
              <div>
                <dt>Words</dt>
                <dd>{readTime.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{doc.source}</dd>
              </div>
              <div>
                <dt>Added</dt>
                <dd>{formatDate(doc.addedAt)}</dd>
              </div>
            </dl>
            <div className="rail-actions">
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  actions.archiveDoc(doc.id, !doc.archived)
                  showToast(doc.archived ? 'Restored to library' : 'Archived')
                }}
              >
                <Icon name="archive" size={15} /> {doc.archived ? 'Restore' : 'Archive'}
              </button>
              <button type="button" className="text-button text-button--danger" onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" size={15} /> Delete
              </button>
            </div>
          </section>
        </aside>
      </div>

      {selection ? (
        <div className="clip-composer" role="dialog" aria-label="Save highlight">
          <div className="clip-quote">
            <Icon name="quote" size={16} />
            <span>{selection}</span>
          </div>
          <div className="clip-controls">
            <ColorDots value={color} onChange={setColor} size="sm" />
            <input
              className="text-input clip-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add a note (optional)"
              aria-label="Highlight note"
            />
            <button type="button" className="btn btn--primary btn--small" onClick={saveHighlight}>
              Save highlight
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={cancelSelection}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this document?"
        body={`"${doc.title}" and its ${highlights.length} highlight${highlights.length === 1 ? '' : 's'} will be removed from this device. This cannot be undone.`}
        confirmLabel="Delete document"
        danger
        onConfirm={() => {
          actions.deleteDoc(doc.id)
          showToast('Document deleted')
          onBack()
        }}
      />
    </div>
  )
}

function renderBlocks(blocks: string[], highlights: Highlight[]): ReactNode[] {
  const nodes: ReactNode[] = []
  let list: string[] = []

  const flushList = () => {
    if (!list.length) return
    const items = list
    nodes.push(
      <ul key={`list-${nodes.length}`} className="article-list">
        {items.map((item, index) => (
          <li key={index}>{renderParagraph(item, highlights)}</li>
        ))}
      </ul>,
    )
    list = []
  }

  blocks.forEach((block, index) => {
    const text = block.trim()
    if (!text) return
    if (/^[-*]\s+/.test(text)) {
      list.push(text.replace(/^[-*]\s+/, ''))
      return
    }
    flushList()
    nodes.push(renderBlock(text, index, highlights))
  })
  flushList()
  return nodes
}

function renderBlock(text: string, index: number, highlights: Highlight[]): ReactNode {
  if (text.startsWith('### ')) {
    return <h3 key={index}>{renderParagraph(text.slice(4), highlights)}</h3>
  }
  if (text.startsWith('## ')) {
    return <h2 key={index}>{renderParagraph(text.slice(3), highlights)}</h2>
  }
  if (text.startsWith('# ')) {
    return <h2 key={index}>{renderParagraph(text.slice(2), highlights)}</h2>
  }
  if (text.startsWith('> ')) {
    return (
      <blockquote key={index} className="article-blockquote">
        {renderParagraph(text.replace(/^>\s*/, ''), highlights)}
      </blockquote>
    )
  }
  const image = text.match(/^!\[([^\]]*)\]\((\S+?)\)$/)
  if (image) {
    return (
      <figure key={index} className="article-figure">
        <img src={image[2]} alt={image[1]} loading="lazy" referrerPolicy="no-referrer" />
        {image[1] ? <figcaption>{image[1]}</figcaption> : null}
      </figure>
    )
  }
  return <p key={index}>{renderParagraph(text, highlights)}</p>
}

function renderParagraph(text: string, highlights: Highlight[]): ReactNode {
  type Match = { start: number; end: number; highlight: Highlight }
  const matches: Match[] = []
  for (const highlight of highlights) {
    if (!highlight.text) continue
    const index = text.indexOf(highlight.text)
    if (index === -1) continue
    matches.push({ start: index, end: index + highlight.text.length, highlight })
  }
  matches.sort((a, b) => a.start - b.start)

  const nodes: ReactNode[] = []
  let cursor = 0
  for (const match of matches) {
    if (match.start < cursor) continue
    if (match.start > cursor) nodes.push(text.slice(cursor, match.start))
    nodes.push(
      <mark
        key={`${match.highlight.id}-${match.start}`}
        id={`mark-${match.highlight.id}`}
        className={`hl hl--${match.highlight.color}`}
        title={match.highlight.note || 'Highlighted'}
      >
        {text.slice(match.start, match.end)}
      </mark>,
    )
    cursor = match.end
  }
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes.length ? nodes : text
}
