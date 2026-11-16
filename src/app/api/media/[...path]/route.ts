import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { mediaDir } from '@/lib/db'
import { withUser } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/opus',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.m4v': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.epub': 'application/epub+zip',
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return withUser(async () => {
    const { path: parts } = await context.params
    const relative = parts.map((part) => decodeURIComponent(part)).join('/')
    const root = path.resolve(mediaDir)
    const target = path.resolve(root, relative)
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      return new Response('Not found', { status: 404 })
    }

    const info = await stat(target).catch(() => null)
    if (!info || !info.isFile()) return new Response('Not found', { status: 404 })

    const type = TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream'
    const range = request.headers.get('range')
    const baseHeaders: Record<string, string> = {
      'content-type': type,
      'accept-ranges': 'bytes',
      'cache-control': 'private, max-age=600',
      'content-disposition': `inline; filename="${path.basename(target).replace(/"/g, '')}"`,
    }

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
      if (match) {
        const start = match[1] ? Number(match[1]) : 0
        const end = match[2] ? Number(match[2]) : info.size - 1
        if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < info.size) {
          const boundedEnd = Math.min(end, info.size - 1)
          const stream = createReadStream(target, { start, end: boundedEnd })
          return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
            status: 206,
            headers: {
              ...baseHeaders,
              'content-range': `bytes ${start}-${boundedEnd}/${info.size}`,
              'content-length': String(boundedEnd - start + 1),
            },
          })
        }
        return new Response(null, {
          status: 416,
          headers: { ...baseHeaders, 'content-range': `bytes */${info.size}` },
        })
      }
    }

    const stream = createReadStream(target)
    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
      status: 200,
      headers: { ...baseHeaders, 'content-length': String(info.size) },
    })
  })
}
