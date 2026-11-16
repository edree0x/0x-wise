import { listSources } from '@/lib/db'
import { json, withUser } from '@/lib/http'

export async function GET() {
  return withUser(async () => json({ sources: listSources() }))
}
