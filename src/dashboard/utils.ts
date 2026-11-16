import type { Doc, Highlight } from './types'

export const DAY = 86_400_000

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function relativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'Never'
  const diff = Date.now() - then
  if (diff < 60_000) return 'Just now'
  const minutes = Math.round(diff / 60_000)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  return formatShortDate(iso)
}

export function dueLabel(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Ready now'
  const days = Math.ceil(diff / DAY)
  if (days <= 1) return 'Tomorrow'
  return `In ${days} days`
}

export function estimateMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 220))
}

export function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function downloadFile(filename: string, contents: string, type: string): void {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function highlightsToCSV(highlights: Highlight[], docs: Doc[]): string {
  const rows = [
    ['Text', 'Note', 'Title', 'Author', 'Source', 'Tags', 'Color', 'Created', 'Last reviewed', 'Reviews'],
  ]
  for (const highlight of highlights) {
    const doc = docs.find((item) => item.id === highlight.docId)
    rows.push([
      highlight.text,
      highlight.note,
      doc?.title ?? '',
      doc?.author ?? '',
      doc?.source ?? '',
      highlight.tags.join(', '),
      highlight.color,
      formatDate(highlight.createdAt),
      highlight.lastReviewed ? formatDate(highlight.lastReviewed) : '',
      String(highlight.reviewCount),
    ])
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function libraryToMarkdown(docs: Doc[], highlights: Highlight[]): string {
  const lines: string[] = ['# 0x wise library', '', `Exported ${formatDate(new Date().toISOString())}`, '']
  for (const doc of docs) {
    lines.push(`## ${doc.title}`)
    lines.push('')
    lines.push(`*${doc.author}* — ${doc.source} · ${doc.category}`)
    lines.push('')
    if (doc.summary) {
      lines.push(doc.summary)
      lines.push('')
    }
    const docHighlights = highlights.filter((highlight) => highlight.docId === doc.id)
    for (const highlight of docHighlights) {
      lines.push(`> ${highlight.text}`)
      lines.push('')
      if (highlight.note) {
        lines.push(`Note: ${highlight.note}`)
        lines.push('')
      }
      if (highlight.tags.length) {
        lines.push(highlight.tags.map((tag) => `#${tag.replace(/\s+/g, '-')}`).join(' '))
        lines.push('')
      }
    }
  }
  return lines.join('\n')
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}
