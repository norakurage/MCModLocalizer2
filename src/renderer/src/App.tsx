import React, { useEffect } from 'react'
import { ExtractTab } from './components/tabs/ExtractTab'
import { TokenTab } from './components/tabs/TokenTab'
import { SettingsTab } from './components/tabs/SettingsTab'
import { useAppStore, setupIpcListeners } from './store'
import { IPC } from '../../shared/channels'
import { AppSettings, UsageRecord } from './types'

const TABS = [
  { id: 'extract' as const, label: '抽出' },
  { id: 'token' as const, label: 'トークン' },
  { id: 'settings' as const, label: '設定' },
]

export default function App(): React.ReactElement {
  const { activeTab, setActiveTab, theme, setTheme, setSettings, setUsageHistory } = useAppStore()

  useEffect(() => {
    setupIpcListeners()

    // Load settings from store
    window.electron.invoke(IPC.STORE_GET, 'settings').then((s) => {
      if (s) setSettings(s as AppSettings)
    }).catch(() => {})

    // Load usage history
    window.electron.invoke(IPC.STORE_GET, 'usageHistory').then((h) => {
      setUsageHistory((h as UsageRecord[]) ?? [])
    }).catch(() => {})
  }, [])

  // Apply theme
  useEffect(() => {
    const html = document.documentElement
    if (theme === 'dark') {
      html.classList.add('dark')
      return undefined
    } else if (theme === 'light') {
      html.classList.remove('dark')
      return undefined
    } else {
      // system
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      html.classList.toggle('dark', mq.matches)
      const handler = (e: MediaQueryListEvent): void => { html.classList.toggle('dark', e.matches) }
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  // Sync theme from loaded settings
  const settings = useAppStore((s) => s.settings)
  useEffect(() => {
    if (settings?.theme) setTheme(settings.theme)
  }, [settings?.theme])

  function toggleTheme(): void {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    window.electron.invoke(IPC.STORE_SET, 'settings', { ...(settings ?? {}), theme: next }).catch(() => {})
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text select-none">
      {/* Title bar / Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-2 pb-0 border-b border-gray-200 dark:border-dark-overlay shrink-0 drag-region">
        <span className="font-semibold text-sm text-gray-800 dark:text-dark-text mr-4 no-drag">
          MCModLocalizer
        </span>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors no-drag ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 dark:text-dark-accent dark:border-dark-accent'
                : 'border-transparent text-gray-500 dark:text-dark-muted hover:text-gray-700 dark:hover:text-dark-subtext'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={toggleTheme}
            title="テーマ切り替え"
            className="no-drag p-1.5 rounded hover:bg-gray-100 dark:hover:bg-dark-overlay text-gray-500 dark:text-dark-muted transition-colors"
          >
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'extract' && <ExtractTab />}
        {activeTab === 'token' && <TokenTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}
