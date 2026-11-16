import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { LoginForm } from './LoginForm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Sign in · 0x wise',
  description: 'Sign in to your self-hosted reading, listening and highlight review library.',
}

export default async function LoginPage() {
  const user = await currentUser()
  if (user) redirect('/')

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/brand-mark.svg" alt="" width="34" height="39" />
          <span>
            0x wise<span className="brand-dot">.</span>
          </span>
        </div>
        <h1>Welcome back.</h1>
        <p className="login-sub">
          Your library, highlights and review queue live on this machine. Sign in to pick up where
          you left off.
        </p>
        <LoginForm />
      </div>
      <p className="login-foot">
        0x wise · self-hosted · <span lang="ar" dir="rtl">مكتبتك على جهازك</span>
      </p>
    </main>
  )
}
