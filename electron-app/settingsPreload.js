const { contextBridge, ipcRenderer } = require('electron')

// Minimal preload script for the Settings window. Only exposes the IPC
// surface needed by settings.html.
try {
    contextBridge.exposeInMainWorld('michelSettings', {
        getCurrentFaceItKey: () => ipcRenderer.invoke('settings:get-faceit-key'),
        saveFaceItKey: (key) => ipcRenderer.invoke('settings:set-faceit-key', key),
        close: () => ipcRenderer.send('settings:close'),
    })
    console.log('[settingsPreload] window.michelSettings bridge exposed')
} catch (err) {
    console.error('[settingsPreload] Failed to expose window.michelSettings.', err)
}
