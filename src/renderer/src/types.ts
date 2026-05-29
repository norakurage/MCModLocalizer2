export interface LogEntry {
  id: string
  modId: string
  level: 'info' | 'warn' | 'error'
  message: string
  timestamp: string
}

export interface ModProgress {
  modId: string
  ratio: number
  label: string
}

export interface TranslationDonePayload {
  totalMods: number
  processedMods: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

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
