import { describe, it, expect } from 'vitest'
import { protectTokens, restoreTokens } from '../../src/main/core/tokenProtection'

describe('protectTokens', () => {
  it('protects %s placeholder', () => {
    const { protected: p, mapping } = protectTokens('Hello %s!')
    expect(p).toBe('Hello ‹T0›!')
    expect(mapping.get('‹T0›')).toBe('%s')
  })

  it('protects %1$s style', () => {
    const { protected: p, mapping } = protectTokens('Item %1$s and %2$d')
    expect(p).toBe('Item ‹T0› and ‹T1›')
    expect(mapping.get('‹T0›')).toBe('%1$s')
    expect(mapping.get('‹T1›')).toBe('%2$d')
  })

  it('protects {name} placeholder', () => {
    const { protected: p } = protectTokens('{player} joined')
    expect(p).toBe('‹T0› joined')
  })

  it('protects {0} indexed placeholder', () => {
    const { protected: p } = protectTokens('{0} items')
    expect(p).toBe('‹T0› items')
  })

  it('protects §a color codes', () => {
    const { protected: p } = protectTokens('§aGreen text')
    expect(p).toBe('‹T0›Green text')
  })

  it('protects \\n escape', () => {
    const { protected: p } = protectTokens('Line1\\nLine2')
    expect(p).toBe('Line1‹T0›Line2')
  })

  it('returns empty mapping for plain text', () => {
    const { protected: p, mapping } = protectTokens('Hello World')
    expect(p).toBe('Hello World')
    expect(mapping.size).toBe(0)
  })
})

describe('restoreTokens', () => {
  it('restores tokens correctly', () => {
    const { protected: p, mapping } = protectTokens('Press %s to open')
    const translated = p.replace('Press', 'を押して').replace('to open', 'を開く')
    const restored = restoreTokens(translated, mapping)
    expect(restored).toContain('%s')
  })

  it('handles empty mapping', () => {
    const result = restoreTokens('hello', new Map())
    expect(result).toBe('hello')
  })
})
