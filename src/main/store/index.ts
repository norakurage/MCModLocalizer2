import Store from 'electron-store'

export interface UsageRecord {
  id: string
  timestamp: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCostUsd: number
}

export interface AppSettings {
  model: string
  parallelism: number
  chunkMaxChars: number
  chunkMaxItems: number
  sleepInterval: number
  theme: 'light' | 'dark' | 'system'
  lastModsDir: string
  lastOutDir: string
}

interface StoreSchema {
  settings: AppSettings
  window: { x?: number; y?: number; width: number; height: number }
  usageHistory: UsageRecord[]
}

const defaults: StoreSchema = {
  settings: {
    model: 'gemini-2.5-flash',
    parallelism: 1,
    chunkMaxChars: 6000,
    chunkMaxItems: 80,
    sleepInterval: 400,
    theme: 'system',
    lastModsDir: '',
    lastOutDir: '',
  },
  window: { width: 1000, height: 700 },
  usageHistory: [],
}

let _store: Store<StoreSchema> | null = null

export function getStore(): Store<StoreSchema> {
  if (!_store) {
    _store = new Store<StoreSchema>({ defaults })
  }
  return _store
}

export function resetStore(): void {
  const store = getStore()
  store.clear()
}
