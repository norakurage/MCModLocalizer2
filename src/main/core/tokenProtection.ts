import { PROTECT_RE } from './constants'

export interface ProtectResult {
  protected: string
  mapping: Map<string, string>
}

export function protectTokens(s: string): ProtectResult {
  const mapping = new Map<string, string>()
  let idx = 0
  const protectedStr = s.replace(new RegExp(PROTECT_RE.source, 'g'), (match) => {
    const key = `‹T${idx}›`
    mapping.set(key, match)
    idx++
    return key
  })
  return { protected: protectedStr, mapping }
}

export function restoreTokens(s: string, mapping: Map<string, string>): string {
  let result = s
  for (const [key, value] of mapping) {
    result = result.replaceAll(key, value)
  }
  return result
}
