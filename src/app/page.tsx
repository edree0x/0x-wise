import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { Dashboard } from './Dashboard'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const user = await currentUser()
  if (!user) redirect('/login')
  return <Dashboard />
}
