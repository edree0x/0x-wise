export type ParsedPdf = {
  title: string
  content: string[]
  pages: number
}

type PdfTextItem = { str: string; transform: number[]; width: number; height: number }

export async function parsePdf(buffer: Buffer, fallbackTitle = 'Untitled PDF'): Promise<ParsedPdf> {
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as {
    getDocument: (options: Record<string, unknown>) => { promise: Promise<PdfDocument> }
  }

  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise

  const content: string[] = []
  const meta = await document.getMetadata().catch(() => null)
  const info = (meta?.info ?? {}) as { Title?: string }
  const title = (info.Title ?? '').trim() || fallbackTitle

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const items = (textContent.items as unknown[]).filter(
      (item): item is PdfTextItem =>
        typeof item === 'object' && item !== null && 'str' in item,
    )
    if (!items.length) continue

    const lines: { y: number; height: number; text: string }[] = []
    for (const item of items) {
      const y = Math.round(item.transform[5])
      const height = item.height || 10
      const last = lines[lines.length - 1]
      if (last && Math.abs(last.y - y) <= Math.max(2, height * 0.4)) {
        last.text = `${last.text} ${item.str}`.replace(/\s+/g, ' ').trim()
        last.height = Math.max(last.height, height)
      } else {
        lines.push({ y, height, text: item.str.replace(/\s+/g, ' ').trim() })
      }
    }

    const paragraphs: string[] = []
    let current = ''
    let lastY = lines[0]?.y ?? 0
    let lastHeight = lines[0]?.height ?? 10
    for (const line of lines) {
      if (!line.text) continue
      const gap = lastY - line.y
      if (current && gap > lastHeight * 1.7) {
        paragraphs.push(current.trim())
        current = line.text
      } else {
        current = current ? `${current} ${line.text}` : line.text
        if (current.length > 1400) {
          paragraphs.push(current.trim())
          current = ''
        }
      }
      lastY = line.y
      lastHeight = line.height
    }
    if (current.trim()) paragraphs.push(current.trim())

    if (paragraphs.length) {
      content.push(`## Page ${pageNumber}`)
      content.push(...paragraphs.map((paragraph) => paragraph.replace(/\s+/g, ' ')))
    }
    page.cleanup?.()
  }

  await document.destroy()
  if (!content.length) throw new Error('No text layer found — this PDF may be scanned images')
  return { title, content, pages: document.numPages }
}

type PdfDocument = {
  numPages: number
  getPage: (n: number) => Promise<{
    getTextContent: () => Promise<{ items: unknown[] }>
    cleanup?: () => void
  }>
  getMetadata: () => Promise<{ info?: Record<string, unknown> }>
  destroy: () => Promise<void>
}
