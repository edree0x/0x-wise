import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type { Category, Doc, ToastKind } from './types'
import { useStore } from './store'
import { Icon, type IconName } from './icons'
import { clamp } from './utils'

const CATEGORIES: Category[] = ['Article', 'Book', 'Newsletter', 'Tweet', 'PDF']

export function Cover({ doc, size = 'md' }: { doc: Doc; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`cover cover--${size}`} data-color={doc.color} aria-hidden="true">
      <span className="cover-spine" />
      <span className="cover-grain" />
      <span className="cover-category">{doc.category}</span>
      <span className="cover-title">{doc.title}</span>
      <span className="cover-author">{doc.author}</span>
    </div>
  )
}

export function ProgressRing({
  value,
  max,
  size = 54,
  stroke = 5,
  label,
}: {
  value: number
  max: number
  size?: number
  stroke?: number
  label?: string
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const pct = max > 0 ? clamp(value / max, 0, 1) : 0
  return (
    <span className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.16}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="progress-ring-label">{label ?? `${Math.round(pct * 100)}%`}</span>
    </span>
  )
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="tag-pill">#{children}</span>
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={24} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const lastFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    lastFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.classList.add('modal-open')
    const timer = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(
        'input, textarea, select, button:not(.modal-close)',
      )
      target?.focus()
    }, 40)
    return () => {
      window.clearTimeout(timer)
      document.body.classList.remove('modal-open')
      lastFocused.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className={`modal-panel${wide ? ' modal-panel--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" size={19} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-foot">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}

export function ToastViewport({ toast, onDismiss }: { toast: { id: number; message: string; kind: ToastKind } | null; onDismiss: () => void }) {
  if (!toast) return null
  const icon: IconName = toast.kind === 'success' ? 'check' : toast.kind === 'error' ? 'info' : 'sparkle'
  return createPortal(
    <div className={`toast toast--${toast.kind}`} role="status" key={toast.id}>
      <span className="toast-icon">
        <Icon name={icon} size={16} />
      </span>
      <span className="toast-text">{toast.message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss message" className="toast-close">
        <Icon name="close" size={14} />
      </button>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="modal-copy">{body}</p>
    </Modal>
  )
}

export function AddDocModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated?: (id: string) => void
}) {
  const { actions, showToast } = useStore()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [source, setSource] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState<Category>('Article')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setTitle('')
    setAuthor('')
    setSource('')
    setUrl('')
    setCategory('Article')
    setText('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const trimmedTitle = title.trim()
    const trimmedUrl = url.trim()
    if (!trimmedTitle && !trimmedUrl) return
    setBusy(true)
    const paragraphs = text
      .replace(/\r\n/g, '\n')
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .filter(Boolean)
    const needsFetch = Boolean(trimmedUrl) && paragraphs.length === 0
    const id = actions.addDoc({
      title: trimmedTitle || trimmedUrl,
      author,
      source,
      url: trimmedUrl,
      category,
      content: paragraphs,
      tags: [],
    })
    actions.addImportRecord(trimmedTitle || trimmedUrl, 1)
    reset()
    setBusy(false)
    onClose()
    onCreated?.(id)
    if (needsFetch) {
      showToast('Fetching the article…')
      const result = await actions.ingest(id, trimmedUrl)
      if (result?.ok) showToast('Article saved and extracted', 'success')
      else if (result?.error) showToast(result.error, 'error')
    } else {
      showToast('Added to your library', 'success')
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Add to library"
      subtitle="Paste a link to fetch the article, or paste text to keep it as is."
      wide
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="add-doc-form"
            className="btn btn--primary"
            disabled={busy || (!title.trim() && !url.trim())}
          >
            <Icon name="plus" size={16} /> Add document
          </button>
        </>
      }
    >
      <form id="add-doc-form" className="form-grid" onSubmit={submit}>
        <label className="field-label">
          <span>Title</span>
          <input
            className="text-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What are you saving? (optional with a link)"
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
              placeholder="Publication or site"
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
            <span>Link</span>
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
            rows={7}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste the text here. Leave blank to save a bookmark."
          />
        </label>
      </form>
    </Modal>
  )
}

export function ColorDots({
  value,
  onChange,
  size = 'md',
}: {
  value: string
  onChange: (color: 'yellow' | 'blue' | 'green' | 'pink') => void
  size?: 'sm' | 'md'
}) {
  const colors = [
    { id: 'yellow', label: 'Yellow' },
    { id: 'blue', label: 'Blue' },
    { id: 'green', label: 'Green' },
    { id: 'pink', label: 'Pink' },
  ] as const
  return (
    <span className={`color-dots color-dots--${size}`} role="group" aria-label="Highlight color">
      {colors.map((color) => (
        <button
          key={color.id}
          type="button"
          className={`color-dot color-dot--${color.id}${value === color.id ? ' is-active' : ''}`}
          onClick={() => onChange(color.id)}
          aria-label={color.label}
          aria-pressed={value === color.id}
        />
      ))}
    </span>
  )
}
