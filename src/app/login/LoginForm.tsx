'use client'

import { useState, type FormEvent } from 'react'

export function LoginForm() {
  const [email, setEmail] = useState('me@0xwise.local')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      // Read CSRF token from cookie for login request
      const csrfCookie = document.cookie
        .split('; ')
        .find((row) => row.startsWith('oxw_csrf='))
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (csrfCookie) {
        headers['x-csrf-token'] = csrfCookie.split('=')[1]
      }
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, password }),
      })
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setError(body.error ?? 'Could not sign in')
        setBusy(false)
        return
      }
      window.location.assign('/')
    } catch {
      setError('Cannot reach the server')
      setBusy(false)
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <div className="login-field">
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
          placeholder="you@example.com"
        />
      </div>
      <div className="login-field">
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          autoFocus
          placeholder="••••••••"
        />
      </div>
      {error ? <p className="login-error" role="alert">{error}</p> : null}
      <button type="submit" className="btn btn--primary btn--full" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="login-hint">
        Default account is <code>me@0xwise.local</code> with the password from your
        <code>OXW_PASSWORD</code> environment variable.
      </p>
    </form>
  )
}
