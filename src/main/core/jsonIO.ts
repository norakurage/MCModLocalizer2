import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs'
import { dirname } from 'path'

export function loadJson(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {}
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) {
      return Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [String(k), String(v)]),
      )
    }
  } catch {
    // ignore malformed JSON
  }
  return {}
}

export function writeJson(filePath: string, data: Record<string, string>): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}
