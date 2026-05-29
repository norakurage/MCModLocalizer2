import { join } from 'path'
import { existsSync, readdirSync, unlinkSync, rmdirSync } from 'fs'
import { protectTokens, restoreTokens } from '../core/tokenProtection'
import { chunkPairs } from '../core/chunking'
import { loadJson, writeJson } from '../core/jsonIO'
import { translateBatch, UsageStats } from './geminiClient'

export interface TranslationRequest {
  modsDir: string
  outDir: string
  apiKey: string
  model: string
  parallelism: number
  chunkMaxChars: number
  chunkMaxItems: number
  sleepInterval: number
}

export interface TranslationCallbacks {
  onLog: (modId: string, level: 'info' | 'warn' | 'error', message: string) => void
  onProgress: (modId: string, ratio: number, label: string) => void
  onModDone: (modId: string, usage: UsageStats) => void
}

export interface JarTask {
  jarPath: string
  modId: string
  enUsEntries: Record<string, string>
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
  })
}

export class TranslationRunner {
  private controller: AbortController | null = null

  stop(): void {
    this.controller?.abort()
  }

  async run(tasks: JarTask[], req: TranslationRequest, cb: TranslationCallbacks): Promise<void> {
    this.controller = new AbortController()
    const signal = this.controller.signal

    // Process in N-parallel using a semaphore-style queue
    const sem = new Semaphore(req.parallelism)
    await Promise.all(tasks.map((task) => sem.run(() => this.processTask(task, req, cb, signal))))
  }

  private async processTask(
    task: JarTask,
    req: TranslationRequest,
    cb: TranslationCallbacks,
    signal: AbortSignal,
  ): Promise<void> {
    const { modId, enUsEntries } = task
    const outJsonPath = join(req.outDir, 'assets', modId, 'lang', 'ja_jp.json')
    const resumePath = join(req.outDir, '.resume', `${modId}.json`)

    cb.onLog(modId, 'info', `[${modId}] 処理開始`)

    // Load existing ja_jp.json and resume data
    const existing = loadJson(outJsonPath)
    const resumeData = loadJson(resumePath)

    // Merge: resume first, then existing (don't overwrite non-empty)
    const dst: Record<string, string> = { ...existing }
    for (const [k, v] of Object.entries(resumeData)) {
      if (!dst[k]?.trim() && v.trim()) dst[k] = v
    }

    // Collect untranslated keys
    const todo: [string, string][] = []
    const tokenMaps = new Map<string, Map<string, string>>()

    for (const [key, enVal] of Object.entries(enUsEntries)) {
      if (dst[key]?.trim()) continue
      const { protected: prot, mapping } = protectTokens(enVal)
      if (mapping.size > 0) tokenMaps.set(key, mapping)
      todo.push([key, prot])
    }

    if (todo.length === 0) {
      cb.onLog(modId, 'info', `[${modId}] すでに翻訳済みです（差分なし）`)
      cb.onProgress(modId, 1, '完了')
      return
    }

    cb.onLog(modId, 'info', `[${modId}] 未訳 ${todo.length} 件を翻訳します`)

    const chunks = chunkPairs(todo, req.chunkMaxChars, req.chunkMaxItems)
    let done = 0
    const total = todo.length
    const totalUsage: UsageStats = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

    try {
      for (const chunk of chunks) {
        if (signal.aborted) {
          cb.onLog(modId, 'warn', `[${modId}] 停止しました`)
          writeJson(resumePath, dst)
          break
        }

        const batchItems = chunk.map(([k, v]) => ({ key: k, value: v }))
        cb.onLog(modId, 'info', `[${modId}] バッチ送信 ${batchItems.length} 件...`)

        const { translations, usage } = await translateBatch(
          req.apiKey, req.model, batchItems, signal,
          (msg) => cb.onLog(modId, msg.startsWith('[WARN]') ? 'warn' : 'info', `[${modId}] ${msg}`),
        )

        totalUsage.promptTokens += usage.promptTokens
        totalUsage.completionTokens += usage.completionTokens
        totalUsage.totalTokens += usage.totalTokens

        for (const [k, ja] of Object.entries(translations)) {
          const map = tokenMaps.get(k)
          dst[k] = map ? restoreTokens(ja, map) : ja
          done++
        }

        cb.onProgress(modId, done / total, `${done}/${total}`)
        cb.onLog(modId, 'info', `[${modId}] バッチ完了: ${done}/${total} 件`)

        if (req.sleepInterval > 0 && !signal.aborted) {
          await sleep(req.sleepInterval, signal).catch(() => {})
        }
      }
    } catch (err: unknown) {
      if (signal.aborted) {
        cb.onLog(modId, 'warn', `[${modId}] 停止しました`)
        writeJson(resumePath, dst)
      } else {
        cb.onLog(modId, 'error', `[${modId}] エラー: ${String(err)}`)
        writeJson(resumePath, dst)
        throw err
      }
    }

    if (!signal.aborted) {
      writeJson(outJsonPath, dst)
      cb.onLog(modId, 'info', `[${modId}] ja_jp.json を書き出しました`)
      cb.onProgress(modId, 1, '完了')

      // Clean up resume file
      try {
        if (existsSync(resumePath)) {
          unlinkSync(resumePath)
          const resumeDir = join(req.outDir, '.resume')
          const remaining = readdirSync(resumeDir)
          if (remaining.length === 0) rmdirSync(resumeDir)
        }
      } catch { /* ignore */ }
    }

    cb.onModDone(modId, totalUsage)
  }
}

class Semaphore {
  private running = 0
  private queue: (() => void)[] = []

  constructor(private max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }

  private acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.running < this.max) {
        this.running++
        resolve()
      } else {
        this.queue.push(() => { this.running++; resolve() })
      }
    })
  }

  private release(): void {
    this.running--
    const next = this.queue.shift()
    if (next) next()
  }
}
