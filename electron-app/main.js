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

// Maximum time (ms) we wait for a forked child to exit after sending SIGTERM
// before we resort to SIGKILL. The forked back-end / front server normally
// exit in well under 100 ms, so 1500 ms is comfortable headroom while still
// being short enough that a stuck child does not delay app shutdown
// noticeably.
const CHILD_SHUTDOWN_TIMEOUT_MS = 1500

let shuttingDown = false

/**
 * Gracefully terminate a forked child process.
 *
 * Sends SIGTERM, waits up to {@link CHILD_SHUTDOWN_TIMEOUT_MS} for the
 * `exit` event, and falls back to SIGKILL if the child is still alive at
 * that point. On Windows, `child_process.kill('SIGKILL')` ultimately calls
 * `TerminateProcess`, which the OS cannot refuse.
 *
 * Always resolves (never rejects) so that callers can `Promise.all` over
 * several children without one stuck process aborting the whole shutdown.
 *
 * @param {import('child_process').ChildProcess | undefined | null} child
 * @param {string} [label] - used in logs only
 * @returns {Promise<void>}
 */
function gracefullyKillChild(child, label = 'child') {
    return new Promise((resolve) => {
        if (!child || child.exitCode !== null || child.signalCode !== null) {
            resolve()
            return
        }

        let settled = false
        const finish = () => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve()
        }

        child.once('exit', () => {
            console.log(`[main] ${label} exited cleanly.`)
            finish()
        })

        try {
            child.kill('SIGTERM')
        } catch (err) {
            console.error(`[main] Failed to send SIGTERM to ${label}.`, err)
            finish()
            return
        }

        const timer = setTimeout(() => {
            if (settled) return
            console.warn(
                `[main] ${label} did not exit within ${CHILD_SHUTDOWN_TIMEOUT_MS} ms; sending SIGKILL.`
            )
            try {
                child.kill('SIGKILL')
            } catch (err) {
                console.error(`[main] Failed to send SIGKILL to ${label}.`, err)
            }
            // We intentionally resolve even if SIGKILL throws or the process
            // somehow survives. By this point the parent process is on its
            // way out and the OS will reap orphans.
            finish()
        }, CHILD_SHUTDOWN_TIMEOUT_MS)
    })
}

/**
 * Kick off application shutdown: close the Settings window, kill children
 * with the graceful-then-forceful strategy above, then quit Electron. Safe
 * to call multiple times; only the first invocation does anything.
 */
function quitApp() {
    if (shuttingDown) return
    shuttingDown = true

    if (settingsWin && !settingsWin.isDestroyed()) {
        settingsWin.destroy()
    }
    settingsWin = null

    const childrenGone = Promise.all([
        gracefullyKillChild(frontServerProcess, 'front-server'),
        gracefullyKillChild(serverProcess, 'back-end'),
    ])

    childrenGone.then(() => {
        frontServerProcess = null
        serverProcess = null
        win = null
        app.quit()
    })
}

// If something else triggers `before-quit` (e.g. the user closes the last
// window on macOS via Cmd+Q, or a future feature calls `app.quit()`
// directly), we still want to clean up child processes first. We prevent
// the immediate quit, hand control to `quitApp`, and let `app.quit()` fire
// again from inside it once children are gone.
app.on('before-quit', (event) => {
    if (shuttingDown) return
    event.preventDefault()
    quitApp()
})

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
 * spawned and the previous one has been told to terminate (force-killed if
 * needed).
 */
async function restartBackEnd() {
    const previous = serverProcess
    serverProcess = forkBackEnd(currentConfig)
    await waitForSpawn(serverProcess)
    // Do not block the caller on the old fork's death: it will be cleaned
    // up in the background using the same graceful-then-forceful strategy
    // as full shutdown, so a stuck old process can never accumulate.
    if (previous) {
        gracefullyKillChild(previous, 'previous back-end')
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