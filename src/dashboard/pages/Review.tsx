import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { Icon } from '../icons'
import { ProgressRing, Tag } from '../ui'
import type { Highlight, Rating } from '../types'
import { dateKey } from '../data'
import { dueLabel, relativeTime } from '../utils'

const RATINGS: { id: Rating; label: string; hint: string; interval: string }[] = [
  { id: 'again', label: 'Again', hint: '1', interval: '1 day' },
  { id: 'hard', label: 'Hard', hint: '2', interval: '3 days' },
  { id: 'good', label: 'Good', hint: '3', interval: '8 days' },
  { id: 'easy', label: 'Easy', hint: '4', interval: '18 days' },
]

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return 'Still up'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

export function ReviewPage({ onOpenDoc }: { onOpenDoc: (id: string) => void }) {
  const { data, actions, showToast } = useStore()
  const [queue, setQueue] = useState<string[]>(() =>
    data.highlights
      .filter((highlight) => new Date(highlight.dueAt).getTime() <= Date.now())
      .map((highlight) => highlight.id),
  )
  const [reviewed, setReviewed] = useState(0)
  const [skips, setSkips] = useState(0)

  const current: Highlight | undefined = useMemo(
    () => data.highlights.find((highlight) => highlight.id === queue[0]),
    [data.highlights, queue],
  )
  const currentDoc = current ? data.docs.find((doc) => doc.id === current.docId) : undefined

  const dueCount = data.highlights.filter(
    (highlight) => new Date(highlight.dueAt).getTime() <= Date.now(),
  ).length
  const goal = Math.max(1, data.settings.dailyGoal)
  const reviewsToday =
    data.review.reviewsDate === dateKey() ? data.review.reviewsToday : 0

  const nextDue = useMemo(() => {
    const future = data.highlights
      .map((highlight) => new Date(highlight.dueAt).getTime())
      .filter((time) => time > Date.now())
      .sort((a, b) => a - b)
    return future[0] ?? null
  }, [data.highlights])

  const rate = (rating: Rating) => {
    if (!current) return
    actions.rateHighlight(current.id, rating)
    setReviewed((count) => count + 1)
    setQueue((ids) => ids.slice(1))
  }

  const skip = () => {
    if (queue.length < 2) return
    setSkips((count) => count + 1)
    setQueue((ids) => [...ids.slice(1), ids[0]])
  }

  const reviewAll = () => {
    setQueue(
      [...data.highlights]
        .sort((a, b) => {
          if (!a.lastReviewed && b.lastReviewed) return -1
          if (a.lastReviewed && !b.lastReviewed) return 1
          return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
        })
        .map((highlight) => highlight.id),
    )
    setReviewed(0)
    setSkips(0)
  }

  const refreshQueue = () => {
    setQueue(
      data.highlights
        .filter((highlight) => new Date(highlight.dueAt).getTime() <= Date.now())
        .map((highlight) => highlight.id),
    )
    setReviewed(0)
    setSkips(0)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || document.body.classList.contains('modal-open')) return
      if (!current) return
      const rating = RATINGS.find((item) => item.hint === event.key)
      if (rating) {
        event.preventDefault()
        rate(rating.id)
        return
      }
      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        skip()
      }
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        actions.toggleHighlightFavorite(current.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="page review-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{dateLabel}</p>
          <h1>{greeting()}.</h1>
          <p className="page-sub">
            {dueCount > 0
              ? `${dueCount} highlight${dueCount === 1 ? '' : 's'} ready for a second look.`
              : 'Nothing is due right now. Your future self says thanks.'}
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn--ghost" onClick={reviewAll}>
            <Icon name="sparkle" size={16} /> Review anyway
          </button>
        </div>
      </header>

      <section className="stat-row" aria-label="Review summary">
        <article className="stat-card">
          <span className="stat-icon stat-icon--blue">
            <Icon name="review" size={19} />
          </span>
          <div>
            <p className="stat-value">{dueCount}</p>
            <p className="stat-label">Due now</p>
          </div>
        </article>
        <article className="stat-card">
          <ProgressRing value={reviewsToday} max={goal} size={46} label={`${reviewsToday}/${goal}`} />
          <div>
            <p className="stat-value">{Math.max(0, goal - reviewsToday)}</p>
            <p className="stat-label">Left to daily goal</p>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon stat-icon--amber">
            <Icon name="flame" size={19} />
          </span>
          <div>
            <p className="stat-value">{data.review.streak}</p>
            <p className="stat-label">Day streak</p>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon stat-icon--green">
            <Icon name="highlighter" size={19} />
          </span>
          <div>
            <p className="stat-value">{reviewed}</p>
            <p className="stat-label">Reviewed this session</p>
          </div>
        </article>
      </section>

      <div className="review-layout">
        <section className="review-stage" aria-live="polite">
          {current && currentDoc ? (
            <article className="review-card" key={current.id}>
              <div className="review-source">
                <span className={`dot dot--${current.color}`} />
                <button type="button" className="source-link" onClick={() => onOpenDoc(currentDoc.id)}>
                  {currentDoc.title}
                </button>
                <span className="source-meta">
                  {currentDoc.category} · {currentDoc.author}
                </span>
              </div>

              <blockquote className={`review-quote hl-surface hl-surface--${current.color}`}>
                <Icon name="quote" size={26} className="quote-mark" />
                {current.text}
              </blockquote>

              {current.note ? (
                <div className="review-note">
                  <span className="note-label">
                    <Icon name="pencil" size={13} /> Your note
                  </span>
                  <p>{current.note}</p>
                </div>
              ) : null}

              {current.tags.length ? (
                <div className="tag-row">
                  {current.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
              ) : null}

              <div className="review-meta">
                <span>
                  <Icon name="clock" size={14} /> Reviewed {current.reviewCount}×
                </span>
                <span>Last seen {relativeTime(current.lastReviewed).toLowerCase()}</span>
              </div>

              <div className="rating-bar" role="group" aria-label="How well did you remember this?">
                {RATINGS.map((rating) => (
                  <button
                    key={rating.id}
                    type="button"
                    className={`rating rating--${rating.id}`}
                    onClick={() => rate(rating.id)}
                  >
                    <span className="rating-label">{rating.label}</span>
                    <span className="rating-interval">{rating.interval}</span>
                    <span className="rating-key">{rating.hint}</span>
                  </button>
                ))}
              </div>

              <div className="review-tools">
                <button
                  type="button"
                  className={`text-button${current.favorite ? ' is-on' : ''}`}
                  onClick={() => actions.toggleHighlightFavorite(current.id)}
                >
                  <Icon name={current.favorite ? 'starFilled' : 'star'} size={15} />
                  {current.favorite ? 'Favorited' : 'Favorite'}
                </button>
                <button type="button" className="text-button" onClick={() => onOpenDoc(currentDoc.id)}>
                  <Icon name="book" size={15} /> Read in context
                </button>
                <button type="button" className="text-button" onClick={skip} disabled={queue.length < 2}>
                  <Icon name="right" size={15} /> Skip for now
                </button>
                <span className="keyboard-hint">Keys 1–4 to rate · S to skip</span>
              </div>
            </article>
          ) : (
            <div className="review-done">
              <span className="done-glyph">
                <Icon name="sparkle" size={28} />
              </span>
              <h2>{reviewed > 0 ? 'That is the whole deck.' : 'All caught up.'}</h2>
              <p>
                {reviewed > 0
                  ? `You reviewed ${reviewed} highlight${reviewed === 1 ? '' : 's'}${skips ? ` and skipped ${skips}` : ''}. The next batch is already scheduled.`
                  : nextDue
                    ? `The next highlight comes back ${dueLabel(new Date(nextDue).toISOString()).toLowerCase()}.`
                    : 'Add a highlight from your library and it will appear here.'}
              </p>
              <div className="done-actions">
                <button type="button" className="btn btn--primary" onClick={reviewAll}>
                  <Icon name="sparkle" size={16} /> Review everything
                </button>
                <button type="button" className="btn btn--ghost" onClick={refreshQueue}>
                  <Icon name="sync" size={16} /> Check for due
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="review-side">
          <section className="side-card">
            <header className="side-head">
              <h2>Session</h2>
              <span className="side-count">
                {reviewed} done{queue.length ? ` · ${queue.length} left` : ''}
              </span>
            </header>
            <div className="session-bar">
              <span
                style={{
                  width: `${Math.min(100, (reviewed / Math.max(1, reviewed + queue.length)) * 100)}%`,
                }}
              />
            </div>
            <ul className="queue-list">
              {queue.slice(1, 4).map((id) => {
                const item = data.highlights.find((highlight) => highlight.id === id)
                if (!item) return null
                const doc = data.docs.find((entry) => entry.id === item.docId)
                return (
                  <li key={id}>
                    <span className={`dot dot--${item.color}`} />
                    <div>
                      <p>{item.text}</p>
                      <span>{doc?.title ?? 'Unknown source'}</span>
                    </div>
                  </li>
                )
              })}
              {queue.length < 2 ? (
                <li className="queue-empty">
                  {queue.length === 1 ? 'Last one in the deck.' : 'The deck is clear.'}
                </li>
              ) : null}
            </ul>
          </section>

          <section className="side-card side-card--goal">
            <header className="side-head">
              <h2>Daily goal</h2>
              <span className="side-count">{Math.round((reviewsToday / goal) * 100)}%</span>
            </header>
            <div className="goal-line">
              <div className="goal-track">
                <span style={{ width: `${Math.min(100, (reviewsToday / goal) * 100)}%` }} />
              </div>
              <p>
                {reviewsToday} of {goal} reviews today
              </p>
            </div>
            <p className="side-note">
              A small daily habit beats a heroic weekend. You can change this number in settings.
            </p>
          </section>

          <section className="side-card side-card--plain">
            <h2 className="side-title">How review works</h2>
            <p className="side-note">
              Each rating pushes the highlight further into the future. Difficult ideas come back
              sooner; familiar ones wait longer. Everything stays on this device.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
