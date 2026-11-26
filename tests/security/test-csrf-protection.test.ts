#!/usr/bin/env node
// Test for CSRF protection (Task 4)

console.log('=== CSRF Protection Tests ===\n')

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Check auth.ts for CSRF cookie and verification
const authContent = readFileSync(path.join(__dirname, '..', '..', 'src/lib/auth.ts'), 'utf-8')

console.log('Checking src/lib/auth.ts:')

const checks = [
  { name: 'CSRF_COOKIE constant exported', pattern: 'export const CSRF_COOKIE' },
  { name: 'generateCsrfToken function', pattern: 'generateCsrfToken' },
  { name: 'login returns csrfToken', pattern: 'csrfToken' },
  { name: 'csrfCookieOptions function', pattern: 'csrfCookieOptions' },
  { name: 'httpOnly: false for CSRF cookie', pattern: 'httpOnly: false' },
  { name: 'verifyCsrfToken function', pattern: 'verifyCsrfToken' },
  { name: 'timingSafeEqual in verifyCsrfToken', pattern: 'timingSafeEqual(Buffer.from(headerToken), Buffer.from(cookieToken))' },
]

for (const check of checks) {
  if (authContent.includes(check.pattern)) {
    console.log(`  ✓ ${check.name}`)
  } else {
    console.log(`  ✗ ${check.name}`)
  }
}

// Check http.ts for withUserAndCsrf
const httpContent = readFileSync(path.join(__dirname, '..', '..', 'src/lib/http.ts'), 'utf-8')

console.log('\nChecking src/lib/http.ts:')
const httpChecks = [
  { name: 'withUserAndCsrf exported', pattern: 'export async function withUserAndCsrf' },
  { name: 'CSRF check skipped for Bearer token', pattern: 'hasBearerToken' },
  { name: 'CSRF check calls verifyCsrfToken', pattern: 'verifyCsrfToken(request, cookieStore)' },
  { name: 'Returns 403 for invalid CSRF', pattern: 'status: 403' },
]

for (const check of httpChecks) {
  if (httpContent.includes(check.pattern)) {
    console.log(`  ✓ ${check.name}`)
  } else {
    console.log(`  ✗ ${check.name}`)
  }
}

// Check routes use withUserAndCsrf
const routes = [
  'src/app/api/actions/route.ts',
  'src/app/api/ingest/route.ts',
  'src/app/api/upload/route.ts',
  'src/app/api/tokens/route.ts',
]

console.log('\nChecking routes use withUserAndCsrf:')
for (const route of routes) {
  const content = readFileSync(path.join(__dirname, '..', '..', route), 'utf-8')
  if (content.includes('withUserAndCsrf')) {
    console.log(`  ✓ ${route}`)
  } else {
    console.log(`  ✗ ${route}`)
  }
}

// Check clip route exempts API tokens
const clipContent = readFileSync(path.join(__dirname, '..', '..', 'src/app/api/clip/route.ts'), 'utf-8')
console.log('\nChecking src/app/api/clip/route.ts:')
if (clipContent.includes('usesApiToken') && clipContent.includes('withUser') && clipContent.includes('withUserAndCsrf')) {
  console.log('  ✓ API token exemption logic present')
} else {
  console.log('  ✗ API token exemption logic missing')
}

// Check store.tsx sends CSRF header
const storeContent = readFileSync(path.join(__dirname, '..', '..', 'src/dashboard/store.tsx'), 'utf-8')
console.log('\nChecking src/dashboard/store.tsx:')
if (storeContent.includes('oxw_csrf') && storeContent.includes('x-csrf-token')) {
  console.log('  ✓ CSRF token header sent from client')
} else {
  console.log('  ✗ CSRF token header not sent from client')
}

// Check LoginForm.tsx sends CSRF header
const loginContent = readFileSync(path.join(__dirname, '..', '..', 'src/app/login/LoginForm.tsx'), 'utf-8')
console.log('\nChecking src/app/login/LoginForm.tsx:')
if (loginContent.includes('oxw_csrf') && loginContent.includes('x-csrf-token')) {
  console.log('  ✓ Login form sends CSRF token')
} else {
  console.log('  ✗ Login form missing CSRF token')
}

// Check login route sets CSRF cookie
const loginRouteContent = readFileSync(path.join(__dirname, '..', '..', 'src/app/api/auth/login/route.ts'), 'utf-8')
console.log('\nChecking src/app/api/auth/login/route.ts:')
if (loginRouteContent.includes('CSRF_COOKIE') && loginRouteContent.includes('csrfCookieOptions')) {
  console.log('  ✓ Login route sets CSRF cookie')
} else {
  console.log('  ✗ Login route missing CSRF cookie')
}

console.log('\n=== All checks completed ===')