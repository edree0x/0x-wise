import { db } from '@/lib/db'

export async function GET() {
  try {
    const docs = db().prepare('SELECT COUNT(*) AS n FROM documents WHERE deleted = 0').get() as { n: number }
    const highlights = db().prepare('SELECT COUNT(*) AS n FROM highlights WHERE deleted = 0').get() as { n: number }
    return Response.json({
      ok: true,
      app: '0x wise',
      version: '0.1.0',
      documents: Number(docs.n),
      highlights: Number(highlights.n),
    })
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'database unavailable' },
      { status: 500 },
    )
  }
}
