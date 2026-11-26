import { describe, it, expect } from 'vitest'
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'

// Copy of the functions from db.ts for testing without importing node:sqlite
function verifyPassword(password: string, salt: string, expected: string): boolean {
  const actual = scryptSync(password, salt, 64)
  const target = Buffer.from(expected, 'hex')
  if (actual.length !== target.length) return false
  return timingSafeEqual(actual, target)
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

describe('lib/auth - pure helpers (via db)', () => {
  describe('verifyPassword', () => {
    it('verifies correct password', () => {
      const salt = randomBytes(16).toString('hex')
      const password = 'test-password-123'
      const actualHash = scryptSync(password, salt, 64).toString('hex')
      const result = verifyPassword(password, salt, actualHash)
      expect(result).toBe(true)
    })

    it('rejects incorrect password', () => {
      const salt = randomBytes(16).toString('hex')
      const hash = scryptSync('correct-password', salt, 64).toString('hex')
      const result = verifyPassword('wrong-password', salt, hash)
      expect(result).toBe(false)
    })

    it('rejects wrong salt', () => {
      const salt1 = randomBytes(16).toString('hex')
      const salt2 = randomBytes(16).toString('hex')
      const hash = scryptSync('password', salt1, 64).toString('hex')
      const result = verifyPassword('password', salt2, hash)
      expect(result).toBe(false)
    })

    it('handles different length hashes', () => {
      const salt = randomBytes(16).toString('hex')
      const hash = scryptSync('password', salt, 64).toString('hex')
      // Truncate hash to make it different length
      const shortHash = hash.slice(0, -2)
      const result = verifyPassword('password', salt, shortHash)
      expect(result).toBe(false)
    })
  })

  describe('hashToken', () => {
    it('produces consistent SHA-256 hash', () => {
      const token = 'test-token-123'
      const hash1 = hashToken(token)
      const hash2 = hashToken(token)
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64) // SHA-256 hex = 64 chars
    })

    it('produces different hashes for different tokens', () => {
      expect(hashToken('token-1')).not.toBe(hashToken('token-2'))
    })

    it('handles empty string', () => {
      const hash = hashToken('')
      expect(hash).toHaveLength(64)
    })
  })
})