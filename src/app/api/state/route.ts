import { getState } from '@/lib/state'
import { withUser, json } from '@/lib/http'

export async function GET() {
  return withUser(async () => json({ data: getState() }))
}
