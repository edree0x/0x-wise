import { getDoc, getHighlight, search } from '@/lib/db'
import { json, withUser } from '@/lib/http'

export async function GET(request: Request) {
  return withUser(async () => {
    const query = new URL(request.url).searchParams.get('q') ?? ''
    const { docIds, highlightIds } = search(query)
    return json({
      docs: docIds.map((id) => getDoc(id)).filter(Boolean),
      highlights: highlightIds.map((id) => getHighlight(id)).filter(Boolean),
    })
  })
}
