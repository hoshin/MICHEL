const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')

const { app: wrappedApp, server: wrappedServer } = require('../back/wrapper')

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

// const createWindow = () => {
//     const win = new BrowserWindow({
//         width: 800,
//         height: 600,
//         webPreferences: {
//             preload: path.join(__dirname, 'preload.js')
//         }
//     })
//
//     win.loadFile('index.html')
// }

process.env.DIST = path.join(__dirname, '../front/client-app/dist')
process.env.VITE_PUBLIC = app.isPackaged
    ? process.env.DIST
    : path.join(process.env.DIST, '../public')

if (!app.requestSingleInstanceLock()) {
    app.quit()
    process.exit(0)
}

let win

function createWindow() {
    console.log('>>>>>>>>>>', process.env.DIST)
    win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC, 'logo.svg'), //
        webPreferences: {
            preload: path.join(__dirname, './preload.js'),
        },
    })

    // Test active push message to Renderer-process.
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL)
        win.webContents.openDevTools()
    } else {
        // win.loadFile('dist/index.html')
        console.log('>>>>>>>>>> LOADFILE', path.join(process.env.DIST, 'index.html'))
        win.loadFile(path.join(process.env.DIST, 'index.html'))
    }
}

app.whenReady().then(() => {
    // ipcMain.handle('ping', () => 'pong')
    createWindow()
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
    }
})