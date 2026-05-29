import { describe, it, expect } from 'vitest'
import { chunkPairs } from '../../src/main/core/chunking'

describe('chunkPairs', () => {
  it('returns empty for empty input', () => {
    expect(chunkPairs([])).toEqual([])
  })

  it('puts all items in one chunk when within limits', () => {
    const pairs: [string, string][] = [['a', 'hello'], ['b', 'world']]
    const chunks = chunkPairs(pairs, 6000, 80)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toHaveLength(2)
  })

  it('splits by maxItems', () => {
    const pairs: [string, string][] = Array.from({ length: 5 }, (_, i) => [`k${i}`, `v${i}`])
    const chunks = chunkPairs(pairs, 100000, 2)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(2)
    }
  })

  it('splits by maxChars', () => {
    const longVal = 'x'.repeat(100)
    const pairs: [string, string][] = Array.from({ length: 10 }, (_, i) => [`k${i}`, longVal])
    const chunks = chunkPairs(pairs, 300, 80)
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('preserves all items across chunks', () => {
    const pairs: [string, string][] = Array.from({ length: 20 }, (_, i) => [`k${i}`, `v${i}`])
    const chunks = chunkPairs(pairs, 6000, 3)
    const all = chunks.flat()
    expect(all).toHaveLength(20)
    expect(all.map(([k]) => k)).toEqual(pairs.map(([k]) => k))
  })
})
