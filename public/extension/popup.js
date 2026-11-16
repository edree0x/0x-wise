/* 0x wise Clipper — popup behaviour. */

const DEFAULT_BASE = 'http://localhost:3210'
const BASE_KEY = 'oxw.baseUrl'
const TOKEN_KEY = 'oxw.token'

const state = {
  base: DEFAULT_BASE,
  token: '',
  title: '',
  url: '',
  selection: '',
  readable: false,
}

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

function clearStatus() {
  $('status').hidden = true
}

function setPreview(text) {
  const preview = $('selection-preview')
  const empty = $('selection-empty')
  if (text) {
    preview.textContent = text
    preview.hidden = false
    empty.hidden = true
  } else {
    preview.hidden = true
    empty.hidden = false
  }
}

async function readActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab || !tab.id) return
  state.title = tab.title || ''
  state.url = tab.url || ''
  $('page-title').textContent = state.title || 'Untitled page'
  $('page-url').textContent = state.url || ''

  if (!/^https?:/i.test(state.url)) {
    showStatus('This browser page cannot be clipped. Open a normal web page first.', 'warn')
    return
  }

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() ?? '',
    })
    state.selection = (result?.result || '').replace(/\s+/g, ' ').trim()
    state.readable = true
    setPreview(state.selection)
    $('clip-selection').disabled = !state.selection
    if (!state.selection) {
      showStatus('No text selected — clip the page as a bookmark, or highlight first.', 'info')
    }
  } catch {
    showStatus('The page blocked the clipper. Try again after it finishes loading.', 'warn')
  }
}

async function permissionFor(base) {
  const pattern = originPattern(base)
  if (!pattern) return false
  const granted = await chrome.permissions.contains({ origins: [pattern] })
  if (granted) return true
  return chrome.permissions.request({ origins: [pattern] })
}

async function openClip(text) {
  const note = $('note').value.trim()
  if (!state.readable) {
    showStatus('Open a normal web page before clipping.', 'warn')
    return
  }
  if (!state.token) {
    showStatus('Add an API token first. Opening clipper settings…', 'warn')
    chrome.runtime.openOptionsPage()
    return
  }

  const base = normalizeBase(state.base)
  let granted = false
  try {
    granted = await permissionFor(base)
  } catch {
    granted = false
  }
  if (!granted) {
    showStatus(`Allow access to ${base} to clip pages.`, 'warn')
    return
  }

  clearStatus()
  showStatus('Sending to 0x wise…', 'info')
  try {
    const response = await fetch(`${base}/api/clip`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({
        url: state.url,
        title: state.title || state.url,
        text: text.trim(),
        note,
      }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      showStatus(body.error || `Clip failed (${response.status})`, 'warn')
      return
    }
    showStatus(body.highlightId ? 'Clipped and highlighted.' : 'Page saved to your library.', 'ok')
    window.setTimeout(() => window.close(), 700)
  } catch {
    showStatus('Could not reach 0x wise. Check the address in clipper settings.', 'warn')
  }
}

async function init() {
  const stored = await chrome.storage.local.get([BASE_KEY, TOKEN_KEY, 'oxw.lastError'])
  state.base = normalizeBase(stored[BASE_KEY])
  state.token = (stored[TOKEN_KEY] || '').trim()

  if (stored['oxw.lastError']) {
    showStatus(stored['oxw.lastError'], 'warn')
    await chrome.storage.local.remove('oxw.lastError')
  } else if (!state.token) {
    showStatus('No API token yet. Open clipper settings to connect.', 'warn')
  }

  const connection = $('connection')
  connection.textContent = state.token
    ? `Connected to ${state.base}`
    : `Not connected · ${state.base}`
  connection.dataset.kind = state.token ? 'ok' : 'warn'
  connection.hidden = false

  await readActiveTab()

  $('clip-selection').addEventListener('click', () => {
    const text = state.selection || ''
    if (!text) {
      showStatus('Select some text first.', 'warn')
      return
    }
    void openClip(text)
  })

  $('clip-page').addEventListener('click', () => {
    void openClip('')
  })

  $('settings-toggle').addEventListener('click', () => {
    chrome.runtime.openOptionsPage()
    window.close()
  })

  $('open-library').addEventListener('click', async () => {
    try {
      const granted = await permissionFor(state.base)
      if (granted) await chrome.tabs.create({ url: `${state.base}/` })
      else showStatus(`Allow access to ${state.base} first.`, 'warn')
    } catch {
      showStatus('That address is not valid.', 'warn')
    }
  })
}

document.addEventListener('DOMContentLoaded', () => {
  void init()
})
