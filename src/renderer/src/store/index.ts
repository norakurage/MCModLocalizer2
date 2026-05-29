import { create } from 'zustand'
import { LogEntry, ModProgress, TranslationDonePayload, UsageRecord, AppSettings } from '../types'
import { IPC } from '../../../shared/channels'

interface AppState {
  // tabs
  activeTab: 'extract' | 'token' | 'settings'
  setActiveTab: (tab: 'extract' | 'token' | 'settings') => void

  // theme
  theme: 'light' | 'dark' | 'system'
  setTheme: (t: 'light' | 'dark' | 'system') => void

  // translation state
  isRunning: boolean
  logs: LogEntry[]
  progress: Map<string, ModProgress>
  sessionUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null
  usageHistory: UsageRecord[]

  // settings (from store)
  settings: AppSettings | null
  setSettings: (s: AppSettings) => void

  // actions
  clearLogs: () => void
  appendLog: (entry: LogEntry) => void
  setProgress: (p: ModProgress) => void
  setRunning: (v: boolean) => void
  setSessionUsage: (u: TranslationDonePayload) => void
  setUsageHistory: (h: UsageRecord[]) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'extract',
  setActiveTab: (tab) => set({ activeTab: tab }),

  theme: 'system',
  setTheme: (t) => set({ theme: t }),

  isRunning: false,
  logs: [],
  progress: new Map(),
  sessionUsage: null,
  usageHistory: [],

  settings: null,
  setSettings: (s) => set({ settings: s }),

  clearLogs: () => set({ logs: [], progress: new Map() }),
  appendLog: (entry) =>
    set((state) => ({
      logs: [...state.logs.slice(-2000), entry], // cap at 2000 entries
    })),
  setProgress: (p) =>
    set((state) => {
      const next = new Map(state.progress)
      next.set(p.modId, p)
      return { progress: next }
    }),
  setRunning: (v) => set({ isRunning: v }),
  setSessionUsage: (u) =>
    set({
      sessionUsage: {
        promptTokens: u.promptTokens,
        completionTokens: u.completionTokens,
        totalTokens: u.totalTokens,
      },
    }),
  setUsageHistory: (h) => set({ usageHistory: h }),
}))

declare global {
  interface Window {
    electron: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
      on: (channel: string, cb: (...args: unknown[]) => void) => () => void
    }
  }
}

let listenersSetup = false
let idCounter = 0

export function setupIpcListeners(): void {
  if (listenersSetup) return
  listenersSetup = true

  const store = useAppStore.getState()

  window.electron.on(IPC.TRANSLATION_LOG, (payload) => {
    const p = payload as { modId: string; level: 'info' | 'warn' | 'error'; message: string }
    store.appendLog({
      id: String(++idCounter),
      modId: p.modId,
      level: p.level,
      message: p.message,
      timestamp: new Date().toLocaleTimeString('ja-JP'),
    })
  })

  window.electron.on(IPC.TRANSLATION_PROGRESS, (payload) => {
    const p = payload as { modId: string; ratio: number; label: string }
    store.setProgress(p)
  })

  window.electron.on(IPC.TRANSLATION_DONE, (payload) => {
    const p = payload as TranslationDonePayload
    useAppStore.getState().setRunning(false)
    useAppStore.getState().setSessionUsage(p)
    useAppStore.getState().appendLog({
      id: String(++idCounter),
      modId: '__global',
      level: 'info',
      message: `✓ 全処理完了。${p.processedMods}/${p.totalMods} Mod 処理済み。合計 ${p.totalTokens.toLocaleString()} トークン使用。`,
      timestamp: new Date().toLocaleTimeString('ja-JP'),
    })
    // send OS notification
    new Notification('MCModLocalizer', {
      body: `翻訳が完了しました (${p.processedMods}/${p.totalMods} Mod)`,
    })
    // reload history
    window.electron.invoke(IPC.STORE_GET, 'usageHistory').then((h) => {
      useAppStore.getState().setUsageHistory((h as UsageRecord[]) ?? [])
    })
  })

  window.electron.on(IPC.TRANSLATION_ERROR, (payload) => {
    const p = payload as { message: string }
    useAppStore.getState().setRunning(false)
    useAppStore.getState().appendLog({
      id: String(++idCounter),
      modId: '__global',
      level: 'error',
      message: `エラー: ${p.message}`,
      timestamp: new Date().toLocaleTimeString('ja-JP'),
    })
  })
}
