#!/usr/bin/env node
// Test for resetAll confirmation requirement (Task 5)

console.log('=== resetAll Confirmation Tests ===\n')

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Check actions.ts for confirm check
const actionsContent = readFileSync(path.join(__dirname, '..', '..', 'src/lib/actions.ts'), 'utf-8')

console.log('Checking src/lib/actions.ts:')

const checks = [
  { name: 'confirm check in resetAll', pattern: 'confirm !== \'RESET\'' },
  { name: 'Error returned if confirm missing', pattern: 'Confirm with payload.confirm = "RESET"' },
]

for (const check of checks) {
  if (actionsContent.includes(check.pattern)) {
    console.log(`  ✓ ${check.name}`)
  } else {
    console.log(`  ✗ ${check.name}`)
  }
}

// Check Settings.tsx uses ConfirmDialog
const settingsContent = readFileSync(path.join(__dirname, '..', '..', 'src/dashboard/pages/Settings.tsx'), 'utf-8')

console.log('\nChecking src/dashboard/pages/Settings.tsx:')
const settingsChecks = [
  { name: 'ConfirmDialog imported', pattern: 'ConfirmDialog' },
  { name: 'confirmReset state', pattern: 'confirmReset' },
  { name: 'onClick sets confirmReset true', pattern: 'setConfirmReset(true)' },
  { name: 'ConfirmDialog rendered with confirmReset', pattern: 'open={confirmReset}' },
  { name: 'ConfirmDialog onConfirm calls resetAll', pattern: 'actions.resetAll()' },
]

for (const check of settingsChecks) {
  if (settingsContent.includes(check.pattern)) {
    console.log(`  ✓ ${check.name}`)
  } else {
    console.log(`  ✗ ${check.name}`)
  }
}

// Check ConfirmDialog component exists
const uiContent = readFileSync(path.join(__dirname, '..', '..', 'src/dashboard/ui.tsx'), 'utf-8')
console.log('\nChecking src/dashboard/ui.tsx (ConfirmDialog):')
if (uiContent.includes('export function ConfirmDialog')) {
  console.log('  ✓ ConfirmDialog component exists')
} else {
  console.log('  ✗ ConfirmDialog component missing')
}

console.log('\n=== All checks completed ===')