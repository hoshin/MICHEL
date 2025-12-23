const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const { fork }  = require('child_process')
const serverProcess = fork(__dirname + '/../dist/back/index')
const frontServerProcess = fork(__dirname + '/frontServer.js')

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

function createWindow() {
    win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC, 'logo.svg'), //
        webPreferences: {
            preload: path.join(__dirname, './preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
        },
    })

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

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
        serverProcess.kill()
        frontServerProcess.kill()
    }
})