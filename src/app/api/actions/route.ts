import { applyAction } from '@/lib/actions'
import { json, withUserAndCsrf } from '@/lib/http'

export async function POST(request: Request) {
  return withUserAndCsrf(request, async () => {
    let body: { type?: string; payload?: Record<string, unknown> }
    try {
      body = (await request.json()) as { type?: string; payload?: Record<string, unknown> }
    } catch {
      return json({ error: 'Invalid JSON' }, { status: 400 })
    }
    if (!body.type) return json({ error: 'Missing action type' }, { status: 400 })
    const result = await applyAction(body.type, body.payload ?? {})
    return json(result)
  })
}
