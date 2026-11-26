#!/usr/bin/env node
// Test for SSRF redirect TOCTOU fix (Task 7)

console.log('=== SSRF Redirect TOCTOU Tests ===\n')

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const extractContent = readFileSync(path.join(__dirname, '..', '..', 'src/lib/extract.ts'), 'utf-8')

console.log('Checking src/lib/extract.ts:')

const checks = [
  { name: 'fetchWithRedirectValidation function', pattern: 'async function fetchWithRedirectValidation' },
  { name: 'redirect: manual', pattern: "redirect: 'manual'" },
  { name: 'assertPublicUrl called on each redirect', pattern: 'assertPublicUrl(redirectUrl' },
  { name: 'max 3 redirects limit', pattern: 'maxRedirects = 3' },
  { name: 'redirectCount < maxRedirects check', pattern: 'redirectCount < maxRedirects' },
  { name: '25s timeout preserved', pattern: '25_000' },
  { name: 'extractUrl uses fetchWithRedirectValidation', pattern: 'await fetchWithRedirectValidation(input)' },
  { name: 'finalUrl from response', pattern: 'response.url' },
  { name: 'Location header parsing with base', pattern: 'new URL(location, currentUrl)' },
  { name: 'Error on blocked redirect target', pattern: 'Redirect target blocked by SSRF protection' },
]

for (const check of checks) {
  if (extractContent.includes(check.pattern)) {
    console.log(`  ✓ ${check.name}`)
  } else {
    console.log(`  ✗ ${check.name}`)
  }
}

// Check that the old redirect: 'follow' is gone
if (extractContent.includes("redirect: 'follow'")) {
  console.log('\n  ✗ Old redirect: follow still present (should be manual)')
} else {
  console.log('\n  ✓ Old redirect: follow removed')
}

console.log('\n=== All checks completed ===')