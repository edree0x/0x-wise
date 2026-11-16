'use client'

import { useEffect, useState } from 'react'
import { App } from '@/dashboard/App'
import { StoreProvider } from '@/dashboard/store'

/**
 * The dashboard shell reads `window.location.hash` and matchMedia on first
 * render, so it only mounts in the browser. A quiet boot state avoids a
 * server/client mismatch and keeps the HTML shell tiny.
 */
export function Dashboard() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="app-boot" role="status" aria-live="polite">
        <img src="/brand-mark.svg" alt="" width="34" height="39" />
        <span>0x wise</span>
      </div>
    )
  }

  return (
    <StoreProvider>
      <App />
    </StoreProvider>
  )
}
