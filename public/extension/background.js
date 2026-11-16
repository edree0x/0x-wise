/* 0x wise Clipper — background service worker.
 *
 * Context-menu clips POST straight to the instance's /api/clip endpoint with
 * a device token, so nothing is ever encoded into a URL or a page the host
 * app has to guess at.
 */

const DEFAULT_BASE = 'http://localhost:3210'
const BASE_KEY = 'oxw.baseUrl'
const TOKEN_KEY = 'oxw.token'
const ERROR_KEY = 'oxw.lastError'

const MENU_SELECTION = 'oxw-clip-selection'
const MENU_PAGE = 'oxw-clip-page'

function normalizeBase(value) {
  let base = (value || '').trim() || DEFAULT_BASE
  if (!/^https?:\/\//i.test(base)) base = `http://${base}`
  return base.replace(/\/+$/, '')
}

async function readSettings() {
  const stored = await chrome.storage.local.get([BASE_KEY, TOKEN_KEY])
  return {
    base: normalizeBase(stored[BASE_KEY]),
    token: (stored[TOKEN_KEY] || '').trim(),
  }
}

async function flashBadge(text, color) {
  try {
    await chrome.action.setBadgeBackgroundColor({ color })
    await chrome.action.setBadgeText({ text })
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2600)
  } catch {
    // The action badge is cosmetic; clipping already succeeded or failed.
  }
}

async function hasHostPermission(base) {
  try {
    const origin = `${new URL(base).origin}/*`
    return await chrome.permissions.contains({ origins: [origin] })
  } catch {
    return false
  }
}

async function clip(payload) {
  const { base, token } = await readSettings()
  if (!token) {
    await chrome.storage.local.set({ [ERROR_KEY]: 'Add an API token in the clipper options.' })
    await chrome.runtime.openOptionsPage()
    return
  }
  if (!(await hasHostPermission(base))) {
    await chrome.storage.local.set({
      [ERROR_KEY]: `Allow access to ${base} in the clipper options, then try again.`,
    })
    await chrome.runtime.openOptionsPage()
    return
  }

  try {
    const response = await fetch(`${base}/api/clip`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = body.error || `Clip failed (${response.status})`
      await chrome.storage.local.set({ [ERROR_KEY]: message })
      await flashBadge('!', '#a4462f')
      return
    }
    await chrome.storage.local.remove(ERROR_KEY)
    await flashBadge('✓', '#4f7a52')
  } catch (error) {
    await chrome.storage.local.set({
      [ERROR_KEY]: error instanceof Error ? error.message : 'Could not reach 0x wise.',
    })
    await flashBadge('!', '#a4462f')
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_SELECTION,
      title: 'Clip selection to 0x wise',
      contexts: ['selection'],
    })
    chrome.contextMenus.create({
      id: MENU_PAGE,
      title: 'Clip page to 0x wise',
      contexts: ['page'],
    })
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_SELECTION && info.menuItemId !== MENU_PAGE) return
  const url = info.pageUrl || tab?.url || ''
  if (!/^https?:/i.test(url)) return
  const text = info.menuItemId === MENU_SELECTION ? (info.selectionText || '').trim() : ''
  void clip({
    url,
    title: tab?.title || url,
    text,
  })
})

chrome.action.onClicked.addListener(() => {
  // A popup is configured, so this is only a fallback.
  void chrome.runtime.openOptionsPage()
})
