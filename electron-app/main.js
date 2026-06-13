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
// Becomes true once the initial startup coordination has fired the
// `forks-ready` IPC for the first time. From that point on, any subsequent
// `did-finish-load` (i.e. a renderer reload) gets its own immediate
// `forks-ready` so the preload's loading overlay clears without waiting
// for its 5 s fallback.
let initialLoadCompleted = false

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
        width: 580,
        height: 460,
        useContentSize: true,
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
        // Subsequent loads (e.g. after restartBackEnd reloads the renderer)
        // need their own forks-ready signal so the preload's loading
        // overlay dismisses immediately instead of waiting for the 5 s
        // fallback. The very first did-finish-load is handled separately
        // by the whenReady coordination below, which also gates on the
        // forks having been spawned.
        if (initialLoadCompleted) {
            win?.webContents.send('forks-ready')
        }
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
 * Kill the current back-end fork (if any), re-fork it with the current
 * configuration, and reload the main renderer so that it drops its now-stale
 * WebSocket connection and reopens a fresh one against the new back-end.
 *
 * Resolves once the new fork has spawned. The old fork is taken down
 * FIRST so that it releases its TCP port before the new fork tries to
 * bind — otherwise the new fork could crash with EADDRINUSE. The
 * graceful-then-forceful kill bounds the worst-case wait to
 * CHILD_SHUTDOWN_TIMEOUT_MS (1.5 s).
 */
async function restartBackEnd() {
    const previous = serverProcess
    serverProcess = null

    if (previous) {
        await gracefullyKillChild(previous, 'previous back-end')
    }

    serverProcess = forkBackEnd(currentConfig)
    await waitForSpawn(serverProcess)

    // The renderer opens its WebSocket against the back-end at module-load
    // time and has no built-in reconnect logic, so without a reload it
    // would stay tied to the dead socket of the old fork. A reload is the
    // simplest way to give it a fresh connection. The front server is left
    // alone — it serves only static assets, so it does not need to be
    // restarted to pick up the new configuration.
    if (win && !win.isDestroyed()) {
        win.webContents.reload()
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
        initialLoadCompleted = true
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
       quitApp()
    }
})