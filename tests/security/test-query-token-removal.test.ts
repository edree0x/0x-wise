#!/usr/bin/env node
// Test for query parameter token removal (Task 3)

console.log('=== Query Token Removal Tests ===\n')

// These tests verify that the code no longer reads tokens from query params
// by inspecting the source code

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const routes = [
  'src/app/api/clip/route.ts',
  'src/app/api/cron/poll/route.ts',
  'src/app/api/v2/books/route.ts',
  'src/app/api/v2/export/route.ts',
  'src/app/api/v2/highlights/route.ts',
]

const forbiddenPatterns = [
  'searchParams.get(\'token\')',
  'searchParams.get("token")',
  'searchParams.get(\'access_token\')',
  'searchParams.get("access_token")',
]

let allPassed = true

for (const route of routes) {
  const filePath = path.join(__dirname, '..', '..', route)
  const content = readFileSync(filePath, 'utf-8')

  console.log(`\nChecking ${route}:`)
  let routePassed = true

  for (const pattern of forbiddenPatterns) {
    if (content.includes(pattern)) {
      console.log(`  ✗ FAILED: Found forbidden pattern "${pattern}"`)
      routePassed = false
      allPassed = false
    }
  }

  // Check that header-based auth is used (bearerToken, x-api-token, x-cron-token, or authorization)
  const hasHeaderAuth = content.includes('bearerToken') || content.includes('x-api-token') || content.includes('x-cron-token') || content.includes('authorization')
  if (!hasHeaderAuth) {
    console.log(`  ✗ FAILED: No header-based auth found`)
    routePassed = false
    allPassed = false
  }

  if (routePassed) {
    console.log(`  ✓ PASSED: No query param tokens, header auth present`)
  }
}

if (allPassed) {
  console.log('\n=== All tests PASSED ===')
} else {
  console.log('\n=== Some tests FAILED ===')
  process.exit(1)
}