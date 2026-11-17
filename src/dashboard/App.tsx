import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from './store'
import { Icon, type IconName } from './icons'
import { AddDocModal, ToastViewport } from './ui'
import { ReviewPage } from './pages/Review'
import { LibraryPage } from './pages/Library'
import { ReaderPage } from './pages/Reader'
import { HighlightsPage } from './pages/Highlights'
import { NotesPage } from './pages/Notes'
import { ImportExportPage } from './pages/ImportExport'
import { IntegrationsPage } from './pages/Integrations'
import { SettingsPage } from './pages/Settings'
import { ListenPage } from './pages/Listen'
import { PodcastPage } from './pages/Podcast'
import { SourcesPage } from './pages/Sources'
import { DiscoverPage } from './pages/Discover'
import type { ThemeName } from './types'

type Route =
  | { name: 'review' }
  | { name: 'library' }
  | { name: 'reader'; id: string }
  | { name: 'listen' }
  | { name: 'podcast'; id: string }
  | { name: 'discover' }
  | { name: 'highlights' }
  | { name: 'notes' }
  | { name: 'sources' }
  | { name: 'import' }
  | { name: 'integrations' }
  | { name: 'settings' }

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const NAV: { path: string; label: string; icon: IconName; route: Route['name'] }[] = [
  { path: 'review', label: 'Review', icon: 'review', route: 'review' },
  { path: 'library', label: 'Library', icon: 'library', route: 'library' },
  { path: 'listen', label: 'Listen', icon: 'listen', route: 'listen' },
  { path: 'discover', label: 'Discover', icon: 'search', route: 'discover' },
  { path: 'highlights', label: 'Highlights', icon: 'highlighter', route: 'highlights' },
  { path: 'notes', label: 'Notes', icon: 'notes', route: 'notes' },
]

const TOOLS: { path: string; label: string; icon: IconName; route: Route['name'] }[] = [
  { path: 'sources', label: 'Sources', icon: 'rss', route: 'sources' },
  { path: 'import', label: 'Import & export', icon: 'import', route: 'import' },
  { path: 'integrations', label: 'Integrations', icon: 'plug', route: 'integrations' },
  { path: 'settings', label: 'Settings', icon: 'settings', route: 'settings' },
]

const TITLES: Record<Route['name'], string> = {
  review: 'Review',
  library: 'Library',
  reader: 'Reader',
  listen: 'Listen',
  podcast: 'Episode',
  discover: 'Discover',
  highlights: 'Highlights',
  notes: 'Notes',
  sources: 'Sources',
  import: 'Import & export',
  integrations: 'Integrations',
  settings: 'Settings',
}

function parseRoute(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [segment, ...rest] = raw.split('/')
  const id = rest.join('/')
  if (segment === 'library') return { name: 'library' }
  if (segment === 'read' && id) return { name: 'reader', id }
  if (segment === 'listen') return { name: 'listen' }
  if (segment === 'episode' && id) return { name: 'podcast', id }
  if (segment === 'discover') return { name: 'discover' }
  if (segment === 'highlights') return { name: 'highlights' }
  if (segment === 'notes') return { name: 'notes' }
  if (segment === 'sources') return { name: 'sources' }
  if (segment === 'import') return { name: 'import' }
  if (segment === 'integrations') return { name: 'integrations' }
  if (segment === 'settings') return { name: 'settings' }
  return { name: 'review' }
}

function navigate(path: string): void {
  window.location.hash = `#/${path}`
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function App() {
  const { data, actions, toast, dismissToast, showToast } = useStore()
  const [route, setRoute] = useState<Route>(parseRoute)
  const [searchOpen, setSearchOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [standalone, setStandalone] = useState(isStandalone)

  const dueCount = useMemo(
    () => data.highlights.filter((highlight) => new Date(highlight.dueAt).getTime() <= Date.now()).length,
    [data.highlights],
  )

  useEffect(() => {
    if (!window.location.hash) {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/review`)
    }
    const onHash = () => {
      setRoute(parseRoute())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.title = `${TITLES[route.name]} · 0x wise`
  }, [route])

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as InstallPromptEvent)
    }
    const onInstalled = () => {
      setStandalone(true)
      setInstallEvent(null)
      showToast('0x wise installed', 'success')
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [showToast])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const openDoc = useCallback(
    (id: string) => {
      if (!id) return
      const doc = data.docs.find((item) => item.id === id)
      if (doc && (doc.kind === 'podcast' || doc.kind === 'youtube')) {
        navigate(`episode/${id}`)
        return
      }
      navigate(`read/${id}`)
    },
    [data.docs],
  )

  const openSearchDoc = useCallback(
    (id: string) => {
      setSearchOpen(false)
      openDoc(id)
    },
    [openDoc],
  )

  const cycleTheme = () => {
    const order: ThemeName[] = ['light', 'sepia', 'dark']
    const next = order[(order.indexOf(data.settings.theme) + 1) % order.length]
    actions.setTheme(next)
    showToast(`Theme: ${next === 'light' ? 'Paper' : next === 'sepia' ? 'Sepia' : 'Night'}`)
  }

  const themeIcon: IconName = data.settings.theme === 'dark' ? 'moon' : data.settings.theme === 'sepia' ? 'leaf' : 'sun'

  const isActive = (name: Route['name']) =>
    route.name === name || (name === 'listen' && route.name === 'podcast')

  const handleInstall = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') setStandalone(true)
    setInstallEvent(null)
  }

  const page = (() => {
    switch (route.name) {
      case 'library':
        return <LibraryPage onOpenDoc={openDoc} />
      case 'reader':
        return <ReaderPage docId={route.id} onBack={() => navigate('library')} onOpenDoc={openDoc} />
      case 'listen':
        return (
          <ListenPage
            onOpenEpisode={(id) => navigate(`episode/${id}`)}
            onOpenDoc={openDoc}
            onOpenSources={() => navigate('sources')}
          />
        )
      case 'podcast':
        return <PodcastPage docId={route.id} onBack={() => navigate('listen')} onOpenSources={() => navigate('sources')} />
      case 'discover':
        return <DiscoverPage onOpenEpisode={(id) => navigate(`episode/${id}`)} />
      case 'sources':
        return (
          <SourcesPage
            onOpenEpisode={(id) => navigate(`episode/${id}`)}
            onOpenDoc={openDoc}
          />
        )
      case 'highlights':
        return <HighlightsPage onOpenDoc={openDoc} />
      case 'notes':
        return <NotesPage onOpenDoc={openDoc} />
      case 'import':
        return <ImportExportPage onOpenDoc={openDoc} />
      case 'integrations':
        return <IntegrationsPage onOpenImport={() => navigate('import')} />
      case 'settings':
        return (
          <SettingsPage
            onOpenImport={() => navigate('import')}
            onOpenIntegrations={() => navigate('integrations')}
            installPrompt={installEvent ? handleInstall : null}
            onInstall={handleInstall}
            standalone={standalone}
          />
        )
      default:
        return <ReviewPage onOpenDoc={openDoc} />
    }
  })()

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <aside className="sidebar">
        <button type="button" className="sidebar-brand" onClick={() => navigate('review')} aria-label="0x wise home">
          <img src="/brand-mark.svg" alt="" width="26" height="30" />
          <span>
            0x wise<span className="brand-dot">.</span>
          </span>
        </button>

        <nav className="sidebar-nav" aria-label="Main">
          <p className="nav-label">Review</p>
          {NAV.map((item) => (
            <button
              key={item.path}
              type="button"
              className={`nav-item${isActive(item.route) ? ' is-active' : ''}`}
              onClick={() => navigate(item.path)}
              aria-current={isActive(item.route) ? 'page' : undefined}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {item.route === 'review' && dueCount > 0 ? <span className="nav-badge">{dueCount}</span> : null}
            </button>
          ))}

          <p className="nav-label nav-label--spaced">Tools</p>
          {TOOLS.map((item) => (
            <button
              key={item.path}
              type="button"
              className={`nav-item${isActive(item.route) ? ' is-active' : ''}`}
              onClick={() => navigate(item.path)}
              aria-current={isActive(item.route) ? 'page' : undefined}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="streak-tile">
            <span className="streak-flame">
              <Icon name="flame" size={17} />
            </span>
            <div>
              <strong>{data.review.streak} day streak</strong>
              <span>
                {dueCount > 0 ? `${dueCount} due today` : 'All caught up'}
              </span>
            </div>
          </div>
          <div className="streak-tile streak-tile--lang">
            <span className="streak-flame">
              <Icon name="leaf" size={17} />
            </span>
            <div>
              <strong>{data.settings.language === 'ar' ? 'العربية' : 'English'}</strong>
              <button
                type="button"
                className="lang-toggle"
                onClick={() =>
                  actions.updateSettings({ language: data.settings.language === 'ar' ? 'en' : 'ar' })
                }
              >
                {data.settings.language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
              </button>
            </div>
          </div>
          <button type="button" className="profile-button" onClick={() => navigate('settings')}>
            <span className="avatar">{data.settings.displayName.slice(0, 1).toUpperCase()}</span>
            <span className="profile-copy">
              <strong>{data.settings.displayName}</strong>
              <span>{data.settings.email}</span>
            </span>
            <Icon name="settings" size={16} />
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="mobile-brand" onClick={() => navigate('review')} aria-label="0x wise home">
              <img src="/brand-mark.svg" alt="" width="22" height="26" />
              <span>0x wise<span className="brand-dot">.</span></span>
            </button>
            <span className="topbar-crumb">{TITLES[route.name]}</span>
            {route.name === 'review' && dueCount > 0 ? (
              <span className="topbar-due">{dueCount} due</span>
            ) : null}
          </div>
          <div className="topbar-actions">
            <button type="button" className="search-button" onClick={() => setSearchOpen(true)}>
              <Icon name="search" size={17} />
              <span>Search</span>
              <kbd>{navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl K'}</kbd>
            </button>
            <button
              type="button"
              className="icon-button theme-toggle"
              onClick={cycleTheme}
              aria-label="Change theme"
              title="Change theme"
            >
              <Icon name={themeIcon} size={18} />
            </button>
            <button type="button" className="btn btn--primary btn--small add-button" onClick={() => setAddOpen(true)}>
              <Icon name="plus" size={16} />
              <span>Add</span>
            </button>
          </div>
        </header>

        <main id="main-content" className="app-content" key={`${route.name}-${'id' in route ? route.id : ''}`}>
          {page}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Mobile">
        {[NAV[0], NAV[1], NAV[2], NAV[3], TOOLS[3]].map((item) => (
          <button
            key={item.path}
            type="button"
            className={`bottom-item${isActive(item.route) ? ' is-active' : ''}`}
            onClick={() => navigate(item.path)}
            aria-current={isActive(item.route) ? 'page' : undefined}
          >
            <span className="bottom-icon">
              <Icon name={item.icon} size={20} />
              {item.route === 'review' && dueCount > 0 ? <span className="bottom-dot" /> : null}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <AddDocModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(id) => openDoc(id)}
      />

      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onOpenDoc={openSearchDoc}
        onOpenHighlight={openSearchDoc}
      />

      <ToastViewport toast={toast} onDismiss={dismissToast} />
    </div>
  )
}

type SearchResult = {
  id: string
  type: 'doc' | 'highlight' | 'note'
  title: string
  subtitle: string
  docId: string
  cover?: string
}

function SearchOverlay({
  open,
  onClose,
  onOpenDoc,
  onOpenHighlight,
}: {
  open: boolean
  onClose: () => void
  onOpenDoc: (id: string) => void
  onOpenHighlight: (docId: string) => void
}) {
  const { data } = useStore()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40)
    return () => window.clearTimeout(timer)
  }, [open])

  const results = useMemo<SearchResult[]>(() => {
    const term = query.trim().toLowerCase()
    const docs: SearchResult[] = data.docs
      .filter((doc) => !doc.archived)
      .filter(
        (doc) =>
          !term ||
          doc.title.toLowerCase().includes(term) ||
          doc.author.toLowerCase().includes(term) ||
          doc.tags.some((tag) => tag.toLowerCase().includes(term)),
      )
      .slice(0, 5)
      .map((doc) => ({
        id: doc.id,
        type: 'doc',
        title: doc.title,
        subtitle: `${doc.author} · ${doc.category}`,
        docId: doc.id,
        cover: doc.color,
      }))

    const highlights: SearchResult[] = data.highlights
      .filter((highlight) => {
        if (!term) return highlight.favorite
        return (
          highlight.text.toLowerCase().includes(term) ||
          highlight.note.toLowerCase().includes(term) ||
          highlight.tags.some((tag) => tag.toLowerCase().includes(term))
        )
      })
      .slice(0, 6)
      .map((highlight) => {
        const doc = data.docs.find((item) => item.id === highlight.docId)
        return {
          id: highlight.id,
          type: highlight.note ? 'note' : 'highlight',
          title: highlight.text,
          subtitle: highlight.note || doc?.title || 'Highlight',
          docId: highlight.docId,
        }
      })

    return [...docs, ...highlights]
  }, [data, query])

  useEffect(() => {
    setActive((value) => Math.min(value, Math.max(0, results.length - 1)))
  }, [results.length])

  if (!open) return null

  const choose = (result: SearchResult) => {
    onClose()
    if (result.type === 'doc') onOpenDoc(result.docId)
    else onOpenHighlight(result.docId)
  }

  return createPortal(
    <div
      className="search-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="search-panel" role="dialog" aria-modal="true" aria-label="Search 0x wise">
        <div className="search-panel-input">
          <Icon name="search" size={19} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose()
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((value) => Math.min(value + 1, results.length - 1))
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((value) => Math.max(value - 1, 0))
              }
              if (event.key === 'Enter' && results[active]) {
                event.preventDefault()
                choose(results[active])
              }
            }}
            placeholder="Search documents, quotes, notes…"
            aria-label="Search"
          />
          <button type="button" className="search-esc" onClick={onClose}>
            Esc
          </button>
        </div>

        <div className="search-results">
          {results.length === 0 ? (
            <p className="search-empty">No matches for “{query}”. Try a title, a tag, or a phrase.</p>
          ) : (
            <>
              {results.some((result) => result.type === 'doc') ? (
                <p className="search-group-label">Documents</p>
              ) : null}
              {results.map((result, index) => {
                if (result.type !== 'doc' && index > 0 && results[index - 1].type === 'doc') {
                  return (
                    <div key={result.id}>
                      <p className="search-group-label">Highlights &amp; notes</p>
                      <ResultRow
                        result={result}
                        active={index === active}
                        onHover={() => setActive(index)}
                        onChoose={() => choose(result)}
                      />
                    </div>
                  )
                }
                return (
                  <ResultRow
                    key={result.id}
                    result={result}
                    active={index === active}
                    onHover={() => setActive(index)}
                    onChoose={() => choose(result)}
                  />
                )
              })}
            </>
          )}
        </div>

        <div className="search-foot">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> to move
          </span>
          <span>
            <kbd>↵</kbd> to open
          </span>
          <span>{data.docs.length} documents · {data.highlights.length} highlights</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ResultRow({
  result,
  active,
  onHover,
  onChoose,
}: {
  result: SearchResult
  active: boolean
  onHover: () => void
  onChoose: () => void
}) {
  return (
    <button
      type="button"
      className={`search-result${active ? ' is-active' : ''}`}
      onMouseEnter={onHover}
      onClick={onChoose}
    >
      {result.type === 'doc' ? (
        <span className="search-cover" data-color={result.cover ?? 'clay'} />
      ) : (
        <span className={`search-type search-type--${result.type}`}>
          <Icon name={result.type === 'note' ? 'pencil' : 'highlighter'} size={14} />
        </span>
      )}
      <span className="search-result-copy">
        <strong>{result.title}</strong>
        <span>{result.subtitle}</span>
      </span>
      <Icon name="right" size={15} className="search-arrow" />
    </button>
  )
}
