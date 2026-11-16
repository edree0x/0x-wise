import { useRef, useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { Icon } from '../icons'
import type { Category } from '../types'
import { formatDate } from '../utils'

const CATEGORIES: Category[] = ['Article', 'Book', 'Newsletter', 'Tweet', 'PDF']
type ImportMode = 'paste' | 'link' | 'book' | 'backup' | 'readwise'

const MODES: { id: ImportMode; label: string; icon: 'notes' | 'link' | 'book' | 'upload' | 'download' }[] = [
  { id: 'paste', label: 'Paste text', icon: 'notes' },
  { id: 'link', label: 'From a link', icon: 'link' },
  { id: 'book', label: 'EPUB / PDF', icon: 'book' },
  { id: 'backup', label: 'Restore backup', icon: 'upload' },
  { id: 'readwise', label: 'Readwise CSV', icon: 'download' },
]

function download(format: 'backup' | 'csv' | 'markdown' | 'readwise') {
  const anchor = document.createElement('a')
  anchor.href = `/api/export?format=${format}`
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export function ImportExportPage({ onOpenDoc }: { onOpenDoc: (id: string) => void }) {
  const { data, actions, showToast } = useStore()
  const [mode, setMode] = useState<ImportMode>('paste')
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [source, setSource] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState<Category>('Article')
  const [text, setText] = useState('')
  const [summary, setSummary] = useState('')
  const [importError, setImportError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const backupRef = useRef<HTMLInputElement>(null)
  const bookRef = useRef<HTMLInputElement>(null)
  const readwiseRef = useRef<HTMLInputElement>(null)

  const resetForm = () => {
    setTitle('')
    setAuthor('')
    setSource('')
    setUrl('')
    setCategory('Article')
    setText('')
    setSummary('')
    setImportError('')
  }

  const saveText = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    const paragraphs = text
      .replace(/\r\n/g, '\n')
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .filter(Boolean)
    const id = actions.addDoc({ title, author, source, url, category, content: paragraphs })
    actions.addImportRecord(title.trim(), 1)
    showToast('Document saved to your library', 'success')
    resetForm()
    onOpenDoc(id)
  }

  const saveLink = async (event: FormEvent) => {
    event.preventDefault()
    if (!url.trim() || busy) return
    let resolvedSource = source.trim()
    let host = ''
    try {
      host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname
    } catch {
      host = ''
    }
    if (!resolvedSource) resolvedSource = host || 'Saved link'
    const resolvedTitle = title.trim() || host || url.trim()
    setBusy(true)
    const id = actions.addDoc({
      title: resolvedTitle,
      author,
      source: resolvedSource,
      url: url.trim(),
      category,
      summary: summary || 'A saved link.',
      content: [],
    })
    actions.addImportRecord(resolvedTitle, 1)
    resetForm()
    onOpenDoc(id)
    showToast('Fetching the page…')
    const result = await actions.ingest(id, url.trim())
    setBusy(false)
    if (result?.ok) showToast('Article saved and extracted', 'success')
    else if (result?.error) showToast(result.error, 'error')
  }

  const uploadBook = async (file: File | null) => {
    if (!file) return
    setImportError('')
    setBusy(true)
    const result = await actions.upload(file)
    setBusy(false)
    if (!result) return
    if (!result.ok) {
      setImportError(result.error ?? 'Could not read that file.')
      return
    }
    showToast('Book imported', 'success')
    if (result.id) onOpenDoc(result.id)
  }

  const handleBackup = async (file: File | null) => {
    if (!file) return
    setImportError('')
    setBusy(true)
    try {
      const raw = await file.text()
      const parsed: unknown = JSON.parse(raw)
      const result = await actions.importBackup(parsed)
      if (!result) {
        setImportError('That file is not a 0x wise backup. Export a fresh JSON backup and try again.')
        return
      }
      if (result.docs === 0 && result.highlights === 0) {
        setImportError('Nothing new to import. Every item in that backup is already in your library.')
        return
      }
      actions.addImportRecord(file.name, result.docs + result.highlights)
      showToast(
        `Imported ${result.docs} document${result.docs === 1 ? '' : 's'} and ${result.highlights} highlight${result.highlights === 1 ? '' : 's'}`,
        'success',
      )
      resetForm()
    } catch {
      setImportError('Could not read that file. A 0x wise JSON backup is the safest option.')
    } finally {
      setBusy(false)
    }
  }

  const handleReadwise = async (file: File | null) => {
    if (!file) return
    setImportError('')
    setBusy(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const response = await fetch('/api/readwise/import', { method: 'POST', body })
      const result = (await response.json().catch(() => ({}))) as {
        error?: string
        counts?: { docs: number; highlights: number }
        data?: unknown
      }
      if (!response.ok) {
        setImportError(result.error ?? 'Could not import that CSV.')
        return
      }
      actions.refresh()
      const counts = result.counts ?? { docs: 0, highlights: 0 }
      showToast(
        `Imported ${counts.highlights} highlight${counts.highlights === 1 ? '' : 's'} from ${counts.docs} book${counts.docs === 1 ? '' : 's'}`,
        'success',
      )
      resetForm()
    } catch {
      setImportError('Could not reach the server with that file.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page import-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Tools</p>
          <h1>Import &amp; export</h1>
          <p className="page-sub">
            Bring in what you already have and take a portable copy whenever you want. Everything stays
            on this machine.
          </p>
        </div>
        <div className="head-actions">
          <span className="local-badge">
            <Icon name="lock" size={14} /> Self-hosted
          </span>
        </div>
      </header>

      <div className="import-layout">
        <section className="panel">
          <div className="panel-head">
            <h2>Add to your library</h2>
            <p>Paste a passage, fetch a link, upload a book, or restore your archive.</p>
          </div>
          <div className="mode-tabs" role="tablist" aria-label="Import method">
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={mode === item.id}
                className={mode === item.id ? 'is-active' : ''}
                onClick={() => {
                  setMode(item.id)
                  setImportError('')
                }}
              >
                <Icon name={item.icon} size={15} /> {item.label}
              </button>
            ))}
          </div>

          {mode === 'paste' ? (
            <form className="form-grid" onSubmit={saveText}>
              <label className="field-label">
                <span>Title</span>
                <input
                  className="text-input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="The piece you are saving"
                  required
                />
              </label>
              <div className="form-row">
                <label className="field-label">
                  <span>Author</span>
                  <input
                    className="text-input"
                    value={author}
                    onChange={(event) => setAuthor(event.target.value)}
                    placeholder="Optional"
                  />
                </label>
                <label className="field-label">
                  <span>Source</span>
                  <input
                    className="text-input"
                    value={source}
                    onChange={(event) => setSource(event.target.value)}
                    placeholder="Publication"
                  />
                </label>
              </div>
              <div className="form-row">
                <label className="field-label">
                  <span>Category</span>
                  <select
                    className="text-input"
                    value={category}
                    onChange={(event) => setCategory(event.target.value as Category)}
                  >
                    {CATEGORIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  <span>Original link</span>
                  <input
                    className="text-input"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://"
                    inputMode="url"
                  />
                </label>
              </div>
              <label className="field-label">
                <span>Text</span>
                <textarea
                  className="text-input text-area"
                  rows={8}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Paste the article, chapter, or notes here. Blank lines become paragraphs."
                />
              </label>
              <div className="form-actions">
                <span className="form-hint">
                  {text.trim() ? `${text.trim().split(/\s+/).length} words` : 'Text is optional'}
                </span>
                <button type="submit" className="btn btn--primary" disabled={!title.trim()}>
                  <Icon name="plus" size={16} /> Add to library
                </button>
              </div>
            </form>
          ) : null}

          {mode === 'link' ? (
            <form className="form-grid" onSubmit={saveLink}>
              <label className="field-label">
                <span>URL</span>
                <input
                  className="text-input"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com/article"
                  inputMode="url"
                  required
                />
              </label>
              <label className="field-label">
                <span>Title (optional)</span>
                <input
                  className="text-input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Taken from the page when left empty"
                />
              </label>
              <div className="form-row">
                <label className="field-label">
                  <span>Author</span>
                  <input
                    className="text-input"
                    value={author}
                    onChange={(event) => setAuthor(event.target.value)}
                    placeholder="Optional"
                  />
                </label>
                <label className="field-label">
                  <span>Category</span>
                  <select
                    className="text-input"
                    value={category}
                    onChange={(event) => setCategory(event.target.value as Category)}
                  >
                    {CATEGORIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field-label">
                <span>Why keep it?</span>
                <textarea
                  className="text-input text-area"
                  rows={3}
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  placeholder="A sentence about what caught your eye."
                />
              </label>
              <div className="form-actions">
                <span className="form-hint">The readable text is extracted and stored locally.</span>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={busy || !url.trim()}
                >
                  <Icon name="link" size={16} /> {busy ? 'Saving…' : 'Save link'}
                </button>
              </div>
            </form>
          ) : null}

          {mode === 'book' ? (
            <div>
              <button
                type="button"
                className={`drop-zone${dragOver ? ' is-over' : ''}`}
                disabled={busy}
                onClick={() => bookRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragOver(false)
                  void uploadBook(event.dataTransfer.files[0] ?? null)
                }}
              >
                <span className="drop-icon">
                  <Icon name="book" size={22} />
                </span>
                <strong>{busy ? 'Reading the book…' : 'Drop an EPUB or PDF here'}</strong>
                <span>or click to choose a file. Up to 40 MB. Text and chapters are parsed locally.</span>
              </button>
              <input
                ref={bookRef}
                type="file"
                accept=".epub,.pdf,application/epub+zip,application/pdf"
                className="sr-only"
                onChange={(event) => {
                  void uploadBook(event.target.files?.[0] ?? null)
                  event.target.value = ''
                }}
              />
              {importError ? <p className="form-error">{importError}</p> : null}
              <p className="panel-note">
                EPUB keeps its chapters and cover. PDF extracts text as blocks you can read and
                highlight in the reader.
              </p>
            </div>
          ) : null}

          {mode === 'backup' ? (
            <div>
              <button
                type="button"
                className={`drop-zone${dragOver ? ' is-over' : ''}`}
                disabled={busy}
                onClick={() => backupRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragOver(false)
                  void handleBackup(event.dataTransfer.files[0] ?? null)
                }}
              >
                <span className="drop-icon">
                  <Icon name="upload" size={22} />
                </span>
                <strong>{busy ? 'Restoring…' : 'Drop a JSON backup here'}</strong>
                <span>or click to choose a file. Existing items are never overwritten.</span>
              </button>
              <input
                ref={backupRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => {
                  void handleBackup(event.target.files?.[0] ?? null)
                  event.target.value = ''
                }}
              />
              {importError ? <p className="form-error">{importError}</p> : null}
              <p className="panel-note">
                Backups include documents, highlights, notes, tags, review history, and settings.
                Imports merge by ID, so running the same file twice is safe.
              </p>
            </div>
          ) : null}

          {mode === 'readwise' ? (
            <div>
              <button
                type="button"
                className={`drop-zone${dragOver ? ' is-over' : ''}`}
                disabled={busy}
                onClick={() => readwiseRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragOver(false)
                  void handleReadwise(event.dataTransfer.files[0] ?? null)
                }}
              >
                <span className="drop-icon">
                  <Icon name="download" size={22} />
                </span>
                <strong>{busy ? 'Importing…' : 'Drop a Readwise CSV export'}</strong>
                <span>or click to choose a file. Older highlights are merged into your review queue.</span>
              </button>
              <input
                ref={readwiseRef}
                type="file"
                accept="text/csv,.csv"
                className="sr-only"
                onChange={(event) => {
                  void handleReadwise(event.target.files?.[0] ?? null)
                  event.target.value = ''
                }}
              />
              {importError ? <p className="form-error">{importError}</p> : null}
              <p className="panel-note">
                In Readwise, open <em>Export</em> and choose CSV. Books are created automatically and
                highlights are spread across the next month for review.
              </p>
            </div>
          ) : null}
        </section>

        <aside className="import-side">
          <section className="panel panel--compact">
            <div className="panel-head">
              <h2>Export</h2>
              <p>Take your data anywhere. No account, no lock-in.</p>
            </div>
            <div className="export-list">
              <button type="button" className="export-card" onClick={() => download('backup')}>
                <span className="export-icon">
                  <Icon name="download" size={18} />
                </span>
                <span>
                  <strong>JSON backup</strong>
                  <small>Everything, restorable</small>
                </span>
                <Icon name="right" size={15} />
              </button>
              <button type="button" className="export-card" onClick={() => download('csv')}>
                <span className="export-icon">
                  <Icon name="chart" size={18} />
                </span>
                <span>
                  <strong>Highlights CSV</strong>
                  <small>For spreadsheets and scripts</small>
                </span>
                <Icon name="right" size={15} />
              </button>
              <button type="button" className="export-card" onClick={() => download('markdown')}>
                <span className="export-icon">
                  <Icon name="notes" size={18} />
                </span>
                <span>
                  <strong>Markdown library</strong>
                  <small>Quotes, notes, and tags</small>
                </span>
                <Icon name="right" size={15} />
              </button>
              <button type="button" className="export-card" onClick={() => download('readwise')}>
                <span className="export-icon">
                  <Icon name="highlighter" size={18} />
                </span>
                <span>
                  <strong>Readwise v2 JSON</strong>
                  <small>For existing Readwise plugins</small>
                </span>
                <Icon name="right" size={15} />
              </button>
            </div>
          </section>

          <section className="panel panel--compact">
            <div className="panel-head">
              <h2>Recent imports</h2>
              <p>A short receipt of what came in.</p>
            </div>
            {data.imports.length ? (
              <ul className="import-list">
                {data.imports.map((record) => (
                  <li key={record.id}>
                    <span className="import-dot" />
                    <span>
                      <strong>{record.name}</strong>
                      <small>
                        {formatDate(record.date)} · {record.count} item{record.count === 1 ? '' : 's'}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-note">Nothing imported yet. Your first addition will show up here.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
