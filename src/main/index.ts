import { app, BrowserWindow, shell, nativeTheme } from 'electron'
import { join } from 'path'
import { getStore } from './store/index'
import { registerIpcHandlers } from './ipc/handlers'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const store = getStore()
  const savedBounds = store.get('window') as
    | { x?: number; y?: number; width: number; height: number }
    | undefined

  mainWindow = new BrowserWindow({
    x: savedBounds?.x,
    y: savedBounds?.y,
    width: savedBounds?.width ?? 1000,
    height: savedBounds?.height ?? 700,
    minWidth: 900,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'MCModLocalizer',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds()
      store.set('window', bounds)
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('jp.illbasashi.mcmod-localizer')
  }

  const store = getStore()
  const theme = (store.get('settings') as unknown as Record<string, unknown>)?.theme as string | undefined
  if (theme === 'dark') nativeTheme.themeSource = 'dark'
  else if (theme === 'light') nativeTheme.themeSource = 'light'
  else nativeTheme.themeSource = 'system'

  registerIpcHandlers(() => mainWindow)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
