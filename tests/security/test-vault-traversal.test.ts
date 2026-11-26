#!/usr/bin/env node
// Test for vault export path traversal fix (Task 1)

import { writeObsidianVault } from '@/lib/export'
import { rmSync, mkdirSync, writeFileSync, existsSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TEST_ROOT = path.join(__dirname, 'test-vault-output')
const VAULT_ROOT = path.join(TEST_ROOT, 'allowed-vault')

async function runTests() {
  // Setup test environment
  mkdirSync(TEST_ROOT, { recursive: true })
  mkdirSync(VAULT_ROOT, { recursive: true })

  // Mock environment
  process.env.OXW_VAULT_ROOT = VAULT_ROOT

  console.log('=== Vault Path Traversal Tests ===\n')

  // Test 1: Allowed path under vault root
  try {
    rmSync(path.join(VAULT_ROOT, 'test1'), { recursive: true, force: true })
    const result = writeObsidianVault(path.join(VAULT_ROOT, 'test1'))
    console.log('✓ Test 1 PASSED: Allowed subdirectory works')
    console.log(`  Created ${result.files} files at ${result.dir}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log('✗ Test 1 FAILED: Allowed subdirectory should work')
    console.log(`  Error: ${msg}`)
  }

  // Test 2: Traversal attempt with ..
  try {
    rmSync(path.join(TEST_ROOT, 'escape'), { recursive: true, force: true })
    writeObsidianVault(path.join(VAULT_ROOT, '..', 'escape'))
    console.log('✗ Test 2 FAILED: Path traversal with .. should be rejected')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log('✓ Test 2 PASSED: Path traversal with .. rejected')
    console.log(`  Error: ${msg}`)
  }

  // Test 3: Absolute path outside allowed root
  try {
    const outsidePath = path.join(TEST_ROOT, 'outside')
    rmSync(outsidePath, { recursive: true, force: true })
    writeObsidianVault(outsidePath)
    console.log('✗ Test 3 FAILED: Absolute path outside allowed root should be rejected')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log('✓ Test 3 PASSED: Absolute path outside allowed root rejected')
    console.log(`  Error: ${msg}`)
  }

  // Test 4: Symlink escape (if symlinks work)
  try {
    const symlinkTarget = path.join(TEST_ROOT, 'symlink-target')
    const symlinkPath = path.join(VAULT_ROOT, 'symlink-escape')
    rmSync(symlinkTarget, { recursive: true, force: true })
    rmSync(symlinkPath, { recursive: true, force: true })
    mkdirSync(symlinkTarget, { recursive: true })

    // Try to create symlink - may fail on some systems
    try {
      symlinkSync(symlinkTarget, symlinkPath, 'dir')
      writeObsidianVault(symlinkPath)
      console.log('✗ Test 4 FAILED: Symlink escape should be rejected')
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException
      if (err.code === 'EPERM' || err.code === 'EACCES') {
        console.log('⊘ Test 4 SKIPPED: Cannot create symlinks (permission denied)')
      } else {
        const msg = e instanceof Error ? e.message : String(e)
        console.log('✓ Test 4 PASSED: Symlink escape rejected')
        console.log(`  Error: ${msg}`)
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log('⊘ Test 4 SKIPPED: Symlink test error')
    console.log(`  Error: ${msg}`)
  }

  // Test 5: Empty OXW_VAULT_ROOT should default to vaultDir (uses OXW_DATA_DIR or cwd/data/export)
  try {
    delete process.env.OXW_VAULT_ROOT
    // Set OXW_DATA_DIR to project root data dir for test
    process.env.OXW_DATA_DIR = path.join(__dirname, '..', '..', 'data')
    const { vaultDir } = await import('@/lib/db')
    const defaultPath = path.join(vaultDir, 'default-test')
    rmSync(defaultPath, { recursive: true, force: true })
    // Use absolute path under vaultDir
    const result = writeObsidianVault(defaultPath)
    console.log('✓ Test 5 PASSED: Default vaultDir used when OXW_VAULT_ROOT unset')
    console.log(`  Created at ${result.dir}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log('✗ Test 5 FAILED: Default vaultDir should work')
    console.log(`  Error: ${msg}`)
  }

  // Test 6: Multiple allowed roots via comma-separated OXW_VAULT_ROOT
  try {
    const secondRoot = path.join(TEST_ROOT, 'second-root')
    mkdirSync(secondRoot, { recursive: true })
    process.env.OXW_VAULT_ROOT = `${VAULT_ROOT},${secondRoot}`

    const result = writeObsidianVault(path.join(secondRoot, 'multi-root-test'))
    console.log('✓ Test 6 PASSED: Multiple allowed roots work')
    console.log(`  Created at ${result.dir}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log('✗ Test 6 FAILED: Multiple allowed roots should work')
    console.log(`  Error: ${msg}`)
  }

  console.log('\n=== All tests completed ===')
}

runTests().catch(console.error)