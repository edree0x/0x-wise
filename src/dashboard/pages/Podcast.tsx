import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { Icon } from '../icons'
import { Cover, EmptyState, Tag } from '../ui'
import { formatDate } from '../utils'
import type { Doc } from '../types'

function stamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`
}

export function PodcastPage({
  docId,
  onBack,
  onOpenSources,
}: {
  docId: string
  onBack: () => void
  onOpenSources: () => void
}) {
  const { data, actions, showToast, getPreviewEpisode } = useStore()
  const libraryDoc = data.docs.find((item) => item.id === docId)
  const preview = !libraryDoc ? getPreviewEpisode(docId) : null
  const isPreview = Boolean(preview && !libraryDoc)
  const doc: Doc | null = libraryDoc
    ? libraryDoc
    : preview
      ? {
          id: docId,
          title: preview.title,
          author: preview.author || preview.show?.author || preview.show?.name || 'Unknown',
          source: preview.show?.name || 'Podcast preview',
          url: preview.url || preview.feedUrl,
          category: 'Podcast',
          addedAt: new Date().toISOString(),
          minutes: preview.durationSec ? Math.max(1, Math.round(preview.durationSec / 60)) : 1,
          progress: 0,
          favorite: false,
          archived: false,
          color: 'clay',
          summary: preview.description || 'Preview episode',
          content: preview.content || [],
          tags: [],
          kind: 'podcast',
          cover: preview.artwork || preview.show?.artwork,
          audioUrl: preview.audioUrl,
          durationSec: preview.durationSec,
          publishedAt: preview.publishedAt,
          transcript: [],
          chapters: [],
          status: 'ready',
        }
      : null
  const highlights = useMemo(
    () => (isPreview ? [] : data.highlights.filter((highlight) => highlight.docId === docId)),
    [data.highlights, docId, isPreview],
  )
  const audioRef = useRef<HTMLAudioElement>(null)
  const [current, setCurrent] = useState(0)
  const [rate, setRate] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)

  if (!doc) {
    return (
      <div className="page">
        <EmptyState
          icon="listen"
          title="Episode not found"
          body="It may have been deleted or this preview is no longer available. Go back to Listen or Discover."
          action={
            <button type="button" className="btn btn--primary btn--small" onClick={onBack}>
              Back
            </button>
          }
        />
      </div>
    )
  }

  const transcript = doc.transcript ?? []

  const seek = (seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = seconds
    void audio.play().catch(() => undefined)
    setCurrent(seconds)
  }

  const saveProgress = (value: number) => {
    if (isPreview) return
    const next = Math.max(0, Math.min(100, Math.round(value)))
    if (Math.abs(next - doc.progress) >= 2) actions.updateDoc(doc.id, { progress: next })
  }

  const changeRate = (next: number) => {
    setRate(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  const clip = (text: string, start: number) => {
    if (isPreview) {
      showToast('Follow this podcast to save highlights to your library', 'error')
      return
    }
    const id = actions.addHighlight({
      docId: doc.id,
      text,
      color: 'yellow',
      source: 'podcast',
      location: { type: 'audio', startMs: Math.round(start * 1000), endMs: Math.round(start * 1000) },
    })
    if (id) showToast('Highlight saved from the transcript', 'success')
  }

  return (
    <div className="page podcast-page">
      <button type="button" className="back-link" onClick={onBack}>
        <Icon name="left" size={16} /> Listen
      </button>

      <header className="podcast-head">
        <Cover doc={doc} size="lg" />
        <div className="podcast-copy">
          <p className="eyebrow">{doc.category === 'YouTube' ? 'YouTube' : 'Podcast'} · {doc.source}</p>
          <h1>{doc.title}</h1>
          <p className="podcast-meta">
            {doc.author}
            {doc.publishedAt ? ` · ${formatDate(doc.publishedAt)}` : ''}
            {doc.durationSec ? ` · ${stamp(doc.durationSec)}` : ''}
            {doc.lang ? ` · ${doc.lang}` : ''}
          </p>
          {doc.tags.length ? (
            <div className="podcast-tags">
              {doc.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          ) : null}
          {isPreview ? <p className="tag-pill">Preview · not saved to library</p> : null}
          {doc.summary ? <p className="podcast-summary">{doc.summary}</p> : null}

          {doc.audioUrl ? (
            <div className="podcast-player">
              <audio
                ref={audioRef}
                src={doc.audioUrl}
                preload="metadata"
                controls
                onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
                onPause={(event) =>
                  saveProgress((event.currentTarget.currentTime / (event.currentTarget.duration || 1)) * 100)
                }
                onEnded={() => {
                  saveProgress(100)
                  showToast('Episode finished', 'success')
                }}
              />
              <div className="podcast-speed" role="group" aria-label="Playback speed">
                {[0.75, 1, 1.25, 1.5, 2].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`speed-chip${rate === value ? ' is-active' : ''}`}
                    onClick={() => changeRate(value)}
                  >
                    {value}×
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="podcast-empty-audio">
              <Icon name="info" size={16} /> This episode has no audio file yet. Add it from an RSS feed,
              or upload the audio to transcribe it.
            </p>
          )}
        </div>
      </header>

      <div className="podcast-layout">
        <section className="panel podcast-transcript">
          <div className="panel-head panel-head--row">
            <div>
              <h2>Transcript</h2>
              <p>
                {transcript.length
                  ? 'Click a timestamp to jump there. Use the highlight button to keep a line for review.'
                  : 'Transcription runs locally with faster-whisper on this machine.'}
              </p>
            </div>
            {!transcript.length && doc.audioUrl && !isPreview ? (
              <button
                type="button"
                className="btn btn--soft btn--small"
                disabled={doc.status === 'transcribing'}
                onClick={() => {
                  actions.transcribe(doc.id)
                  showToast('Queued for local transcription', 'success')
                }}
              >
                <Icon name="sparkle" size={16} />
                {doc.status === 'transcribing' ? 'Transcribing…' : 'Transcribe episode'}
              </button>
            ) : null}
          </div>

          {transcript.length ? (
            <ol className="transcript-list">
              {transcript.map((segment, index) => (
                <li
                  key={`${segment.start}-${index}`}
                  className={`transcript-row${selected === `${segment.start}-${index}` ? ' is-selected' : ''}`}
                  onClick={() => setSelected(`${segment.start}-${index}`)}
                >
                  <button
                    type="button"
                    className={`transcript-time${current >= segment.start && current < segment.end ? ' is-current' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      seek(segment.start)
                    }}
                  >
                    {stamp(segment.start)}
                  </button>
                  <p className="transcript-text">
                    {segment.speaker ? <strong>{segment.speaker}: </strong> : null}
                    {segment.text}
                  </p>
                  <button
                    type="button"
                    className="transcript-clip"
                    title="Highlight this line"
                    aria-label="Highlight this line"
                    onClick={(event) => {
                      event.stopPropagation()
                      clip(segment.text, segment.start)
                    }}
                  >
                    <Icon name="highlighter" size={15} />
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div className="transcript-empty">
              <Icon name="notes" size={22} />
              <p>
                No transcript yet. Queue this episode and the worker will transcribe it locally, then
                the text shows up here with timestamps you can highlight.
              </p>
              <button type="button" className="btn btn--soft btn--small" onClick={onOpenSources}>
                <Icon name="rss" size={16} /> Manage podcast feeds
              </button>
            </div>
          )}
        </section>

        <aside className="panel podcast-side">
          <div className="panel-head">
            <h2>Highlights</h2>
            <p>{highlights.length ? `${highlights.length} saved from this episode` : 'Nothing saved yet'}</p>
          </div>
          {highlights.length ? (
            <ul className="podcast-highlights">
              {highlights.map((highlight) => (
                <li key={highlight.id}>
                  <button
                    type="button"
                    className="podcast-highlight-quote"
                    onClick={() => {
                      if (highlight.location?.type === 'audio') seek(highlight.location.startMs / 1000)
                    }}
                  >
                    {highlight.location?.type === 'audio' ? (
                      <span className="transcript-time">{stamp(highlight.location.startMs / 1000)}</span>
                    ) : null}
                    <span>{highlight.text}</span>
                  </button>
                  {highlight.note ? <p className="podcast-highlight-note">{highlight.note}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="podcast-side-empty">
              Highlight lines from the transcript and they will join your review queue.
            </p>
          )}
          {doc.content.length ? (
            <>
              <div className="panel-head panel-head--tight">
                <h2>Show notes</h2>
              </div>
              <div className="podcast-notes">
                {doc.content.slice(0, 12).map((block, index) => (
                  <p key={index}>{block.replace(/^[#>\-]\s*/, '')}</p>
                ))}
              </div>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
