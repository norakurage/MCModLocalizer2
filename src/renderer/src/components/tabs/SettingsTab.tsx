import React, { useEffect, useState } from 'react'
import { useAppStore } from '../../store'
import { IPC } from '../../../../shared/channels'
import { MODEL_DEFINITIONS } from '../../../../shared/models'
import { AppSettings } from '../../types'

export function SettingsTab(): React.ReactElement {
  const { settings, setSettings, setTheme } = useAppStore()
  const [apiKey, setApiKey] = useState('')
  const [apiKeySaved, setApiKeySaved] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  useEffect(() => {
    window.electron.invoke(IPC.KEYCHAIN_GET).then((k) => {
      if (k) setApiKeySaved(true)
    }).catch(() => {})
  }, [])

  async function saveApiKey(): Promise<void> {
    if (!apiKey.trim()) return
    await window.electron.invoke(IPC.KEYCHAIN_SET, apiKey.trim())
    setApiKey('')
    setApiKeySaved(true)
  }

  async function deleteApiKey(): Promise<void> {
    await window.electron.invoke(IPC.KEYCHAIN_DELETE)
    setApiKeySaved(false)
  }

  async function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
    const updated = { ...(settings as AppSettings), [key]: value }
    setSettings(updated)
    await window.electron.invoke(IPC.STORE_SET, 'settings', updated)
    if (key === 'theme') {
      const t = value as AppSettings['theme']
      setTheme(t)
      window.electron.invoke(IPC.STORE_SET, 'settings', updated).catch(() => {})
    }
  }

  async function resetAll(): Promise<void> {
    await window.electron.invoke(IPC.STORE_RESET)
    setApiKeySaved(false)
    setShowResetConfirm(false)
    window.location.reload()
  }

  const s = settings
  const selectedModel = MODEL_DEFINITIONS.find((m) => m.id === s?.model) ?? MODEL_DEFINITIONS[0]

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full scrollbar-thin max-w-xl">
      {/* API settings */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-muted">API</h2>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-dark-subtext">モデル</label>
          <select
            value={s?.model ?? 'gemini-2.5-flash'}
            onChange={(e) => updateSetting('model', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-dark-overlay bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text"
          >
            {MODEL_DEFINITIONS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-dark-muted">
            単価: 入力 ${selectedModel.inputPricePerMToken}/MTok / 出力 ${selectedModel.outputPricePerMToken}/MTok
          </p>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-dark-subtext">API キー</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveApiKey()}
              placeholder={apiKeySaved ? '••••••••••••••••••••' : 'AIza... または AQ...'}
              className="flex-1 px-3 py-2 text-sm rounded border border-gray-300 dark:border-dark-overlay bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text"
            />
            <button onClick={saveApiKey} disabled={!apiKey.trim()}
              className="px-3 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-dark-overlay text-white transition-colors">
              保存
            </button>
            {apiKeySaved && (
              <button onClick={deleteApiKey}
                className="px-3 py-2 text-sm rounded bg-red-500 hover:bg-red-600 text-white transition-colors">
                削除
              </button>
            )}
          </div>
          {apiKeySaved && (
            <p className="text-xs text-green-600 dark:text-dark-green">✓ キーが保存されています</p>
          )}
        </div>
      </section>

      {/* Translation detail settings */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-muted">翻訳詳細</h2>
        {([
          ['parallelism', '並列数', 1, 8, 1],
          ['chunkMaxChars', 'チャンク最大文字数', 1000, 20000, 100],
          ['chunkMaxItems', 'チャンク最大件数', 10, 200, 1],
          ['sleepInterval', 'バッチ間スリープ (ms)', 0, 5000, 50],
        ] as [keyof AppSettings, string, number, number, number][]).map(([key, label, min, max, step]) => (
          <div key={key} className="flex items-center gap-3">
            <label className="text-sm text-gray-700 dark:text-dark-subtext w-44 shrink-0">{label}</label>
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={(s?.[key] as number) ?? 0}
              onChange={(e) => updateSetting(key, Number(e.target.value))}
              className="w-28 px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-dark-overlay bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text"
            />
          </div>
        ))}
      </section>

      {/* Theme */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-muted">外観</h2>
        <div className="flex gap-4">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <label key={t} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700 dark:text-dark-subtext">
              <input
                type="radio"
                name="theme"
                value={t}
                checked={(s?.theme ?? 'system') === t}
                onChange={() => updateSetting('theme', t)}
                className="accent-blue-600"
              />
              {t === 'light' ? 'ライト' : t === 'dark' ? 'ダーク' : 'システム'}
            </label>
          ))}
        </div>
      </section>

      {/* Danger zone */}
      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-dark-overlay">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-red-500">危険ゾーン</h2>
        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-4 py-2 text-sm rounded border border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
          >
            アプリを初期化...
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-600 dark:text-red-400">
              API キー・履歴・設定をすべて削除します。よろしいですか？
            </span>
            <button onClick={resetAll} className="px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700 text-white">実行</button>
            <button onClick={() => setShowResetConfirm(false)} className="px-3 py-1.5 text-sm rounded bg-gray-200 dark:bg-dark-overlay text-gray-700 dark:text-dark-subtext">キャンセル</button>
          </div>
        )}
      </section>
    </div>
  )
}
