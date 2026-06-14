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

        // Declared up front so that finish() never observes `timer` in the
        // temporal dead zone — even if `child.once('exit', …)` fires
        // synchronously inside `child.kill` or if the kill call throws
        // before the setTimeout below is reached.
        let timer = null
        let settled = false
        const finish = () => {
            if (settled) return
            settled = true
            if (timer !== null) {
                clearTimeout(timer)
            }
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

        timer = setTimeout(() => {
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
            label: 'Debug/Tooling',
                submenu: [
                    { role: 'reload' },
                    { role: 'forceReload' },
                    { type: 'separator' },
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

// Bound for waitForSpawn's safety-net timer. A successful fork normally
// emits 'spawn' within a few tens of ms; 5 s is generous headroom and short
// enough that a broken fork does not freeze app startup or settings saves
// indefinitely.
const FORK_SPAWN_TIMEOUT_MS = 5000

/**
 * Resolve when a freshly-forked child reports it has actually started,
 * reject when it fails to do so. Listens to 'spawn', 'error' and 'exit'
 * (any of which can fire first depending on how the fork goes wrong), and
 * adds a {@link FORK_SPAWN_TIMEOUT_MS} safety-net so a child that hangs
 * before announcing itself can't stall startup or settings saves
 * indefinitely. All three listeners and the timer are torn down on the
 * first event via {@link cleanup}.
 *
 * Rejection lets callers (`whenReady` startup, `restartBackEnd`)
 * distinguish "the fork is alive" from "the fork failed", instead of
 * having to inspect `child.pid` / `child.exitCode` after the fact. Both
 * current callers explicitly handle rejection (they log and recover
 * gracefully) — see `app.whenReady` and `restartBackEnd` below.
 *
 * The fast path for an already-spawned child (non-null `child.pid`) still
 * resolves synchronously and registers no listeners.
 *
 * @param {import('child_process').ChildProcess} child
 * @returns {Promise<void>} resolves on 'spawn'; rejects on 'error',
 *   pre-spawn 'exit', or {@link FORK_SPAWN_TIMEOUT_MS} expiry.
 */
function waitForSpawn(child) {
    return new Promise((resolve, reject) => {
        if (child.pid) {
            resolve()
            return
        }

        let settled = false
        let timer = null
        const cleanup = () => {
            child.off('spawn', onSpawn)
            child.off('error', onError)
            child.off('exit', onExit)
            if (timer !== null) {
                clearTimeout(timer)
            }
        }
        const settle = (err) => {
            if (settled) return
            settled = true
            cleanup()
            if (err) {
                reject(err)
            } else {
                resolve()
            }
        }

        const onSpawn = () => settle()
        const onError = (err) => {
            console.error('[main] Fork failed to spawn.', err)
            settle(err instanceof Error ? err : new Error(String(err)))
        }
        const onExit = (code, signal) => {
            const message = `Fork exited before spawning (code=${code}, signal=${signal}).`
            console.error(`[main] ${message}`)
            settle(new Error(message))
        }

        child.once('spawn', onSpawn)
        child.once('error', onError)
        child.once('exit', onExit)

        timer = setTimeout(() => {
            const message = `Fork did not spawn within ${FORK_SPAWN_TIMEOUT_MS} ms.`
            console.warn(`[main] ${message}`)
            settle(new Error(message))
        }, FORK_SPAWN_TIMEOUT_MS)
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
    if(shuttingDown) return // exit early if this was triggered concurrently to an app shutdown (basically let the shutdown run its course)
    const previous = serverProcess
    serverProcess = null

    if (previous) {
        await gracefullyKillChild(previous, 'previous back-end')
    }
    if(shuttingDown) return // exit early if this was triggered concurrently to an app shutdown (basically let the shutdown run its course)

    serverProcess = forkBackEnd(currentConfig)
    try {
        await waitForSpawn(serverProcess)
    } catch (err) {
        // The new fork never came up. Tear down whatever child handle we
        // got, drop the stale reference, and propagate so the caller (the
        // settings IPC handler) can surface the failure to the user
        // instead of silently reloading the renderer against a dead
        // back-end.
        console.error('[main] Replacement back-end fork failed to spawn.', err)
        await gracefullyKillChild(serverProcess, 'failed back-end')
        serverProcess = null
        throw err
    }

    // Prevent some race condition where a shutdown could've been initialized as this function already started
    // spawning a serverProcess. We did not exit early enough, so we clean things up to avoid zombies
    if (shuttingDown) {
        await gracefullyKillChild(serverProcess, 'back-end spawned during shutdown')
        serverProcess = null
        return
    }

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

/**
 * Returns true when an incoming IPC event was emitted by the Settings
 * window's renderer. The FACEIT key handlers below are the only path
 * through which the key leaves (or enters) the main process, so we gate
 * them on the caller's identity rather than trusting any renderer that
 * happens to know the channel name.
 *
 * @param {Electron.IpcMainInvokeEvent} event
 * @returns {boolean}
 */
function isFromSettingsWindow(event) {
    return Boolean(
        settingsWin &&
        !settingsWin.isDestroyed() &&
        event?.sender === settingsWin.webContents
    )
}

// Settings window asks for the current FACEIT key so it can pre-fill the
// input field. Any other renderer gets an empty string.
ipcMain.handle('settings:get-faceit-key', (event) => {
    if (!isFromSettingsWindow(event)) {
        console.warn('[main] Rejected settings:get-faceit-key from untrusted sender.')
        return ''
    }
    return currentConfig?.secrets?.faceItAPIKey ?? ''
})

// Settings window pushes a new FACEIT API key. We persist it, refresh the
// in-memory config, then restart the back-end fork so the new key takes
// effect without the user having to restart the whole app. Requests from
// any other renderer are rejected before touching the filesystem or the
// back-end fork.
ipcMain.handle('settings:set-faceit-key', async (event, rawKey) => {
    if (!isFromSettingsWindow(event)) {
        console.warn('[main] Rejected settings:set-faceit-key from untrusted sender.')
        return { ok: false, error: 'unauthorized' }
    }
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

    // `waitForSpawn` rejects when a fork fails to come up. If we let those
    // rejections through to `Promise.all`, the chained `.then` below would
    // never run AND the rejection would become an unhandled-promise
    // rejection that crashes the app. Catching here lets startup continue:
    // the user gets the window, the preload's own ~5 s overlay fallback
    // dismisses the loading screen, and any subsequent WebSocket errors
    // make the broken-fork situation visible from the renderer.
    const forksReady = Promise.all([
        waitForSpawn(serverProcess),
        waitForSpawn(frontServerProcess),
    ]).catch((err) => {
        console.error('[main] One or more forks failed to spawn during startup.', err)
        return false
    })

    createWindow()

    const rendererReady = new Promise((resolve) => {
        win.webContents.once('did-finish-load', resolve)
    })

    Promise.all([forksReady, rendererReady]).then(([forksOk]) => {
        // Only signal the renderer that the back-end is reachable when
        // both forks actually spawned. Skipping the IPC on failure lets
        // the preload's overlay timeout fall through naturally instead
        // of falsely telling the renderer that everything is healthy.
        if (forksOk !== false) {
            win?.webContents.send('forks-ready')
        }
        initialLoadCompleted = true
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
       quitApp()
    }
})