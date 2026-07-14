/**
 * Force Chromium to use GTK 3 on Linux.
 *
 * Electron 36 (Chromium 136) defaults to GTK 4, whose initialization fails to
 * create a window on many Linux setups, leaving a double-clicked package
 * silently unable to launch. Appending `--gtk-version=3` restores the
 * previous, stable behaviour. GTK 3 remains fully supported in Electron 36.
 *
 * Must be called before `app.whenReady()` — command-line switches have to be
 * set before the GPU/window process starts.
 *
 * @param {import('electron').App} app
 * @param {NodeJS.Platform} [platform] - injectable for testing
 */
function applyLinuxGtkWorkaround(app, platform = process.platform) {
    if (platform === 'linux') {
        app.commandLine.appendSwitch('gtk-version', '3')
    }
}

module.exports = { applyLinuxGtkWorkaround }
