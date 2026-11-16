import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Icon, type IconName } from '../icons'
import { integrationMeta } from '../data'
import type { IntegrationId } from '../types'
import { relativeTime } from '../utils'

const ICONS: Record<IntegrationId, IconName> = {
  obsidian: 'sparkle',
  notion: 'notes',
  logseq: 'list',
  csv: 'download',
  rss: 'sync',
  webhook: 'plug',
  extension: 'grid',
  api: 'lock',
  readwise: 'book',
}

const CONFIG_LABEL: Partial<Record<IntegrationId, { label: string; placeholder: string }>> = {
  obsidian: { label: 'Vault folder', placeholder: '/home/you/Vault/Reading' },
  notion: { label: 'Database ID', placeholder: 'Paste the database ID' },
  logseq: { label: 'Graph folder', placeholder: '/home/you/notes/reading' },
  rss: { label: 'Feed URL', placeholder: 'https://example.com/feed.xml' },
  webhook: { label: 'Endpoint URL', placeholder: 'http://localhost:8080/highlights' },
  readwise: { label: 'Access token', placeholder: 'Paste your Readwise access token' },
}

type ApiToken = { id: string; name: string; createdAt: string; lastUsedAt: string | null }

export function IntegrationsPage({ onOpenImport }: { onOpenImport: () => void }) {
  const { data, actions, showToast } = useStore()
  const [showExtension, setShowExtension] = useState(false)
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [revealed, setRevealed] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch('/api/tokens', { cache: 'no-store' })
        if (!response.ok) return
        const body = (await response.json()) as { tokens?: ApiToken[] }
        if (!cancelled) setTokens(body.tokens ?? [])
      } catch {
        // Tokens are optional; the rest of the page still works.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const generateToken = async () => {
    setBusy(true)
    try {
      const response = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Browser extension' }),
      })
      const body = (await response.json()) as { token?: string; tokens?: ApiToken[]; error?: string }
      if (!response.ok || !body.token) {
        showToast(body.error ?? 'Could not create a token', 'error')
        return
      }
      setRevealed(body.token)
      setTokens(body.tokens ?? tokens)
      actions.updateIntegration('api', { connected: true, lastSync: new Date().toISOString() })
      showToast('New API token created. Copy it now — it is only shown once.', 'success')
    } catch {
      showToast('Cannot reach the server', 'error')
    } finally {
      setBusy(false)
    }
  }

  const revokeToken = async (id: string) => {
    try {
      const response = await fetch(`/api/tokens?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const body = (await response.json()) as { tokens?: ApiToken[] }
      setTokens(body.tokens ?? tokens.filter((token) => token.id !== id))
      if (revealed && !tokens.some((token) => token.id !== id && token.id === id)) setRevealed('')
      showToast('Token revoked')
    } catch {
      showToast('Could not revoke that token', 'error')
    }
  }

  const copyToken = async () => {
    if (!revealed) {
      void generateToken()
      return
    }
    try {
      await navigator.clipboard.writeText(revealed)
      showToast('Token copied to clipboard', 'success')
    } catch {
      showToast('Copy is unavailable. Select the token manually.', 'error')
    }
  }

  const exportFormat = (format: 'csv' | 'markdown' | 'obsidian' | 'logseq') => {
    if (format === 'csv' || format === 'markdown') {
      const anchor = document.createElement('a')
      anchor.href = `/api/export?format=${format}`
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      showToast(`Exported ${format === 'csv' ? 'highlights CSV' : 'library Markdown'}`, 'success')
      return
    }
    const dir = data.integrations[format]?.config?.trim()
    if (!dir) {
      showToast('Set the folder path first', 'error')
      return
    }
    void (async () => {
      try {
        const response = await fetch(
          `/api/export?format=${format}&dir=${encodeURIComponent(dir)}`,
          { method: 'GET' },
        )
        const body = (await response.json()) as { error?: string; files?: number }
        if (!response.ok) {
          showToast(body.error ?? 'Could not write the vault', 'error')
          return
        }
        actions.syncIntegration(format)
        showToast(`Wrote ${body.files ?? 0} files to ${dir}`, 'success')
      } catch {
        showToast('Cannot reach the server', 'error')
      }
    })()
  }

  const sync = (id: IntegrationId, name: string) => {
    if (id === 'obsidian' || id === 'logseq' || id === 'csv') {
      exportFormat(id)
      return
    }
    showToast(`${name} sync is not implemented yet`, 'error')
  }

  return (
    <div className="page integrations-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Tools</p>
          <h1>Integrations</h1>
          <p className="page-sub">
            Connect the places you already write. Connectors run on this machine and write only where
            you point them.
          </p>
        </div>
        <div className="head-actions">
          <span className="local-badge">
            <Icon name="lock" size={14} /> Self-hosted
          </span>
        </div>
      </header>

      <div className="privacy-banner">
        <span className="privacy-icon">
          <Icon name="leaf" size={19} />
        </span>
        <div>
          <strong>Your library is the source of truth.</strong>
          <p>
            0x wise has no account server. Exports write to folders and files you control, and the
            browser extension posts clips to your own API with a token you generate here.
          </p>
        </div>
      </div>

      <div className="integration-grid">
        {integrationMeta.map((meta) => {
          const state = data.integrations[meta.id]
          const config = CONFIG_LABEL[meta.id]
          const isExtension = meta.id === 'extension'
          const isExport = meta.id === 'csv'
          const isApi = meta.id === 'api'
          const isReadwiseImport = meta.id === 'readwise'
          return (
            <article key={meta.id} className={`integration-card${state.connected ? ' is-connected' : ''}`}>
              <header className="integration-head">
                <span className={`integration-icon integration-icon--${meta.id}`}>
                  <Icon name={ICONS[meta.id]} size={20} />
                </span>
                <div>
                  <h2>{meta.name}</h2>
                  <span className="integration-kind">{meta.kind}</span>
                </div>
                <span className={`status-pill${state.connected ? ' is-on' : ''}`}>
                  <span />
                  {state.connected ? 'Connected' : 'Off'}
                </span>
              </header>

              <p className="integration-desc">{meta.description}</p>

              {config && !isApi ? (
                <label className="field-label field-label--tight">
                  <span>{config.label}</span>
                  <input
                    className="text-input"
                    value={state.config}
                    placeholder={config.placeholder}
                    onChange={(event) =>
                      actions.updateIntegration(meta.id, { config: event.target.value })
                    }
                  />
                </label>
              ) : null}

              {isApi ? (
                <div className="token-block">
                  <div className="token-row">
                    <code>{revealed || (tokens[0] ? tokens[0].name : 'No token yet')}</code>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => void copyToken()}>
                      <Icon name="copy" size={14} /> {revealed ? 'Copy' : 'Generate'}
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      disabled={busy}
                      onClick={() => void generateToken()}
                      aria-label="Generate a new token"
                      title="Generate a new token"
                    >
                      <Icon name="sync" size={15} />
                    </button>
                  </div>
                  {revealed ? (
                    <p className="token-note">
                      Copy this now. Only its hash is stored, so it cannot be shown again.
                    </p>
                  ) : null}
                  {tokens.length ? (
                    <ul className="token-list">
                      {tokens.map((token) => (
                        <li key={token.id}>
                          <span>
                            <strong>{token.name}</strong>
                            <small>
                              created {relativeTime(token.createdAt)}
                              {token.lastUsedAt ? ` · last used ${relativeTime(token.lastUsedAt)}` : ''}
                            </small>
                          </span>
                          <button
                            type="button"
                            className="icon-button icon-button--danger"
                            onClick={() => void revokeToken(token.id)}
                            title="Revoke token"
                            aria-label={`Revoke ${token.name}`}
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="token-note">
                    Endpoints: <code>GET /api/v2/highlights</code>, <code>GET /api/v2/books</code>,{' '}
                    <code>POST /api/clip</code>. Send <code>Authorization: Bearer &lt;token&gt;</code>.
                  </p>
                </div>
              ) : null}

              {isExtension ? (
                <div className="extension-block">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setShowExtension((value) => !value)}
                    aria-expanded={showExtension}
                  >
                    <Icon name={showExtension ? 'up' : 'down'} size={14} /> How to install
                  </button>
                  {showExtension ? (
                    <ol className="install-steps">
                      <li>Open your browser's extension page and turn on Developer mode.</li>
                      <li>Choose “Load unpacked” and select <code>public/extension</code>.</li>
                      <li>Open the extension options and paste your API token from above.</li>
                      <li>Pin 0x wise, then clip a page or a selection at any time.</li>
                    </ol>
                  ) : null}
                  <a className="text-button" href="/extension/README.txt" target="_blank" rel="noreferrer">
                    <Icon name="external" size={14} /> Read the install guide
                  </a>
                </div>
              ) : null}

              <footer className="integration-foot">
                <span className="integration-sync">
                  {state.connected
                    ? `Last sync ${relativeTime(state.lastSync).toLowerCase()}`
                    : 'Not connected'}
                </span>
                <div className="integration-actions">
                  {isExport ? (
                    <button type="button" className="btn btn--soft btn--small" onClick={() => exportFormat('csv')}>
                      <Icon name="download" size={14} /> Export
                    </button>
                  ) : isReadwiseImport ? (
                    <button type="button" className="btn btn--soft btn--small" onClick={onOpenImport}>
                      <Icon name="import" size={14} /> Import CSV
                    </button>
                  ) : isApi ? (
                    <span className="integration-sync">Token auth</span>
                  ) : (
                    <>
                      {state.connected && !isExtension ? (
                        <button
                          type="button"
                          className="btn btn--ghost btn--small"
                          onClick={() => sync(meta.id, meta.name)}
                        >
                          <Icon name="sync" size={14} /> Sync now
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={`btn btn--small ${state.connected ? 'btn--ghost' : 'btn--primary'}`}
                        onClick={() => {
                          actions.toggleIntegration(meta.id)
                          showToast(
                            state.connected ? `${meta.name} disconnected` : `${meta.name} connected`,
                            state.connected ? 'default' : 'success',
                          )
                        }}
                      >
                        {state.connected ? 'Disconnect' : 'Connect'}
                      </button>
                    </>
                  )}
                </div>
              </footer>
            </article>
          )
        })}
      </div>

      <section className="panel integration-note">
        <div className="panel-head">
          <h2>What is real today</h2>
          <p>
            Markdown, CSV, Obsidian, Logseq, the Readwise-compatible API, RSS polling and the browser
            clipper are wired up. Notion and generic webhooks are placeholders — the switch stores a
            setting but nothing is sent anywhere yet.
          </p>
        </div>
      </section>
    </div>
  )
}
