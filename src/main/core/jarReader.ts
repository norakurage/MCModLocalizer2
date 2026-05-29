import AdmZip from 'adm-zip'

const LANG_PATTERN = /^assets\/([^/]+)\/lang\/([a-z0-9_-]+)\.json$/i

interface ModLangMap {
  [modId: string]: Record<string, string>
}

function scanZipEntries(zip: AdmZip, depth: number): ModLangMap {
  const result: ModLangMap = {}

  for (const entry of zip.getEntries()) {
    const name = entry.entryName.replace(/\\/g, '/')

    // Recurse into nested JARs (depth limit = 2)
    if (depth < 2 && name.endsWith('.jar') && !entry.isDirectory) {
      try {
        const innerZip = new AdmZip(entry.getData())
        const inner = scanZipEntries(innerZip, depth + 1)
        Object.assign(result, inner)
      } catch {
        // skip broken inner jar
      }
      continue
    }

    const m = LANG_PATTERN.exec(name)
    if (!m) continue
    const [, modId, lang] = m
    if (lang.toLowerCase() !== 'en_us') continue

    try {
      const raw = entry.getData().toString('utf-8')
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null) {
        result[modId] = Object.fromEntries(
          Object.entries(parsed).map(([k, v]) => [String(k), String(v)]),
        )
      }
    } catch {
      // skip malformed JSON
    }
  }

  return result
}

export function readEnUsFromJar(jarPath: string): ModLangMap {
  try {
    const zip = new AdmZip(jarPath)
    return scanZipEntries(zip, 0)
  } catch {
    return {}
  }
}

export function choosePrimaryModId(
  modMaps: ModLangMap,
): { modId: string; entries: Record<string, string> } | null {
  const items = Object.entries(modMaps)
  if (items.length === 0) return null
  items.sort((a, b) => Object.keys(b[1]).length - Object.keys(a[1]).length)
  return { modId: items[0][0], entries: items[0][1] }
}
