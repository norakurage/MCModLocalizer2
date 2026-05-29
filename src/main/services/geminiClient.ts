import { SYSTEM_INSTRUCTIONS_BASE, USER_TEMPLATE } from '../core/constants'

const ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'

export interface UsageStats {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface BatchResult {
  translations: Record<string, string>
  usage: UsageStats
}

type LogFn = (msg: string) => void

function parseUsage(resp: unknown): UsageStats {
  if (typeof resp !== 'object' || resp === null) return { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  const r = resp as Record<string, unknown>
  const u = r['usage'] as Record<string, unknown> | undefined
  if (!u) return { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  const toInt = (v: unknown): number => (typeof v === 'number' ? Math.floor(v) : 0)
  const pt = toInt(u['prompt_tokens'])
  const ct = toInt(u['completion_tokens'])
  const tt = toInt(u['total_tokens']) || pt + ct
  return { promptTokens: pt, completionTokens: ct, totalTokens: tt }
}

function parseItems(content: string, expected: number): string[] | null {
  try {
    const obj = JSON.parse(content)
    if (obj && typeof obj === 'object' && Array.isArray(obj.items)) {
      return (obj.items as unknown[]).map(String)
    }
    if (Array.isArray(obj)) return (obj as unknown[]).map(String)
  } catch { /* fall through */ }
  // fallback: extract JSON array from raw text
  const m = /\{[\s\S]*"items"\s*:\s*(\[[\s\S]*?\])/.exec(content)
  if (m) {
    try { return (JSON.parse(m[1]) as unknown[]).map(String) } catch { /* fall through */ }
  }
  const arr = /\[[\s\S]*\]/.exec(content)
  if (arr) {
    try { return (JSON.parse(arr[0]) as unknown[]).map(String) } catch { /* fall through */ }
  }
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length >= expected) return lines.slice(0, expected)
  return null
}

async function callGemini(
  apiKey: string,
  model: string,
  values: string[],
  systemNote: string,
  signal: AbortSignal,
  log?: LogFn,
): Promise<{ items: string[]; usage: UsageStats }> {
  // HTTP headers must be ASCII-printable (≤0x7E). Strip any stray Unicode chars.
  const cleanKey = apiKey.replace(/[^\x20-\x7E]/g, '').trim()
  if (!cleanKey) throw new Error('APIキーが設定されていません。設定タブで再入力してください。')

  const payload = JSON.stringify(values, null, 2)
  const userText = USER_TEMPLATE.replace('<<PAYLOAD>>', payload)

  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_INSTRUCTIONS_BASE + systemNote },
      { role: 'user', content: userText },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'translation_result',
        schema: {
          type: 'object',
          properties: { items: { type: 'array', items: { type: 'string' } } },
          required: ['items'],
          additionalProperties: false,
        },
        strict: true,
      },
    },
  }

  const MAX_RETRIES = 5
  let delay = 5000

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let resp: Response
    try {
      resp = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cleanKey}` },
        body: JSON.stringify(body),
        signal,
      })
    } catch (err: unknown) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      if (attempt === MAX_RETRIES - 1) throw err
      const msg = `[WARN] ネットワークエラー: ${String(err)}. ${delay / 1000}s 後にリトライ... (${attempt + 1}/${MAX_RETRIES})`
      log?.(msg)
      await sleep(delay, signal)
      delay = Math.min(delay * 2, 60000)
      continue
    }

    if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
      const text = await resp.text().catch(() => '')
      throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`)
    }

    if (resp.status === 429 || resp.status >= 500) {
      if (attempt === MAX_RETRIES - 1) {
        throw new Error(`HTTP ${resp.status}: リトライ上限超過`)
      }
      const msg = `[WARN] HTTP ${resp.status}. ${delay / 1000}s 後にリトライ... (${attempt + 1}/${MAX_RETRIES})`
      log?.(msg)
      await sleep(delay, signal)
      delay = Math.min(delay * 2, 60000)
      continue
    }

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`)
    }

    const json = await resp.json()
    const usage = parseUsage(json)
    const content: string =
      (json as Record<string, unknown>)['choices']?.[0]?.['message']?.['content'] ?? ''
    return { items: parseItems(content, values.length) ?? [], usage }
  }

  throw new Error('Gemini API: リトライ上限超過')
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

export async function translateBatch(
  apiKey: string,
  model: string,
  items: { key: string; value: string }[],
  signal: AbortSignal,
  log?: LogFn,
  retryDepth = 0,
): Promise<BatchResult> {
  if (items.length === 0) return { translations: {}, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }

  const values = items.map((i) => i.value)
  const totalUsage: UsageStats = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

  let result = await callGemini(apiKey, model, values, '', signal, log)
  totalUsage.promptTokens += result.usage.promptTokens
  totalUsage.completionTokens += result.usage.completionTokens
  totalUsage.totalTokens += result.usage.totalTokens

  if (result.items.length < items.length) {
    // retry with stricter instruction
    const note =
      '\n出力は次の形式のみ：{"items": [<訳1>, <訳2>, ...]}（items と同じ順序・要素数）。余計な文字や説明は一切書かないこと。'
    result = await callGemini(apiKey, model, values, note, signal, log)
    totalUsage.promptTokens += result.usage.promptTokens
    totalUsage.completionTokens += result.usage.completionTokens
    totalUsage.totalTokens += result.usage.totalTokens
  }

  if (result.items.length < items.length && retryDepth < 2) {
    // recursive sub-batch for missing items
    const start = result.items.length
    const subset = items.slice(start)
    const subResult = await translateBatch(apiKey, model, subset, signal, log, retryDepth + 1)
    totalUsage.promptTokens += subResult.usage.promptTokens
    totalUsage.completionTokens += subResult.usage.completionTokens
    totalUsage.totalTokens += subResult.usage.totalTokens

    for (const [k, v] of Object.entries(subResult.translations)) {
      const idx = items.findIndex((i) => i.key === k)
      if (idx >= start) result.items[idx - start + start] = v
    }
    result.items.push(...Object.values(subResult.translations).slice(result.items.length - start))
  }

  if (result.items.length < items.length) {
    throw new Error(
      `翻訳数不足: ${result.items.length}/${items.length} 件しか返りませんでした`,
    )
  }

  const translations: Record<string, string> = {}
  items.forEach((item, idx) => {
    translations[item.key] = result.items[idx] ?? item.value
  })

  return { translations, usage: totalUsage }
}
