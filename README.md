# M.I.C.H.E.L.
Management Interface for Casting Hosts Enjoying Lightness

## Foreword / Caution

THIS IS NOT PRODUCTION READY - I cannot stress that enough

This is still very much a personal tool, with all the issues that come with it. I am building it as I go, following the requirements of the moment, but I feel that it can start being a tool to play around for others also.
This still has plenty of kinks, but it works fine for me at this point. I still want to add features, upgrade the code, harden it, do a better job at testing everything ... but it displays the information I need and reacts correctly, without crashing, during my casts :')

THIS IS NOT PRODUCTION READY - ... one more for the road

This README is a bit out of date but the bigger pieces are there. If you're interested in this but cannot quite figure how to get it running : I'm interested and will do my best to help (providing we can manage time).

## Description and purpose
MICHEL is a personal tool, first and foremost, aimed at helping around someone who'd like to get into casting e-sports matches but feels like there's way too much alt-tabbing going around. It probably won't fit every need, but I'll be glad to accept PRs if it comes to this :)

The idea is to set the match up beforehand and then pilot everything through a device like a StreamDeck (or anything that can send calls to the main app)

### Features

#### Keep the core data of a match between 2 teams and allow dynamically shared updates as it goes down
Allows to manually input
* Names / logos of the 2 teams playing
* Match format / Round number
* Update scores as you go
* Add a tournament logo
* Utilities 
  * swap the order in which teams will be displayed
  * _(FaceIt only) load room data_ (updates team names & logos)
  * _(FaceIt only) refresh room data_
  
![management-interface.png](documentation/management-interface.png)
Note: yes, it's ugly af, I needed features before tying a bow on that one. We'll get there ... eventually ^^'

#### Query the FaceIt API to retrieve advanced data on a match
MICHEL's integration is currently focused on the Overwatch 2 game integration of FaceIt. It allows to retrieve extra data : 
* Automatically set teams names and logos up using the lobby ID
* Bans for the current map of a match
* Refresh bans if need be (getting bans is a bit finicky atm)

#### Expose ready-to-use templated HTML pages that can be used in AV mixers (like OBS)
The `michel-client-app` part allows to generate calibrated pages that can then be used as an [OBS](https://obsproject.com/) "web source"
![base-template-1.png](documentation/base-template-1.png)

This specific app connects to the websocket exposed by `michel-back` so whatever updates the back receives it'll be sent to the connected "consumers" and update immediately.
![obs-scene-integration.png](documentation/obs-scene-integration.png)

#### Propose a All in one approach through an Electron app
Put simply, the electron app is an executable that bundles both `michel-back` and `michel-client-app`. You can't update anything, but running the app will run all required servers so that
* You have at least a management interface available
* `michel-back` is started
* `michel-client-app` is started too
* the default templates are made accessible to be used as web sources in software like OBS

#### Have a way to update scores, round # and switch sides from a StreamDeck
The provided plugin, once installed will enable you to : 
* Increase/Decrease the score of both teams
* Increase/Decrease the round #
* Swap the positions of the teams (aka: "which one gets displayed on the left VS right")

It's still a bit rough around the edges so it's not published on the marketplace and will need to be installed manually (double-clicking on the plugin should do the trick)

### Getting started
#### I just want the base experience
The bundled app should be right up your alley!
1. Double click it to start it
2. Once the management interface comes up, you should be ready to go
3. To integrate scenes in your AV mixer, add the following (depending on your needs) as a web source :
   * `localhost:5172/game-scene` => The main ingame scene
   * `localhost:5172/score-scene` => A scene only containing the scores of the 2 teams, with logos and names
   * `localhost:5172/casters-scene` => A backdrop for an "out of game" scene (typically to show chat / casters)
   * `localhost:5172/configuration-center` => The configuration page, if the app itself does not work for you or you want a second interface

#### I want to create my own scenes / run all services separately and customize my experience
For the time being, you can still use the bundled app to start the main server. You will need to build your own client application and run it on your own.

In order to be able to connect to that instance of `michel-back` with your own frontend you'll need to refer to its [README.md](back/README.md)

### General architecture
![img.png](documentation/general-architecture.png)

#### Long story short
* If you want to get fancy, the process you absolutely need to run is `michel-back`
* The "All in one" way is through `michelectron`, which'll take care of everything once built
* `michel-client-app` is basically a front-end I built on top of `michel-back`
* `michel-streamdeck-plugin` is just a very simple plugin to pilot `michel-back` from a stream deck

#### Long story longer
I wanted to separate concerns as much as possible. Mostly because not everyone has the same taste as I do when it comes to interfaces for a stream

## Building the Electron app

The "All in one" executable (`michelectron`) is packaged using [`electron-builder`](https://www.electron.build/). Its configuration lives in the `build` block of the root `package.json`, alongside the scripts described below.

### Prerequisites
- Node.js 20+
- `npm ci` in the root, then in each workspace: `back/`, `front/client-app/`, `electron-app/`, and `stream-deck-plugin/michel-deck/` (the last one is only needed for the Windows build).
- The backend and frontend must be built before packaging — the electron app embeds their `dist/` outputs.
- For Linux RPM packages built locally, the `rpm` CLI must be available on the host.

### Build scripts (root `package.json`)

Run these from the repository root.

| Script | What it does | Output (in `dist/electron-release-build/`) |
|---|---|---|
| `npm run build:clean` | Removes `dist/` and `release-builds/`. | — |
| `npm run build:back` | Compiles `michel-back` into `dist/back/`. | — |
| `npm run build:front` | Builds `michel-client-app` into `dist/front/`. | — |
| `npm run build:streamdeck-plugin` | Packages the Stream Deck plugin (Windows only — uses `build-and-package:win`). | `stream-deck-plugin/.../com.hoshin-casts.michel-deck.streamDeckPlugin` |
| `npm run build:electron-app` | Runs `electron-builder` for the host OS using its default target list. | Native installer(s) for the current OS. |
| `npm run build:electron-app:win` | Builds Windows x64 only. | `MICHELectron Setup <version>.exe` (NSIS installer) + `.blockmap` + `latest.yml`. |
| `npm run build:electron-app:linux` | Builds Linux x64 only. | `MICHELectron-<version>.AppImage`, `michelectron_<version>_amd64.deb`, `michelectron-<version>.x86_64.rpm`. |
| `npm run build:electron-app:mac` | Builds macOS x64 + arm64 (unsigned). | `MICHELectron-<version>-mac.zip` and `MICHELectron-<version>-arm64-mac.zip`. |
| `npm run build:all` | Runs `clean` → `back` → `front` → `streamdeck-plugin` → `electron-app` end to end. | All of the above for the host OS. |

Notes:
- macOS builds are produced **unsigned** (`identity: null`, `CSC_IDENTITY_AUTO_DISCOVERY=false`). Distributing them outside personal use will require an Apple Developer ID and notarization.
- The `icon` is currently `electron-app/images/logo_56.png`. It is intentionally low-res for now; `electron-builder` will emit warnings about the icon size in Linux/Mac builds but the build still succeeds.

### Building all three platforms from one machine

`electron-builder` can cross-compile, but **macOS targets can only be produced on a Mac** (without that you'd get an unsigned zip at best, and `.dmg`/signing won't work at all). For Windows/Linux/macOS coverage without juggling VMs locally, the project relies on the GitHub Actions matrix described below.

### GitHub Actions release workflow

The workflow lives at `.github/workflows/release.yml`.

#### Triggers
- **Push of a `v*` tag** (e.g. `git tag v1.2.0 && git push --tags`) — runs the full matrix and publishes a GitHub Release.
- **Manual `workflow_dispatch`** — runs the build matrix and uploads artifacts, but does **not** create a Release.

#### Build matrix
Three parallel jobs, one per host OS:

| Job | Runner | Script invoked | Stream Deck plugin built? | Artifact name |
|---|---|---|---|---|
| Windows build | `windows-latest` | `build:electron-app:win` | yes | `michel-windows` |
| Linux build | `ubuntu-latest` | `build:electron-app:linux` | no | `michel-linux` |
| macOS build | `macos-latest` | `build:electron-app:mac` | no | `michel-mac` |

Each job:
1. Checks out the repo.
2. Sets up Node 20 with npm cache.
3. On Linux, installs `rpm` for RPM packaging.
4. Runs `npm ci` for the root and each workspace (`back/`, `front/client-app/`, `electron-app/`, and `stream-deck-plugin/michel-deck/` only on Windows).
5. Runs `build:clean`, `build:back`, `build:front`.
6. Runs `build:streamdeck-plugin` (Windows only).
7. Runs the platform-specific `build:electron-app:*` script.
8. Uploads the produced installers/packages as a workflow artifact (`.exe`, `.AppImage`, `.deb`, `.rpm`, `.zip`, `.dmg`, plus `.blockmap` and `latest*.yml` when present).

#### Release job
After all three matrix jobs succeed, and **only if the trigger was a `v*` tag**, a final `release` job:
1. Downloads every artifact uploaded by the build matrix.
2. Uses [`softprops/action-gh-release@v2`](https://github.com/softprops/action-gh-release) to create a public GitHub Release named after the tag, with auto-generated release notes, and attaches every artifact (Win installer, Linux AppImage/deb/rpm, Mac zips for both x64 and arm64) to it.

#### Cutting a new release in practice
```bash
# Bump the version in package.json first
git add package.json
git commit -m "release: v1.2.0"
git tag v1.2.0
git push origin main --tags
```
Then watch the workflow in the GitHub Actions tab; once it finishes, the Release will be available with all platform binaries attached.

## License
This work is licensed under the [CC-BY-NC](https://creativecommons.org/licenses/by-nc/4.0/).