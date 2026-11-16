import JSZip from 'jszip'
import { JSDOM } from 'jsdom'
import path from 'node:path'
import { blocksFromHtml } from './extract'

export type ParsedBook = {
  title: string
  author: string
  content: string[]
  chapters: { title: string; start: number }[]
  cover?: string
}

function textOf(document: Document, selector: string): string {
  const element = document.querySelector(selector)
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function resolve(base: string, href: string): string {
  return path.posix.normalize(path.posix.join(path.posix.dirname(base), href))
}

export async function parseEpub(buffer: Buffer): Promise<ParsedBook> {
  const zip = await JSZip.loadAsync(buffer)
  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) throw new Error('Not a valid EPUB (missing container.xml)')
  const container = new JSDOM(await containerFile.async('string'), { contentType: 'text/xml' })
  const rootfile = container.window.document.querySelector('rootfile')?.getAttribute('full-path')
  container.window.close()
  if (!rootfile) throw new Error('EPUB has no package document')

  const opfFile = zip.file(rootfile)
  if (!opfFile) throw new Error('EPUB package document is missing')
  const opfText = await opfFile.async('string')
  const opf = new JSDOM(opfText, { contentType: 'text/xml' })
  const opfDoc = opf.window.document

  const title = textOf(opfDoc, 'metadata > title, title') || 'Untitled book'
  const author = textOf(opfDoc, 'metadata > creator, creator') || 'Unknown'

  const manifest = new Map<string, { href: string; type: string; properties: string }>()
  for (const item of Array.from(opfDoc.querySelectorAll('manifest > item'))) {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    if (!id || !href) continue
    manifest.set(id, {
      href: resolve(rootfile, href),
      type: item.getAttribute('media-type') ?? '',
      properties: item.getAttribute('properties') ?? '',
    })
  }

  let coverHref = ''
  for (const [id, item] of manifest) {
    if (item.properties.includes('cover-image')) {
      coverHref = item.href
      break
    }
    if (id === 'cover' && item.type.startsWith('image/')) coverHref = item.href
  }

  const spine: string[] = []
  for (const itemref of Array.from(opfDoc.querySelectorAll('spine > itemref'))) {
    const idref = itemref.getAttribute('idref')
    if (idref) spine.push(idref)
  }
  opf.window.close()

  const content: string[] = []
  const chapters: { title: string; start: number }[] = []

  for (const idref of spine) {
    const item = manifest.get(idref)
    if (!item || !/html|xml/.test(item.type)) continue
    const file = zip.file(item.href)
    if (!file) continue
    const html = await file.async('string')
    const dom = new JSDOM(html, { contentType: item.type.includes('xml') ? 'text/xml' : 'text/html' })
    const document = dom.window.document
    const heading = textOf(document, 'h1, h2, h3') || textOf(document, 'title')
    const blocks = blocksFromHtml(document.body?.innerHTML ?? '', 'https://local.invalid')
    dom.window.close()
    if (!blocks.length) continue
    const start = content.length
    if (heading) chapters.push({ title: heading, start })
    content.push(...blocks)
  }

  let cover: string | undefined
  if (coverHref) {
    const coverFile = zip.file(coverHref)
    if (coverFile) {
      const ext = path.extname(coverHref).slice(1) || 'jpeg'
      const mime = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg'
      const base64 = await coverFile.async('base64')
      cover = `data:${mime};base64,${base64}`
    }
  }

  if (!content.length) throw new Error('No readable chapters found in this EPUB')
  return { title, author, content, chapters, cover }
}
