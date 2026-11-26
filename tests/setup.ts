import { beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

let testDataDir: string
let originalDataDir: string | undefined

export function getTestDataDir(): string {
  return testDataDir
}

beforeEach(() => {
  // Create a unique temp directory for this test
  testDataDir = path.join(os.tmpdir(), `oxw-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`)
  mkdirSync(testDataDir, { recursive: true })
  mkdirSync(path.join(testDataDir, 'media'), { recursive: true })
  mkdirSync(path.join(testDataDir, 'export'), { recursive: true })

  // Save original and override OXW_DATA_DIR
  originalDataDir = process.env.OXW_DATA_DIR
  process.env.OXW_DATA_DIR = testDataDir

  // Clear module cache to force re-initialization of db with new path
  vi.resetModules()
})

afterEach(() => {
  // Restore original env
  if (originalDataDir !== undefined) {
    process.env.OXW_DATA_DIR = originalDataDir
  } else {
    delete process.env.OXW_DATA_DIR
  }

  // Clean up test directory
  try {
    rmSync(testDataDir, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }

  vi.resetModules()
})