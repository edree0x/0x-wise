import { useEffect, useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { Icon } from '../icons'
import { ConfirmDialog } from '../ui'
import type { ThemeName } from '../types'

const THEMES: { id: ThemeName; label: string; note: string }[] = [
  { id: 'light', label: 'Paper', note: 'Warm white, blue ink' },
  { id: 'sepia', label: 'Sepia', note: 'Soft cream, low glare' },
  { id: 'dark', label: 'Night', note: 'Dim room, warm text' },
]

type Health = { ok?: boolean; version?: string; documents?: number; highlights?: number }

export function SettingsPage({
  onOpenImport,
  onOpenIntegrations,
  installPrompt,
  onInstall,
  standalone,
}: {
  onOpenImport: () => void
  onOpenIntegrations: () => void
  installPrompt: (() => Promise<void>) | null
  onInstall: () => void
  standalone: boolean
}) {
  const { data, actions, showToast } = useStore()
  const [name, setName] = useState(data.settings.displayName)
  const [email, setEmail] = useState(data.settings.email)
  const [confirmReset, setConfirmReset] = useState(false)
  const [health, setHealth] = useState<Health | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch('/api/health', { cache: 'no-store' })
        const body = (await response.json()) as Health
        if (!cancelled) setHealth(body)
      } catch {
        // Health is informational; a failure should not disturb settings.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data.docs.length, data.highlights.length])

  const saveProfile = (event: FormEvent) => {
    event.preventDefault()
    actions.updateSettings({ displayName: name.trim() || 'Reader', email: email.trim() })
    showToast('Profile updated', 'success')
  }

  const exportAll = () => {
    const anchor = document.createElement('a')
    anchor.href = '/api/export?format=backup'
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    showToast('Backup downloaded', 'success')
  }

  const signOut = async () => {
    try {
      await fetch('/api/auth/login', { method: 'DELETE' })
    } catch {
      // Redirect anyway; the session cookie will expire on its own.
    }
    window.location.assign('/login')
  }

  return (
    <div className="page settings-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Tools</p>
          <h1>Settings</h1>
          <p className="page-sub">Tune the reading experience and decide where your data lives.</p>
        </div>
        <div className="head-actions">
          <span className="local-badge">
            <Icon name="lock" size={14} /> Self-hosted
          </span>
        </div>
      </header>

      <div className="settings-layout">
        <div className="settings-main">
          <section className="panel">
            <div className="panel-head">
              <h2>Profile</h2>
              <p>Used to greet you across the app. It stays on this machine.</p>
            </div>
            <form className="form-grid" onSubmit={saveProfile}>
              <div className="form-row">
                <label className="field-label">
                  <span>Display name</span>
                  <input
                    className="text-input"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Reader"
                  />
                </label>
                <label className="field-label">
                  <span>Email</span>
                  <input
                    className="text-input"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
              </div>
              <div className="form-actions">
                <span className="form-hint">Your sign-in address is set by OXW_EMAIL.</span>
                <button type="submit" className="btn btn--primary">
                  <Icon name="check" size={16} /> Save profile
                </button>
              </div>
            </form>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Language &amp; reading</h2>
              <p>Small adjustments that make a long session easier.</p>
            </div>

            <div className="setting-row">
              <div className="setting-copy">
                <strong>Interface language</strong>
                <span>
                  Arabic flips the layout to right-to-left. Interface copy is still English for now; Arabic
                  articles and highlights render correctly.
                </span>
              </div>
              <div className="segmented" role="group" aria-label="Interface language">
                <button
                  type="button"
                  className={`segmented-item${data.settings.language === 'en' ? ' is-active' : ''}`}
                  aria-pressed={data.settings.language === 'en'}
                  onClick={() => actions.updateSettings({ language: 'en' })}
                >
                  English
                </button>
                <button
                  type="button"
                  className={`segmented-item${data.settings.language === 'ar' ? ' is-active' : ''}`}
                  aria-pressed={data.settings.language === 'ar'}
                  onClick={() => actions.updateSettings({ language: 'ar' })}
                  lang="ar"
                >
                  العربية
                </button>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-copy">
                <strong>Daily review goal</strong>
                <span>How many highlights you aim to revisit each day.</span>
              </div>
              <div className="stepper">
                <button
                  type="button"
                  onClick={() => actions.updateSettings({ dailyGoal: Math.max(1, data.settings.dailyGoal - 1) })}
                  aria-label="Decrease daily goal"
                >
                  −
                </button>
                <span>{data.settings.dailyGoal}</span>
                <button
                  type="button"
                  onClick={() => actions.updateSettings({ dailyGoal: Math.min(60, data.settings.dailyGoal + 1) })}
                  aria-label="Increase daily goal"
                >
                  +
                </button>
              </div>
            </div>

            <div className="setting-block">
              <strong>Theme</strong>
              <div className="theme-grid" role="group" aria-label="Theme">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    className={`theme-card theme-card--${theme.id}${data.settings.theme === theme.id ? ' is-active' : ''}`}
                    onClick={() => actions.setTheme(theme.id)}
                    aria-pressed={data.settings.theme === theme.id}
                  >
                    <span className="theme-preview">
                      <span />
                      <span />
                      <span />
                    </span>
                    <strong>{theme.label}</strong>
                    <small>{theme.note}</small>
                    {data.settings.theme === theme.id ? (
                      <span className="theme-check">
                        <Icon name="check" size={12} />
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-copy">
                <strong>Reading text size</strong>
                <span>Applies to articles and highlight quotes.</span>
              </div>
              <div className="range-wrap">
                <input
                  type="range"
                  min={0.9}
                  max={1.2}
                  step={0.05}
                  value={data.settings.fontScale}
                  onChange={(event) => actions.updateSettings({ fontScale: Number(event.target.value) })}
                  aria-label="Reading text size"
                />
                <span>{Math.round(data.settings.fontScale * 100)}%</span>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-copy">
                <strong>Reduce motion</strong>
                <span>Turn off card and panel animations.</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={data.settings.reduceMotion}
                aria-label="Reduce motion"
                className={`switch${data.settings.reduceMotion ? ' is-on' : ''}`}
                onClick={() => actions.updateSettings({ reduceMotion: !data.settings.reduceMotion })}
              >
                <span />
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Your data</h2>
              <p>Everything lives in the SQLite database on this machine.</p>
            </div>
            <div className="storage-card">
              <div className="storage-copy">
                <span className="storage-icon">
                  <Icon name="chart" size={18} />
                </span>
                <div>
                  <strong>
                    {health
                      ? `${health.documents ?? data.docs.length} documents · ${health.highlights ?? data.highlights.length} highlights`
                      : 'Reading library stats…'}
                  </strong>
                  <span>
                    {data.sources.length} feed{data.sources.length === 1 ? '' : 's'} ·{' '}
                    {(data.docs.reduce((sum, doc) => sum + doc.minutes, 0) / 60).toFixed(1)} hours of reading
                    and listening
                  </span>
                </div>
              </div>
              <button type="button" className="btn btn--soft btn--small" onClick={exportAll}>
                <Icon name="download" size={14} /> Backup now
              </button>
            </div>
            <div className="data-actions">
              <button type="button" className="text-button" onClick={onOpenImport}>
                <Icon name="import" size={15} /> Import or export
              </button>
              <button type="button" className="text-button" onClick={onOpenIntegrations}>
                <Icon name="plug" size={15} /> Manage integrations
              </button>
              <button
                type="button"
                className="text-button text-button--danger"
                onClick={() => setConfirmReset(true)}
              >
                <Icon name="trash" size={15} /> Erase library
              </button>
            </div>
          </section>
        </div>

        <aside className="settings-side">
          <section className="panel panel--compact install-card">
            <span className="install-glyph">
              <Icon name="leaf" size={22} />
            </span>
            <h2>{standalone ? '0x wise is installed' : 'Keep 0x wise close'}</h2>
            <p>
              {standalone
                ? 'You are using the installed app. It opens without a browser bar and works offline.'
                : 'Install it as an app for a quieter window. Your library is served from this machine either way.'}
            </p>
            {standalone ? (
              <span className="install-done">
                <Icon name="check" size={14} /> Running as an app
              </span>
            ) : installPrompt ? (
              <button type="button" className="btn btn--primary" onClick={onInstall}>
                <Icon name="download" size={16} /> Install 0x wise
              </button>
            ) : (
              <p className="install-hint">
                Use your browser menu and choose “Install 0x wise” or “Add to Home Screen”.
              </p>
            )}
          </section>

          <section className="panel panel--compact">
            <h2 className="side-title">About</h2>
            <dl className="detail-list">
              <div>
                <dt>Version</dt>
                <dd>{health?.version ? `${health.version} · local build` : '0.1.0 · local build'}</dd>
              </div>
              <div>
                <dt>Storage</dt>
                <dd>SQLite on this machine</dd>
              </div>
              <div>
                <dt>Account</dt>
                <dd>Single user</dd>
              </div>
            </dl>
            <p className="panel-note">
              0x wise is a self-hosted reading and listening space: a library, a reader, a podcast
              queue, and a review habit in one place.
            </p>
            <button type="button" className="btn btn--ghost btn--small btn--full" onClick={() => void signOut()}>
              <Icon name="logout" size={14} /> Lock &amp; sign out
            </button>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Erase everything?"
        body="This removes every document, highlight, note, reviewed date, feed, and transcription queue entry from this machine. Export a backup first if you might want it later."
        confirmLabel="Erase library"
        danger
        onConfirm={() => {
          actions.resetAll()
          showToast('Library erased')
        }}
      />
    </div>
  )
}
