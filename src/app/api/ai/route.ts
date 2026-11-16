import { getDoc, updateDocRow } from '@/lib/db'
import { aiConfig, chat, chunkText } from '@/lib/ai'
import { json, withUser } from '@/lib/http'

export const maxDuration = 120

export async function POST(request: Request) {
  return withUser(async () => {
    let body: { docId?: string; kind?: 'summary' | 'ask'; question?: string }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const doc = body.docId ? getDoc(body.docId) : null
    if (!doc) return json({ error: 'Document not found' }, { status: 404 })

    const source = chunkText(
      doc.transcript?.length
        ? doc.transcript.map((segment) => segment.text).join(' ')
        : doc.content.join('\n\n'),
    )
    if (!source) return json({ error: 'This document has no text to summarise yet' }, { status: 400 })

    const config = aiConfig()
    try {
      if (body.kind === 'ask') {
        const answer = await chat([
          {
            role: 'system',
            content:
              'You answer questions about a single document using only its text. If the answer is not in the text, say so plainly. Be concise.',
          },
          { role: 'user', content: `DOCUMENT: ${doc.title}\n\n${source}\n\nQUESTION: ${body.question ?? ''}` },
        ])
        return json({ ok: true, answer, model: config.model })
      }

      const answer = await chat([
        {
          role: 'system',
          content:
            'You summarise reading material for a personal knowledge base. Reply in the same language as the document. Use short sentences.',
        },
        {
          role: 'user',
          content: `Summarise this text in 4 sentences, then list 5 key takeaways as bullets.\n\nTitle: ${doc.title}\nAuthor: ${doc.author}\n\n${source}`,
        },
      ])
      updateDocRow(doc.id, { summary: answer.slice(0, 1200) })
      return json({ ok: true, summary: answer, model: config.model })
    } catch (error) {
      return json(
        {
          error: error instanceof Error ? error.message : 'AI request failed',
          hint: 'Start Ollama (or set OXW_AI_BASE_URL) and try again.',
        },
        { status: 502 },
      )
    }
  })
}
