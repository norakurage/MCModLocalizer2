import React, { useEffect, useState } from 'react'
import { FolderInput } from '../common/FolderInput'
import { LogViewer } from '../common/LogViewer'
import { ProgressBar } from '../common/ProgressBar'
import { useAppStore } from '../../store'
import { IPC } from '../../../../shared/channels'

export function ExtractTab(): React.ReactElement {
  const { isRunning, logs, progress, settings, setRunning, clearLogs, setSettings } = useAppStore()
  const [modsDir, setModsDir] = useState('')
  const [outDir, setOutDir] = useState('')
  const [inferredHint, setInferredHint] = useState('')

  // Load saved dirs on mount
  useEffect(() => {
    if (settings) {
      if (settings.lastModsDir) setModsDir(settings.lastModsDir)
      if (settings.lastOutDir) setOutDir(settings.lastOutDir)
    }
  }, [settings])

  // Auto-infer output dir when mods dir changes
  useEffect(() => {
    if (!modsDir) { setInferredHint(''); return }
    window.electron.invoke(IPC.INFER_OUT_DIR, modsDir).then((inferred) => {
      const path = inferred as string
      setInferredHint(path)
      if (!outDir) setOutDir(path)
    }).catch(() => {})
  }, [modsDir])

  async function startTranslation(): Promise<void> {
    if (!modsDir || !outDir) return

    // save last used dirs
    const DEFAULT_SETTINGS = { model: 'gemini-2.5-flash', parallelism: 1, chunkMaxChars: 6000, chunkMaxItems: 80, sleepInterval: 400, theme: 'system' as const, lastModsDir: '', lastOutDir: '' }
    const s = settings ?? DEFAULT_SETTINGS
    const updated = { ...s, lastModsDir: modsDir, lastOutDir: outDir }
    setSettings(updated)
    await window.electron.invoke(IPC.STORE_SET, 'settings', updated)

    // get api key
    const apiKey = await window.electron.invoke(IPC.KEYCHAIN_GET) as string | null
    if (!apiKey) {
      alert('API キーが設定されていません。設定タブから入力してください。')
      return
    }

    clearLogs()
    setRunning(true)

    window.electron.invoke(IPC.TRANSLATION_START, {
      modsDir,
      outDir,
      apiKey,
      model: settings?.model ?? 'gemini-2.5-flash',
      parallelism: settings?.parallelism ?? 1,
      chunkMaxChars: settings?.chunkMaxChars ?? 6000,
      chunkMaxItems: settings?.chunkMaxItems ?? 80,
      sleepInterval: settings?.sleepInterval ?? 400,
    }).catch((err: unknown) => {
      setRunning(false)
      console.error(err)
    })
  }

  async function stopTranslation(): Promise<void> {
    await window.electron.invoke(IPC.TRANSLATION_STOP)
  }

  const progressItems = Array.from(progress.values()).filter((p) => p.modId !== '__global' && p.ratio < 1)

  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-hidden">
      {/* Inputs */}
      <div className="space-y-3 shrink-0">
        <FolderInput
          label="Mods フォルダ"
          value={modsDir}
          onChange={setModsDir}
          hint={inferredHint ? `推測された出力先: ${inferredHint}` : undefined}
        />
        <FolderInput
          label="出力フォルダ"
          value={outDir}
          onChange={setOutDir}
        />
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-dark-subtext">
            並列数
          </label>
          <select
            value={settings?.parallelism ?? 1}
            disabled={isRunning}
            onChange={(e) => {
              const DEFAULT_SETTINGS2 = { model: 'gemini-2.5-flash', parallelism: 1, chunkMaxChars: 6000, chunkMaxItems: 80, sleepInterval: 400, theme: 'system' as const, lastModsDir: '', lastOutDir: '' }
              const updated = { ...(settings ?? DEFAULT_SETTINGS2), parallelism: Number(e.target.value) }
              setSettings(updated)
              window.electron.invoke(IPC.STORE_SET, 'settings', updated).catch(() => {})
            }}
            className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-dark-overlay bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 shrink-0">
        <button
          onClick={startTranslation}
          disabled={isRunning || !modsDir || !outDir}
          className="px-4 py-2 text-sm font-medium rounded bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-dark-overlay text-white disabled:text-gray-500 dark:disabled:text-dark-muted transition-colors"
        >
          翻訳を開始
        </button>
        <button
          onClick={stopTranslation}
          disabled={!isRunning}
          className="px-4 py-2 text-sm font-medium rounded bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-dark-overlay text-white disabled:text-gray-500 dark:disabled:text-dark-muted transition-colors"
        >
          停止
        </button>
      </div>

      {/* Progress bars */}
      {progressItems.length > 0 && (
        <div className="space-y-2 shrink-0 max-h-32 overflow-y-auto scrollbar-thin">
          {progressItems.map((p) => (
            <ProgressBar key={p.modId} item={p} />
          ))}
        </div>
      )}

      {/* Log viewer */}
      <div className="flex-1 min-h-0">
        <LogViewer logs={logs} />
      </div>
    </div>
  )
}
