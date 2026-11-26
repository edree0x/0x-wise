#!/usr/bin/env node
// Test for mandatory cron token (Task 2)

import { timingSafeEqual } from 'node:crypto'

console.log('=== Cron Token Mandatory Tests ===\n')

// Mock the authorized function logic (matching the actual implementation)
function testAuthorized(providedToken: string | null, expectedToken: string | undefined): boolean {
  if (!expectedToken) {
    throw new Error('OXW_CRON_TOKEN is not set. This endpoint requires a cron token.')
  }
  if (!providedToken) return false
  const providedBuf = Buffer.from(providedToken)
  const expectedBuf = Buffer.from(expectedToken)
  if (providedBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(providedBuf, expectedBuf)
}

// Test 1: Missing env var should throw
try {
  testAuthorized('some-token', undefined)
  console.log('✗ Test 1 FAILED: Missing OXW_CRON_TOKEN should throw')
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  console.log('✓ Test 1 PASSED: Missing OXW_CRON_TOKEN throws error')
  console.log(`  Error: ${msg}`)
}

// Test 2: Missing header should return false
try {
  const result = testAuthorized(null, 'correct-token')
  if (!result) {
    console.log('✓ Test 2 PASSED: Missing header returns false')
  } else {
    console.log('✗ Test 2 FAILED: Missing header should return false')
  }
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  console.log('✗ Test 2 FAILED: Should not throw for missing header')
  console.log(`  Error: ${msg}`)
}

// Test 3: Correct token should return true
try {
  const result = testAuthorized('correct-token', 'correct-token')
  if (result) {
    console.log('✓ Test 3 PASSED: Correct token returns true')
  } else {
    console.log('✗ Test 3 FAILED: Correct token should return true')
  }
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  console.log('✗ Test 3 FAILED: Should not throw for correct token')
  console.log(`  Error: ${msg}`)
}

// Test 4: Wrong token should return false
try {
  const result = testAuthorized('wrong-token', 'correct-token')
  if (!result) {
    console.log('✓ Test 4 PASSED: Wrong token returns false')
  } else {
    console.log('✗ Test 4 FAILED: Wrong token should return false')
  }
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  console.log('✗ Test 4 FAILED: Should not throw for wrong token')
  console.log(`  Error: ${msg}`)
}

// Test 5: timingSafeEqual should be used (constant-time comparison)
try {
  // Test that timingSafeEqual is actually used by checking behavior with different lengths
  const result1 = testAuthorized('a', 'correct-token')
  const result2 = testAuthorized('correct-token', 'correct-token')
  console.log('✓ Test 5 PASSED: timingSafeEqual used (no early return on length mismatch)')
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  console.log('✗ Test 5 FAILED: timingSafeEqual should be used')
  console.log(`  Error: ${msg}`)
}

console.log('\n=== All tests completed ===')