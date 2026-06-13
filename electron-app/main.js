const { app, BrowserWindow, ipcMain, shell} = require('electron')
const path = require('node:path')
const { fork }  = require('child_process')
const {Menu} = require("electron/main");
const { loadConfig, saveConfig } = require('./config')

// Live in-memory copy of the configuration. Replaced (not mutated) whenever
// the user saves changes through the in-app settings, so that subsequent reads
// see the most recent values without re-reading the file.
let currentConfig

// Force a stable app name so app.getPath('userData') resolves to
// %APPDATA%\michelectron (Windows) / ~/Library/Application Support/michelectron (macOS)
// / ~/.config/michelectron (Linux) whether the app is launched via
// `electron .` during development or as a packaged build.
app.setName('michelectron')

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

process.env.DIST = path.join(__dirname, '../dist/front/')
process.env.VITE_PUBLIC = app.isPackaged
    ? process.env.DIST
    : path.join(process.env.DIST, '../public')

if (!app.requestSingleInstanceLock()) {
    app.quit()
    process.exit(0)
}

let win
let settingsWin
let serverProcess
let frontServerProcess

function quitApp() {
    if (settingsWin && !settingsWin.isDestroyed()) {
        settingsWin.destroy()
    }
    frontServerProcess?.kill()
    serverProcess?.kill()
    win = null
    settingsWin = null
    app.quit()
}

function openSettingsWindow() {
    if (settingsWin && !settingsWin.isDestroyed()) {
        settingsWin.focus()
        return
    }
    settingsWin = new BrowserWindow({
        width: 520,
        height: 380,
        resizable: false,
        minimizable: false,
        maximizable: false,
        modal: Boolean(win),
        parent: win,
        title: 'M.I.C.H.E.L. - Settings',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, './settingsPreload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
        },
    })
    settingsWin.setMenu(null)
    settingsWin.loadFile(path.join(__dirname, 'settings.html'))
    settingsWin.once('closed', () => {
        settingsWin = null
    })
}

function createWindow() {
    win = new BrowserWindow({
        icon: path.join(__dirname, './images/logo_56.png'), //
        webPreferences: {
            preload: path.join(__dirname, './preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
        },
    })

    win.setMenu(Menu.buildFromTemplate(
        [
            {
            label: 'Actions',
                submenu: [
                    {
                        label: 'Settings...',
                        accelerator: 'CmdOrCtrl+,',
                        click: openSettingsWindow
                    },
                    { type: 'separator' },
                    {
                        label: 'Quit',
                        click: quitApp
                    }
                ],
        },
            {
            label: 'View',
                submenu: [
                    { role: 'reload' },
                    { role: 'forceReload' },
                    { role: 'toggleDevTools' },
                ],
        },
            {
            label: 'About',
                submenu: [
                    {
                        label: 'The app',
                        click: async () => {
                            const { shell } = require('electron')
                            await shell.openExternal('https://github.com/hoshin/MICHEL/tree/main?tab=readme-ov-file')
                        }
                    },
                    {
                        label: 'Martin "Hoshin" Bahier',
                        click: async () => {
                            const { shell } = require('electron')
                            await shell.openExternal('https://hoshin-casts.com')
                        }
                    }
                ]

        }]
    ))

    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(process.env.DIST, 'index.html'))
    }

    if(process.env.ELECTRON_DEBUG) {
        win.webContents.openDevTools()
    }

    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
    })
}

function waitForSpawn(child) {
    return new Promise((resolve) => {
        if (child.pid) {
            resolve()
            return
        }
        child.once('spawn', resolve)
    })
}

function forkBackEnd(config) {
    return fork(
        path.join(__dirname, '../dist/back/index'),
        [],
        { env: { ...process.env, FACEIT_KEY: config.secrets.faceItAPIKey } }
    )
}

function forkFrontServer(config) {
    return fork(
        path.join(__dirname, 'frontServer.js'),
        [],
        { env: { ...process.env, FRONT_SERVER_PORT: String(config.ports.frontServer) } }
    )
}

/**
 * Kill the current back-end fork (if any) and re-fork it with the current
 * configuration. Returns a promise that resolves once the new fork has
 * spawned.
 */
async function restartBackEnd() {
    const previous = serverProcess
    serverProcess = forkBackEnd(currentConfig)
    await waitForSpawn(serverProcess)
    if (previous) {
        previous.kill()
    }
    console.log('[main] back-end fork restarted with updated configuration')
}

// --- IPC: Settings window <-> main process ------------------------------

// Settings window asks for the current FACEIT key so it can pre-fill the
// input field.
ipcMain.handle('settings:get-faceit-key', () => {
    return currentConfig?.secrets?.faceItAPIKey ?? ''
})

// Settings window pushes a new FACEIT API key. We persist it, refresh the
// in-memory config, then restart the back-end fork so the new key takes
// effect without the user having to restart the whole app.
ipcMain.handle('settings:set-faceit-key', async (_event, rawKey) => {
    try {
        const key = typeof rawKey === 'string' ? rawKey.trim() : ''
        currentConfig = saveConfig({ secrets: { faceItAPIKey: key } })
        await restartBackEnd()
        return { ok: true }
    } catch (err) {
        console.error('[main] Failed to save FACEIT API key.', err)
        return { ok: false, error: err?.message || String(err) }
    }
})

// Settings window asks to close itself (Cancel button).
ipcMain.on('settings:close', (event) => {
    const sourceWindow = BrowserWindow.fromWebContents(event.sender)
    if (sourceWindow && !sourceWindow.isDestroyed()) {
        sourceWindow.close()
    }
})

app.whenReady().then(() => {
    currentConfig = loadConfig()

    serverProcess = forkBackEnd(currentConfig)
    frontServerProcess = forkFrontServer(currentConfig)

    const forksReady = Promise.all([
        waitForSpawn(serverProcess),
        waitForSpawn(frontServerProcess),
    ])

    createWindow()

    const rendererReady = new Promise((resolve) => {
        win.webContents.once('did-finish-load', resolve)
    })

    Promise.all([forksReady, rendererReady]).then(() => {
        win?.webContents.send('forks-ready')
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
       quitApp()
    }
})