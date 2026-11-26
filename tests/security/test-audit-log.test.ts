#!/usr/bin/env node
// Test for audit log implementation (Task 6)

console.log('=== Audit Log Tests ===\n')

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Check db.ts for audit_log table and auditLog function
const dbContent = readFileSync(path.join(__dirname, '..', '..', 'src/lib/db.ts'), 'utf-8')

console.log('Checking src/lib/db.ts:')

const dbChecks = [
  { name: 'audit_log table in SCHEMA', pattern: 'CREATE TABLE IF NOT EXISTS audit_log' },
  { name: 'audit_log columns', pattern: 'event_type TEXT NOT NULL' },
  { name: 'audit_log user_id', pattern: 'user_id TEXT NOT NULL' },
  { name: 'audit_log details', pattern: 'details TEXT' },
  { name: 'audit_log created_at', pattern: 'created_at TEXT NOT NULL' },
  { name: 'audit_log index', pattern: 'idx_audit_log_created' },
  { name: 'auditLog function exported', pattern: 'export function auditLog' },
  { name: 'auditLog trims to 500 rows', pattern: 'LIMIT 500' },
]

for (const check of dbChecks) {
  if (dbContent.includes(check.pattern)) {
    console.log(`  ✓ ${check.name}`)
  } else {
    console.log(`  ✗ ${check.name}`)
  }
}

// Check actions.ts calls auditLog for destructive actions
const actionsContent = readFileSync(path.join(__dirname, '..', '..', 'src/lib/actions.ts'), 'utf-8')

console.log('\nChecking src/lib/actions.ts for auditLog calls:')
const actionChecks = [
  { name: 'deleteHighlight auditLog', pattern: 'auditLog(\'deleteHighlight\'' },
  { name: 'deleteDoc auditLog', pattern: 'auditLog(\'deleteDoc\'' },
  { name: 'resetAll auditLog', pattern: 'auditLog(\'resetAll\'' },
  { name: 'deleteSource auditLog', pattern: 'auditLog(\'deleteSource\'' },
]

for (const check of actionChecks) {
  if (actionsContent.includes(check.pattern)) {
    console.log(`  ✓ ${check.name}`)
  } else {
    console.log(`  ✗ ${check.name}`)
  }
}

// Check auth.ts calls auditLog for security events
const authContent = readFileSync(path.join(__dirname, '..', '..', 'src/lib/auth.ts'), 'utf-8')

console.log('\nChecking src/lib/auth.ts for auditLog calls:')
const authChecks = [
  { name: 'login auditLog', pattern: 'auditLog(\'login\'' },
  { name: 'failedLogin auditLog', pattern: 'auditLog(\'failedLogin\'' },
  { name: 'tokenCreate auditLog', pattern: 'auditLog(\'tokenCreate\'' },
  { name: 'tokenRevoke auditLog', pattern: 'auditLog(\'tokenRevoke\'' },
]

for (const check of authChecks) {
  if (authContent.includes(check.pattern)) {
    console.log(`  ✓ ${check.name}`)
  } else {
    console.log(`  ✗ ${check.name}`)
  }
}

console.log('\n=== All checks completed ===')