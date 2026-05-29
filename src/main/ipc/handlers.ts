import { ipcMain, dialog, BrowserWindow } from 'electron'
import { join } from 'path'
import { IPC } from './channels'
import { getStore, resetStore, UsageRecord } from '../store/index'
import { getApiKey, setApiKey, deleteApiKey } from '../keychain'
import { scanModsDir, inferOutDir, buildResourcePackMeta } from '../services/extraction'
import { TranslationRunner, TranslationRequest } from '../services/translation'
import { MODEL_DEFINITIONS } from '../core/constants'
import { randomUUID } from 'crypto'

let runner: TranslationRunner | null = null

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  // ── Folder dialog ─────────────────────────────────────────────────────────
  ipcMain.handle(IPC.DIALOG_OPEN_FOLDER, async () => {
    const win = getWindow()
    const result = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  // ── Out dir inference ─────────────────────────────────────────────────────
  ipcMain.handle(IPC.INFER_OUT_DIR, (_e, modsDir: string) => inferOutDir(modsDir))

  // ── Translation ───────────────────────────────────────────────────────────
  ipcMain.handle(IPC.TRANSLATION_START, async (_e, req: TranslationRequest) => {
    const win = getWindow()
    if (!win) return

    const send = (channel: string, payload: unknown): void => {
      if (!win.isDestroyed()) win.webContents.send(channel, payload)
    }

    // Scan JAR files
    const tasks = scanModsDir(req.modsDir)
    if (tasks.length === 0) {
      send(IPC.TRANSLATION_ERROR, { message: 'mods フォルダに JAR ファイルが見つかりませんでした' })
      return
    }

    send(IPC.TRANSLATION_LOG, { modId: '__global', level: 'info', message: `${tasks.length} 個の Mod を検出しました` })

    // Build resource pack meta
    const iconPath = join(__dirname, '../../resources/icon.png')
    buildResourcePackMeta(req.outDir, iconPath)

    const sessionUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    let processedMods = 0

    runner = new TranslationRunner()
    await runner.run(tasks, req, {
      onLog: (modId, level, message) => send(IPC.TRANSLATION_LOG, { modId, level, message }),
      onProgress: (modId, ratio, label) => send(IPC.TRANSLATION_PROGRESS, { modId, ratio, label }),
      onModDone: (modId, usage) => {
        processedMods++
        sessionUsage.promptTokens += usage.promptTokens
        sessionUsage.completionTokens += usage.completionTokens
        sessionUsage.totalTokens += usage.totalTokens
        send(IPC.TRANSLATION_LOG, {
          modId,
          level: 'info',
          message: `[${modId}] 完了 (入力: ${usage.promptTokens} / 出力: ${usage.completionTokens} トークン)`,
        })
      },
    })

    // Persist usage record
    if (sessionUsage.totalTokens > 0) {
      const store = getStore()
      const modelDef = MODEL_DEFINITIONS.find((m) => m.id === req.model)
      const costUsd = modelDef
        ? (sessionUsage.promptTokens / 1_000_000) * modelDef.inputPricePerMToken +
          (sessionUsage.completionTokens / 1_000_000) * modelDef.outputPricePerMToken
        : 0

      const record: UsageRecord = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        model: req.model,
        promptTokens: sessionUsage.promptTokens,
        completionTokens: sessionUsage.completionTokens,
        totalTokens: sessionUsage.totalTokens,
        estimatedCostUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
      }
      const history = (store.get('usageHistory') as UsageRecord[]) ?? []
      history.push(record)
      store.set('usageHistory', history)
    }

    send(IPC.TRANSLATION_DONE, {
      totalMods: tasks.length,
      processedMods,
      promptTokens: sessionUsage.promptTokens,
      completionTokens: sessionUsage.completionTokens,
      totalTokens: sessionUsage.totalTokens,
    })
  })

  ipcMain.handle(IPC.TRANSLATION_STOP, () => {
    runner?.stop()
  })

  // ── Keychain ──────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.KEYCHAIN_GET, () => getApiKey())
  ipcMain.handle(IPC.KEYCHAIN_SET, (_e, password: string) => setApiKey(password))
  ipcMain.handle(IPC.KEYCHAIN_DELETE, () => deleteApiKey())

  // ── Store ─────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.STORE_GET, (_e, key: string) => {
    const store = getStore()
    return store.get(key as never)
  })

  ipcMain.handle(IPC.STORE_SET, (_e, key: string, value: unknown) => {
    const store = getStore()
    store.set(key as never, value as never)
  })

  ipcMain.handle(IPC.STORE_RESET, () => {
    resetStore()
    deleteApiKey().catch(() => {})
  })
}
