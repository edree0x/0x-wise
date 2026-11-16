/* 0x wise Clipper — options page. */

const DEFAULT_BASE = 'http://localhost:3210'
const BASE_KEY = 'oxw.baseUrl'
const TOKEN_KEY = 'oxw.token'

const $ = (id) => document.getElementById(id)

function normalizeBase(value) {
  let base = (value || '').trim() || DEFAULT_BASE
  if (!/^https?:\/\//i.test(base)) base = `http://${base}`
  return base.replace(/\/+$/, '')
}

function originPattern(base) {
  try {
    return `${new URL(base).origin}/*`
  } catch {
    return ''
  }
}

function showStatus(message, kind = 'info') {
  const node = $('status')
  node.textContent = message
  node.dataset.kind = kind
  node.hidden = false
}

async function load() {
  const stored = await chrome.storage.local.get([BASE_KEY, TOKEN_KEY])
  $('base-url').value = normalizeBase(stored[BASE_KEY])
  $('api-token').value = (stored[TOKEN_KEY] || '').trim()
}

async function grant(base) {
  const pattern = originPattern(base)
  if (!pattern) throw new Error('That address is not a valid URL.')
  const already = await chrome.permissions.contains({ origins: [pattern] })
  if (already) return true
  return chrome.permissions.request({ origins: [pattern] })
}

async function save({ quiet } = {}) {
  const base = normalizeBase($('base-url').value)
  const token = $('api-token').value.trim()
  $('base-url').value = base

  if (!originPattern(base)) {
    showStatus('Enter a full address, for example http://localhost:3210.', 'error')
    return false
  }

  let granted = false
  try {
    granted = await grant(base)
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not request access.', 'error')
    return false
  }

  await chrome.storage.local.set({ [BASE_KEY]: base, [TOKEN_KEY]: token })
  await chrome.storage.local.remove('oxw.lastError')

  if (!granted) {
    showStatus('Settings saved, but the browser did not allow access to that address.', 'warn')
    return false
  }
  if (!token) {
    showStatus('Address saved. Add an API token to start clipping.', 'warn')
    return false
  }
  if (!quiet) showStatus('Connection saved.', 'ok')
  return true
}

async function test() {
  const base = normalizeBase($('base-url').value)
  const token = $('api-token').value.trim()
  if (!token) {
    showStatus('Paste an API token first.', 'warn')
    return
  }
  try {
    const granted = await chrome.permissions.contains({ origins: [originPattern(base)] })
    if (!granted) {
      showStatus(`Save the connection first to allow access to ${base}.`, 'warn')
      return
    }
    const health = await fetch(`${base}/api/health`, { cache: 'no-store' })
    const app = await health.json().catch(() => ({}))
    if (!health.ok || app.app !== '0x wise') {
      showStatus(`${base} answered, but it does not look like 0x wise.`, 'error')
      return
    }
    const response = await fetch(`${base}/api/v2/highlights?page_size=1`, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (response.status === 401) {
      showStatus('The server is reachable, but that token was rejected.', 'error')
      return
    }
    if (!response.ok) {
      showStatus(`The server answered with ${response.status}.`, 'error')
      return
    }
    const body = await response.json().catch(() => ({}))
    const count = typeof body.count === 'number' ? body.count : null
    showStatus(
      count === null
        ? 'Connected. The token works.'
        : `Connected. Token works · ${count} highlight${count === 1 ? '' : 's'} visible.`,
      'ok',
    )
  } catch {
    showStatus(`Could not reach ${base}. Is the instance running?`, 'error')
  }
}

document.addEventListener('DOMContentLoaded', () => {
  void load()

  $('settings-form').addEventListener('submit', (event) => {
    event.preventDefault()
    void save()
  })

  $('test').addEventListener('click', () => {
    void test()
  })

  $('toggle-token').addEventListener('click', () => {
    const input = $('api-token')
    const showing = input.type === 'text'
    input.type = showing ? 'password' : 'text'
    $('toggle-token').textContent = showing ? 'Show' : 'Hide'
  })

  $('base-url').addEventListener('change', () => {
    $('base-url').value = normalizeBase($('base-url').value)
  })
})
