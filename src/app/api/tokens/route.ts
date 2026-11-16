import { createApiToken, listApiTokens, revokeApiToken } from '@/lib/auth'
import { json, withUser } from '@/lib/http'

export async function GET() {
  return withUser(async () => json({ tokens: listApiTokens() }))
}

export async function POST(request: Request) {
  return withUser(async (user) => {
    let body: { name?: string }
    try {
      body = (await request.json()) as { name?: string }
    } catch {
      body = {}
    }
    const created = createApiToken(user.id, body.name ?? 'API token')
    return json({ ...created, tokens: listApiTokens() })
  })
}

export async function DELETE(request: Request) {
  return withUser(async () => {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return json({ error: 'Missing token id' }, { status: 400 })
    revokeApiToken(id)
    return json({ ok: true, tokens: listApiTokens() })
  })
}
