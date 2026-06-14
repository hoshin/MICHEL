# michelectron

Electron app that packages the backend and frontend "all in one" for turnkey functionalities.

## Configuration

On startup, the app loads a JSON configuration file from the user's Electron
`userData` directory. If the file does not exist, it is created on first run
with the default values shown below.

### File location

| OS        | Path                                                       |
|-----------|------------------------------------------------------------|
| Windows   | `%APPDATA%\michelectron\config.json`                       |
| macOS (?) | `~/Library/Application Support/michelectron/config.json`   |
| Linux     | `~/.config/michelectron/config.json`                       |

The app calls `app.setName('michelectron')` at startup so the path above is
the same whether you launch the app via `npm start` (i.e. `electron .`) or
from a packaged build. **If you are not sure where the app is looking,
check the main process console output — the resolved configuration path is
logged at startup as `[config] Loading configuration from: ...`.**

### Default schema

```json
{
  "ports": {
    "frontServer": 5173,
    "backServer": 3000
  },
  "debug": false,
  "secrets": {
    "faceItAPIKey": ""
  },
  "preferences": {
    "openDevTools": false
  },
  "overlays": {}
}
```

### Keys

- `ports.frontServer` — Port the bundled front-end Express server listens on.
  Forwarded to `frontServer.js` via the `FRONT_SERVER_PORT` env var. Defaults
  to `5173` if missing or invalid.
- `secrets.faceItAPIKey` — FACEIT API key. Forwarded to the back-end process
  as the `FACEIT_KEY` env var (the back-end already reads
  `process.env.FACEIT_KEY` in `back/handlers/home.ts`).
- `ports.backServer`, `debug`, `preferences.openDevTools`, `overlays` —
  reserved for future use; currently not wired up to any consumer.

### Behavior

- The configuration is read **once at startup**. Most changes require an app
  restart to take effect, the only exception being the change of the FaceIt API key, which will selectively restart what is needed.
- Missing keys in the user file are filled in from the defaults at load
  time, so partial files are safe.
- If the file contains invalid JSON, an error is logged and the app falls
  back to defaults so it still boots.
- The loaded config object is frozen and treated as read-only by the app.

## Shutdown behavior

When the app quits — whether the user closes the window, picks **Quit** in
the menu, or another component calls `app.quit()` — the main process
shuts down the forked back-end and front-server child processes using a
graceful-then-forceful strategy:

1. **SIGTERM** is sent to each child to let it clean up.
2. If the child has not exited after **1.5 seconds**, the main process
   sends **SIGKILL** (on Windows: `TerminateProcess`), which the OS cannot
   refuse.
3. Once all children are gone, Electron itself quits.

This is to prevent the orphan-process accumulation that used to happen on
Windows when `child.kill()` alone was unreliable. If you ever see a
warning like
`[main] back-end did not exit within 1500 ms; sending SIGKILL.` in the
main process console, it means the back-end took too long to clean up and
was force-killed — the app still exits cleanly.

## Setting the FACEIT API key from inside the app

If you do not want to edit `config.json` by hand, the desktop app provides
a small Settings dialog for the FACEIT API key:

1. In the M.I.C.H.E.L. desktop app, open the **Actions** menu →
   **Settings...** (or press **Ctrl + ,**).
2. A small Settings window appears.
3. Paste your key into the **Key** field. The field is masked by default;
   tick **Show key** if you want to verify what you pasted.
4. Click **Save**.

When you save, the app:

- Writes the new key to `config.json` in the user data folder (see paths
  above) so it persists across restarts.
- Restarts the back-end process with the new key.
- Reloads the main window so it reconnects its WebSocket to the freshly
  restarted back-end. The front-end serving layer itself is left running.

You do not need to restart the whole app. The reload takes about a
second, after which FACEIT-backed actions immediately use the new key.

> **Note:** because the back-end is restarted, any series data the
> back-end was holding in memory (current scores, map count, bans, etc.)
> is reset to defaults. Save the FACEIT key before starting a match, not
> during one (though this would be strange, but better safe than sorry).

The Settings dialog is part of the desktop app itself, not the front-end.
If you open one of the overlay pages in a regular browser (for example to
use the overlays in OBS) there is no Settings dialog there — but you also
do not need one, because the desktop app is what feeds the embedded back-end with
the key. Browser-only setups can still edit `config.json` directly using
the steps in the troubleshooting section below.

## Troubleshooting

### The app does not seem to use my configuration / FACEIT actions fail even though my key is correct

If actions that need the FACEIT API key are not working, the most likely
cause is that the app is not actually reading the `config.json` file you
expect it to read — typically because it was placed in the wrong folder, or
saved with the wrong file extension (e.g. `config.json.txt` because Windows
hides known extensions by default).

#### What the config file should look like

The file must be named exactly `config.json` (no `.txt`, no `.json.json`)
and contain valid JSON. Here is a complete, real-world example with every
currently-supported key filled in:

```json
{
  "ports": {
    "frontServer": 5173,
    "backServer": 3000
  },
  "debug": false,
  "secrets": {
    "faceItAPIKey": "abcdef12-3456-7890-abcd-ef1234567890"
  },
  "preferences": {
    "openDevTools": false
  },
  "overlays": {}
}
```

You only really need the `secrets.faceItAPIKey` entry for FACEIT-backed
actions to work. The smallest possible valid file is:

```json
{
  "secrets": {
    "faceItAPIKey": "abcdef12-3456-7890-abcd-ef1234567890"
  }
}
```

Any keys you leave out will fall back to their built-in defaults.

#### Where to place the file (Windows — explained step by step)

> Note: This is only needed if you want to get fancy, understand where the file is, and mess around with the config to see what happens.
If you only need to update your FaceIt API key, you can achieve this through the app's "Settings" menu

On Windows, the app looks for the file in a folder called `michelectron`
inside the special "Roaming" folder, which is hidden away in your user
profile. You will often see this folder written as `%APPDATA%\michelectron`.

What is `%APPDATA%`? It is a **shortcut name** that Windows uses to point to
the right folder for the user currently logged in. Instead of typing out
the long path `C:\Users\<your-user-name>\AppData\Roaming`, you can just
type `%APPDATA%` and Windows will translate it for you. The folder is
hidden by default in File Explorer, which is why a "magic shortcut" exists
in the first place.

Here is the safest, click-by-click way to get there and create the file
correctly:

1. Press **Windows key + R** on your keyboard. A small "Run" dialog box
   appears in the bottom-left corner of the screen.
2. In that box, type exactly:

   ```powershell
   %APPDATA%
   ```

   Then press **Enter**. A File Explorer window opens, already inside the
   correct `Roaming` folder. You do **not** need to know or type the real
   path — Windows does it for you.
3. In that window, look for a folder called `michelectron`. Two cases:
   - **It already exists** (the app has been started at least once): open it.
   - **It does not exist yet**: right-click in the empty space → **New →
     Folder** → name it exactly `michelectron` (all lowercase, no spaces)
     → open it.
4. Inside `michelectron`, create a new text file:
   right-click in the empty space → **New → Text Document**. Windows will
   create a file called `New Text Document.txt`.
5. **Important — make file extensions visible first**, otherwise the next
   step will silently fail:
   - In the File Explorer window, click the **View** menu at the top →
     **Show** → tick **File name extensions**.
   - You should now see the `.txt` part at the end of the file name.
6. Rename `New Text Document.txt` to exactly `config.json` (replace the
   `.txt` extension with `.json`). Windows will warn you that changing the
   extension may make the file unusable — click **Yes**. The file name in
   File Explorer must now read `config.json`, not `config.json.txt` and
   not `config.txt`.
7. Right-click `config.json` → **Open with** → **Notepad** (or any text
   editor). Paste the example JSON from above, replace the
   `faceItAPIKey` value with your real key, and save the file
   (**Ctrl + S**).
8. Fully close the M.I.C.H.E.L. app (use the menu's **Quit** entry, do not
   just close the window if the app was already running) and start it
   again. Configuration is only read once at startup.

#### How to confirm the app is reading your file

The app logs the exact path it is reading at startup. In the main process
console (the terminal where you ran `npm start`, or the log output of the
packaged app) you should see a line like:

```text
[config] Loading configuration from: C:\Users\<you>\AppData\Roaming\michelectron\config.json
[config] Loaded existing configuration file.
```

If the second line says "Created default configuration file at ..."
instead, it means your file was not found at that location — double-check
the folder name, the file name, and that the extension is really `.json`
(not `.json.txt`).

### Build error: "Access is denied" on `d3dcompiler_47.dll` / `ffmpeg.dll` / other DLLs (Windows)

When building the Electron app on Windows you may see something like:

```text
⨯ remove ...\dist\electron-release-build\win-unpacked\d3dcompiler_47.dll: Access is denied.
```

#### Cause

`electron-builder` tries to wipe the `win-unpacked/` folder before writing
the new build into it. If a previously built `MICHELectron.exe` (or one of
its forked back-end / front-server child processes) is still running,
Windows refuses to delete the DLLs they have open, and the build aborts.

#### Built-in safety net

This repository ships a small pre-build script that runs automatically
before `build:electron-app`:

```sh
node ./electron-app/scripts/kill-running-app.cjs
```

npm picks it up via the standard `prebuild:electron-app` hook, so it also
runs as part of `build:all`. On Windows the script invokes
`taskkill /F /IM MICHELectron.exe /T` and treats both "killed something"
and "nothing to kill" as success, so the build always proceeds. On macOS
and Linux it is a no-op (file locking on those platforms does not cause
this class of failure).

#### What to do if it still happens

If you somehow hit the error anyway (for example: you ran
`npx electron-builder` directly, bypassing the npm script):

1. Open Task Manager and end any **`MICHELectron.exe`** processes.
   Alternatively, from a terminal: `taskkill /F /IM MICHELectron.exe /T`.
2. Re-run the build.

The runtime shutdown logic (see [Shutdown behavior](#shutdown-behavior)
above) is also designed to prevent orphan processes from accumulating in
the first place, so this should only ever be an issue across very old
installs that were built before that hardening landed.

### Build error: "Cannot create symbolic link : A required privilege is not held by the client" (Windows)

When building the Electron app on Windows, you may see an error like:

```text
ERROR: Cannot create symbolic link : A required privilege is not held by the client. :
  C:\Users\<you>\AppData\Local\electron-builder\Cache\winCodeSign\<version>\darwin\10.12\lib\libcrypto.dylib
ERROR: Cannot create symbolic link : A required privilege is not held by the client. :
  C:\Users\<you>\AppData\Local\electron-builder\Cache\winCodeSign\<version>\darwin\10.12\lib\libssl.dylib
```

#### Cause

`electron-builder` downloads a `winCodeSign` archive that contains symbolic
links (the `darwin/.../lib/libcrypto.dylib` and `libssl.dylib` entries).
Creating symlinks on Windows is a privileged operation by default, so
extraction fails under a standard (non-elevated) user account that does not
hold `SeCreateSymbolicLinkPrivilege`. The `darwin` files are not actually
needed for a Windows build, but the extraction aborting on them kills the
build.

#### Fix: enable Developer Mode

Turning on Windows Developer Mode grants your user account the right to
create symbolic links, so the extraction succeeds without needing an
elevated shell.

On Windows 11:

1. Open **Settings → System → For developers**
   (depending on your Windows 11 version it may also appear under
   **Settings → Privacy & security → For developers**).
2. Turn the **Developer Mode** toggle **On**.
3. Re-run the build.

Once Developer Mode is on, the build should complete and `electron-builder`
will cache the extracted `winCodeSign` package at
`%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\<version>\`, so this
particular extraction step won't run again until `electron-builder` pulls a
new `winCodeSign` version.
