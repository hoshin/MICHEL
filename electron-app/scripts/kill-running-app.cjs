/**
 * Pre-build safety net: terminate any running instance of the packaged
 * Electron app so that electron-builder can overwrite the files in
 * `win-unpacked/` without hitting `Access is denied` on locked DLLs.
 *
 * - On Windows: runs `taskkill /F /IM MICHELectron.exe /T` (which kills
 *   the executable and its child process tree). Exit code 128 (no such
 *   process) is treated as success, because that just means there was
 *   nothing to kill.
 * - On macOS / Linux: no-op. These platforms do not hold exclusive locks
 *   on executable files the way Windows does, so this whole class of
 *   build failure does not apply.
 *
 * Run automatically by npm as the `prebuild:electron-app` script — you
 * normally do not need to invoke it directly.
 */
const { spawnSync } = require('node:child_process')

const PRODUCT_EXE = 'MICHELectron.exe'

function killOnWindows() {
    const result = spawnSync(
        'taskkill',
        ['/F', '/IM', PRODUCT_EXE, '/T'],
        { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf-8' }
    )

    // 0   => one or more processes killed
    // 128 => no matching processes (treat as success — nothing to do)
    if (result.status === 0) {
        process.stdout.write(
            `[prebuild] Terminated running ${PRODUCT_EXE} instance(s).\n`
        )
        return
    }
    if (result.status === 128) {
        process.stdout.write(
            `[prebuild] No running ${PRODUCT_EXE} instance found. Nothing to do.\n`
        )
        return
    }

    // Any other status: log but do NOT fail the build. The most likely
    // outcome is that electron-builder will succeed anyway, and if it
    // doesn't, the user gets the same `Access is denied` error they would
    // have gotten without this script — no regression.
    process.stderr.write(
        `[prebuild] WARNING: \`taskkill\` exited with status ${result.status}.\n` +
        `[prebuild] stdout: ${result.stdout?.trim()}\n` +
        `[prebuild] stderr: ${result.stderr?.trim()}\n` +
        `[prebuild] Continuing with the build; electron-builder may still fail if files are locked.\n`
    )
}

if (process.platform === 'win32') {
    killOnWindows()
} else {
    process.stdout.write(
        `[prebuild] Platform is ${process.platform}; nothing to do.\n`
    )
}
