import { currentUser } from '@/lib/auth'
import { json } from '@/lib/http'

export async function GET() {
  const user = await currentUser()
  return json({ user })
}
