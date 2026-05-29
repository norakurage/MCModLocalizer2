import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/channels'

const INVOKE_CHANNELS = new Set<string>([
  IPC.DIALOG_OPEN_FOLDER,
  IPC.INFER_OUT_DIR,
  IPC.TRANSLATION_START,
  IPC.TRANSLATION_STOP,
  IPC.KEYCHAIN_GET,
  IPC.KEYCHAIN_SET,
  IPC.KEYCHAIN_DELETE,
  IPC.STORE_GET,
  IPC.STORE_SET,
  IPC.STORE_RESET,
])

const LISTEN_CHANNELS = new Set<string>([
  IPC.TRANSLATION_LOG,
  IPC.TRANSLATION_PROGRESS,
  IPC.TRANSLATION_DONE,
  IPC.TRANSLATION_ERROR,
])

const electronAPI = {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    if (!INVOKE_CHANNELS.has(channel)) {
      return Promise.reject(new Error(`Forbidden channel: ${channel}`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    if (!LISTEN_CHANNELS.has(channel)) return () => {}
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void =>
      callback(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
}

contextBridge.exposeInMainWorld('electron', electronAPI)

export type ElectronAPI = typeof electronAPI
