import * as fs from "fs"

import pino from "pino"
import type {Logger} from "pino"
import * as path from "node:path"

import {FaceItClient} from "../lib/faceItClient.js"

type TeamDescription = {
    name: string,
    score: number,
    logo: string
}
type MapFormat = 'FT1' | 'FT2' | 'FT3' | 'FT4' | 'FT5' | 'BO1' | 'BO3' | 'BO5' | 'BO7'
type GeneralMatchInformation = {
    right: string,
    left: string,
    mapCount: number,
    customCounter: number,
    mapFormat: MapFormat,
    tournamentLogo: string,
    optionalLogoDisplay: boolean,
    // Countdown timer driven by the back-end. `value` is the remaining
    // seconds, `running` is true while the per-second tick is active. The
    // back-end owns the tick (rather than the renderer that started it) so
    // that overlays see a consistent value, the timer survives a Config
    // Center page reload, and OBS browser sources never have to share
    // state with another browsing context.
    countdown?: number,
    countdownRunning?: boolean,
    // CSS color string used by the <CountdownTimer /> component. Empty
    // string means "fall back to the component's CSS default".
    countdownColor?: string
}
type BanData = {
    heroImage?: string,
    heroName?: string,
}
export type SeriesData = {
    team1: TeamDescription,
    team2: TeamDescription,
    display: GeneralMatchInformation,
    faceIt: {
        matchId: string,
        raw?: any
        apiKey?: string,
    },
    standings: {
        [mapId: string]: {
            map?: { selectedBy: string, image: string, name: string, },
            attacker?: { selectedBy: any, attackingFirst: any },
            bans: {
                team1: BanData,
                team2: BanData,
            }
        }
    }
}
export const DEFAULT_SERIES_DATA: SeriesData = {
    team1: {
        name: '',
        score: 0,
        logo: ''
    },
    team2: {
        name: '',
        score: 0,
        logo: ''
    },
    display: {
        right: 'team1',
        left: 'team2',
        mapCount: 1,
        customCounter: 0,
        mapFormat: 'FT3',
        tournamentLogo: '',
        optionalLogoDisplay: true,
        countdown: 0,
        countdownRunning: false,
        countdownColor: ''
    },
    faceIt: {
        matchId: '',
    },
    standings: {}
}

process.env.MICH_LOG_PATH = './'

export class MichelBackService {
    private connectionPool: any
    private debug: boolean
    private seriesData: SeriesData
    private logger: Logger
    private faceItApiKeyFromConfigFile: string | undefined
    private faceItClient: FaceItClient
    // Server-owned 1 s tick for the countdown. We hold a reference here so
    // that pause / reset / a new start can replace any running interval
    // without leaking timers. Reset to null whenever the countdown stops.
    // Centralized to allow multiple views to share the same countdown timer and guarantee sync
    private countdownTimer: ReturnType<typeof setInterval> | null = null

    constructor(connectionPool, debug: boolean, seriesData?: SeriesData, logger?: Logger, faceItClient?: FaceItClient) {
        this.connectionPool = connectionPool
        this.seriesData = seriesData ?? structuredClone(DEFAULT_SERIES_DATA)
        this.debug = debug
        const fileTransport = pino.transport({
            target: 'pino/file',
            options: {destination: `${process.env.MICH_LOG_PATH}/app.log`},
        })

        this.logger = logger || pino(
            {
                level: process.env.PINO_LOG_LEVEL || 'info',
                formatters: {
                    level: (label) => {
                        return {level: label.toUpperCase()}
                    },
                },
                timestamp: pino.stdTimeFunctions.isoTime,
            },
            fileTransport
        )

        try {
            const configFilePath = path.resolve(process.env.CONFIGFILE_PATH || __dirname + '/../config.json')
            this.logger.info({msg: 'Config file present -> updating seriesData', path: configFilePath})
            const configFile = JSON.parse(fs.readFileSync(configFilePath).toString())
            const seriesDataFromConfigFile: SeriesData = configFile.seriesData
            if (!seriesData) {
                this.seriesData = seriesDataFromConfigFile
            }
            this.faceItApiKeyFromConfigFile = seriesDataFromConfigFile?.faceIt?.apiKey
        } catch (error) {
            this.logger.warn({
                msg: 'No valid config file found! Initializing seriesData with default values.',
                error: error.message
            })
        }

        this.faceItClient = faceItClient ?? new FaceItClient({
            logger: this.logger,
            configFileApiKey: this.faceItApiKeyFromConfigFile,
        })
    }

    updateConnectionPool(socket) {
        this.connectionPool.push(socket)
    }

    /**
     * Parses an incoming WebSocket message buffer, dispatches it to the appropriate
     * state-mutating method, then calls `broadcastState` once to broadcast
     * the resulting state to all connected clients.
     * Unrecognised commands result in a no-op broadcast of the current state.
     *
     * @param payloadAsBuffer - Raw UTF-8 buffer received from the WebSocket containing a JSON object with at least a `command` string field, and optionally a `value` field.
     */
    async handleCommand(payloadAsBuffer: Buffer) {
        const payload = JSON.parse(payloadAsBuffer.toString('utf8'))
        if (this.debug) {
            this.logger.info({msg: '[DEBUG] Incoming command: ', payload})
        }
        switch (payload.command) {
            case 'increaseTeam1Score':
                this.teamIncrementScore('team1', 1);
                break;
            case 'increaseTeam2Score':
                this.teamIncrementScore('team2', 1);
                break;
            case 'decreaseTeam1Score':
                this.teamIncrementScore('team1', -1);
                break;
            case 'decreaseTeam2Score':
                this.teamIncrementScore('team2', -1);
                break;
            case 'updateTeam1Name':
                this.teamUpdateName('team1', payload.value);
                break;
            case 'updateTeam2Name':
                this.teamUpdateName('team2', payload.value);
                break;
            case 'swapTeams':
                this.swapTeams();
                break;
            case 'increaseMapCount':
                this.updateMapCountAndRefreshFaceItDataIfNeeded(1);
                break;
            case 'decreaseMapCount':
                this.updateMapCountAndRefreshFaceItDataIfNeeded(-1);
                break;
            case 'updateMapFormat':
                this.updateMapFormat(payload.value);
                break;
            case 'updateTeam1Logo':
                this.updateTeamLogo('team1', payload.value);
                break;
            case 'updateTeam2Logo':
                this.updateTeamLogo('team2', payload.value);
                break;
            case 'updateTournamentLogo':
                this.updateTournamentLogo(payload.value);
                break;
            case 'toggleOptionalLogoDisplay':
                this.toggleOptionalLogoDisplay();
                break;
            case 'updateFromMatchId':
                await this.initialMatchDataFromFaceItMatchId(payload.value);
                break;
            case 'fetchFaceItMatchUpdates':
                await this.fetchFaceItMatchUpdates(payload.value);
                break;
            case 'increaseCustomCounter':
                this.increaseCustomCounter();
                break;
            case 'decreaseCustomCounter':
                this.decreaseCustomCounter();
                break;
            case 'team1UpdateBan':
                this.teamUpdateBan('team1', payload.value);
                break;
            case 'team2UpdateBan':
                this.teamUpdateBan('team2', payload.value);
                break;
            case 'setMapCount':
                this.setMapCount(payload.value);
                break;
            case 'catchup':
                await this.catchup(payload.value);
                break;
            case 'countdownSet':
                // Update the displayed value without running the timer
                // (e.g. user dragged the slider while the timer was idle).
                this.countdownSet(payload.value);
                break;
            case 'countdownStart':
                this.countdownStart(payload.value);
                break;
            case 'countdownPause':
                this.countdownPause();
                break;
            case 'countdownResume':
                this.countdownResume();
                break;
            case 'countdownReset':
                this.countdownReset(payload.value);
                break;
            case 'countdownSetColor':
                this.countdownSetColor(payload.value);
                break;
        }
        this.broadcastState()
    }

    home(): SeriesData {
        return this.seriesData
    }

    broadcastState() {
        if (this.connectionPool) {
            const connectionPoolWithonlyUnclosedSockets = this.connectionPool.filter(socket => !socket._closeFrameReceived)
            if (this.connectionPool.length !== connectionPoolWithonlyUnclosedSockets.length) {
                this.logger.info({msg: `Connection pool cleanup (remove closing / closed sockets): Base - ${this.connectionPool.length} => New - ${connectionPoolWithonlyUnclosedSockets.length}`})
                this.connectionPool = connectionPoolWithonlyUnclosedSockets
            }

            this.connectionPool.forEach(socket => {
                socket.send(JSON.stringify(this.seriesData))
            })
        }
    }

    swapTeams = (): SeriesData => {
        const rightTeam = this.seriesData.display.right
        const leftTeam = this.seriesData.display.left
        this.seriesData.display.right = leftTeam
        this.seriesData.display.left = rightTeam
        if (this.debug) {
            this.logger.info('swapTeams')
        }
        // this.broadcastState()
        return this.seriesData
    }

    teamIncrementScore(teamName: string, increment: number = 1): SeriesData {
        const candidateScore = this.seriesData[teamName].score + increment
        this.seriesData[teamName].score = candidateScore >= 0 ? candidateScore : 0
        if (this.debug) {
            this.logger.info(`${teamName} increment score by ${increment}`)
        }
        return this.seriesData
    }

    teamUpdateName(team: string = 'team1', newName: string): SeriesData {
        if (team === 'team1' || team === 'team2') {
            this.seriesData[team].name = newName
            if (this.debug) {
                this.logger.info(`${team} update name to ${newName}`)
            }
        }
        return this.seriesData
    }

    updateMapFormat = (newFormat: MapFormat): SeriesData => {
        this.seriesData.display.mapFormat = newFormat
        if (this.debug) {
            this.logger.info('updateMapFormat')
        }
        return this.seriesData
    }

    /**
     * Coerce an external countdown input to a safe, non-negative integer
     * number of seconds. Rejects non-finite values (NaN, Infinity, -Infinity)
     * by falling back to 0; without this guard, `Number(value)` could let
     * Infinity through, `Math.floor(Infinity)` stays Infinity, and the
     * resulting setInterval would run forever because `tickCountdown`'s
     * `Infinity - 1 === Infinity` never reaches the zero stop condition.
     */
    private normalizeCountdownSeconds = (value: unknown): number => {
        const n = Number(value)
        if (!Number.isFinite(n)) return 0
        return Math.max(0, Math.floor(n))
    }

    /**
     * Stop the running countdown interval, if any, and clear the handle.
     * Idempotent: safe to call when no timer is running.
     */
    private clearCountdownTimer = () => {
        if (this.countdownTimer !== null) {
            clearInterval(this.countdownTimer)
            this.countdownTimer = null
        }
    }

    /**
     * Set the displayed countdown value without starting the timer. Used
     * when the user drags the input/slider while the timer is idle.
     */
    countdownSet = (value: number) => {
        this.clearCountdownTimer()
        this.seriesData.display.countdown = this.normalizeCountdownSeconds(value)
        this.seriesData.display.countdownRunning = false
        if (this.debug) {
            this.logger.info(`countdownSet to ${this.seriesData.display.countdown}`)
        }
    }

    /**
     * Start (or restart) the countdown from the given number of seconds.
     * Replaces any previously-running interval so re-pressing Start while
     * the timer is already running simply resets it to the new value.
     */
    countdownStart = (value: number) => {
        this.clearCountdownTimer()
        this.seriesData.display.countdown = this.normalizeCountdownSeconds(value)
        this.seriesData.display.countdownRunning = this.seriesData.display.countdown > 0
        if (this.debug) {
            this.logger.info(`countdownStart from ${this.seriesData.display.countdown}`)
        }
        if (this.seriesData.display.countdownRunning) {
            this.countdownTimer = setInterval(this.tickCountdown, 1000)
        }
    }

    /**
     * Pause the running countdown, keeping the current value visible.
     */
    countdownPause = () => {
        this.clearCountdownTimer()
        this.seriesData.display.countdownRunning = false
        if (this.debug) {
            this.logger.info(`countdownPause at ${this.seriesData.display.countdown}`)
        }
    }

    /**
     * Resume a paused countdown. No-op if the current value is 0 (we
     * would simply tick to 0 immediately).
     */
    countdownResume = () => {
        this.clearCountdownTimer()
        if (this.seriesData.display.countdown > 0) {
            this.seriesData.display.countdownRunning = true
            this.countdownTimer = setInterval(this.tickCountdown, 1000)
            if (this.debug) {
                this.logger.info(`countdownResume from ${this.seriesData.display.countdown}`)
            }
        }
    }

    /**
     * Update the CSS color used by the <CountdownTimer /> component. Empty
     * string clears the override and lets the component fall back to its
     * default CSS color.
     */
    countdownSetColor = (value: string) => {
        const color = typeof value === 'string' ? value : ''
        this.seriesData.display.countdownColor = color
        if (this.debug) {
            this.logger.info(`countdownSetColor to "${color}"`)
        }
    }

    /**
     * Reset the countdown to a given value (or to 0 if none is provided)
     * and stop the timer.
     */
    countdownReset = (value?: number) => {
        this.clearCountdownTimer()
        this.seriesData.display.countdown = this.normalizeCountdownSeconds(value)
        this.seriesData.display.countdownRunning = false
        if (this.debug) {
            this.logger.info(`countdownReset to ${this.seriesData.display.countdown}`)
        }
    }

    /**
     * Internal: 1 s tick. Decrements the value and broadcasts to all
     * subscribers; clears itself when the countdown hits 0.
     */
    private tickCountdown = () => {
        if (this.seriesData.display.countdown <= 1) {
            this.seriesData.display.countdown = 0
            this.seriesData.display.countdownRunning = false
            this.clearCountdownTimer()
        } else {
            this.seriesData.display.countdown -= 1
        }
    }

    updateTournamentLogo = (newLogo: string): SeriesData => {
        this.seriesData.display.tournamentLogo = newLogo
        if (this.debug) {
            this.logger.info('updateTournamentLogo')
        }
        return this.seriesData
    }

    updateTeamLogo = (team: string, newLogo: string): SeriesData => {
        if (team === 'team1' || team === 'team2') {
            this.seriesData[team].logo = newLogo
            if (this.debug) {
                this.logger.info('updateTeam1Logo')
            }
        }
        return this.seriesData
    }

    toggleOptionalLogoDisplay = (): SeriesData => {
        this.seriesData.display.optionalLogoDisplay = !this.seriesData.display.optionalLogoDisplay
        if (this.debug) {
            this.logger.info('toggleOptionalLogoDisplay')
        }
        return this.seriesData
    }

    updateMapCountAndRefreshFaceItDataIfNeeded = (increment: number = 1): SeriesData => {
        const candidate = this.seriesData.display.mapCount + increment
        this.logger.debug({
            msg: 'updateMapCountAndRefreshFaceItDataIfNeeded',
            mapCount: this.seriesData.display.mapCount
        })
        if (candidate !== this.seriesData.display.mapCount) {
            this.seriesData.display.mapCount = candidate > 0 ? candidate : 1
            if (this.debug) {
                this.logger.info(`increase map count by ${increment}`)
            }
            // mapCount [1, +Infinity[
            if (!this.seriesData.standings[`match${this.seriesData.display.mapCount}`]) {
                this.fetchFaceItMatchUpdates(this.seriesData.display.mapCount)
            }
        }
        return this.seriesData
    }

    initialMatchDataFromFaceItMatchId = async (matchIdOrURL: string,
    ) => {
        if (typeof matchIdOrURL !== "string" || !matchIdOrURL) {
            return
        }
        // if we are hopping to a new match, or just initializing, we don't want any remnants of a previous match
        // (like bans) to stay in the standings, even if the fetch below ends up failing
        this.seriesData.standings = structuredClone(DEFAULT_SERIES_DATA.standings)
        const matchId: string = FaceItClient.extractMatchId(matchIdOrURL)

        try {
            const faceItMatchData = await this.faceItClient.getNormalizedMatchData(matchId)
            this.logger.info({
                msg: 'FaceIt match data querying',
                faceItMatchData: {
                    team1Name: faceItMatchData.team1.name,
                    team1Avatar: faceItMatchData.team1.avatar,
                    team2Name: faceItMatchData.team2.name,
                    team2Avatar: faceItMatchData.team2.avatar,
                    matchId: matchId
                }
            })

            this.seriesData.team1.name = faceItMatchData.team1.name
            this.seriesData.team1.logo = faceItMatchData.team1.avatar
            this.seriesData.team2.name = faceItMatchData.team2.name
            this.seriesData.team2.logo = faceItMatchData.team2.avatar

            this.seriesData.faceIt.matchId = matchId
            this.seriesData.faceIt.raw = faceItMatchData.raw
            if (this.debug) {
                this.logger.info({
                    msg: '1st FaceIt match data querying (teams)',
                    length: this.seriesData?.faceIt?.raw?.voting?.heroes?.entities?.length,
                    entities: this.seriesData?.faceIt?.raw?.voting?.heroes?.entities,
                    heroes: this.seriesData?.faceIt?.raw?.voting?.heroes,
                    voting: this.seriesData?.faceIt?.raw?.voting,
                    raw: this.seriesData?.faceIt?.raw
                })
            }
            return this.seriesData
        } catch (error) {
            this.logger.error({msg: 'FaceIt match data query failed', error})
            return this.seriesData
        }
    }

    increaseCustomCounter = (): SeriesData => {
        this.seriesData.display.customCounter++
        if (this.debug) {
            this.logger.info('increaseCustomCount')
        }
        return this.seriesData
    }

    decreaseCustomCounter = (): SeriesData => {
        this.seriesData.display.customCounter--
        if (this.debug) {
            this.logger.info('decreaseCustomCount')
        }
        return this.seriesData
    }

    updatedLobbyDataFromFaceItMatchId = async (matchId: string, mapNumber: number, next: () => void) => {
        if (!matchId) {
            return
        }

        let historyPayload: any
        try {
            historyPayload = await this.faceItClient.getLobbyHistory(matchId)
        } catch (error) {
            this.logger.error({
                msg: `Could not update lobby data using FaceIt match id ${matchId}`,
                error: error.message
            })
            next()
            return
        }

        try {
            this.logger.info({
                msg: 'UpdateLobbyDataFromFaceItMatchId',
                map: mapNumber - 1,
            })

            // The history endpoint carries only hero guids; the display data
            // (image/name) lives in faceIt.raw.voting.heroes.entities, populated
            // by the initial match lookup. When there are bans to resolve but
            // that display data is missing, re-trigger the lookup and MUST await
            // it before the ban extraction can succeed.
            const faceItEntitiesAreAvailable = this.seriesData?.faceIt?.raw?.voting?.heroes?.entities?.length
            const hasBansToResolve = this.faceItClient.hasBanVotesForMap(historyPayload, mapNumber)
            if (hasBansToResolve && !faceItEntitiesAreAvailable) {
                this.logger.info({msg: 'Hero display data missing for ban extraction => requerying'})
                this.seriesData.faceIt.raw = (await this.faceItClient.getNormalizedMatchData(matchId)).raw
            }

            const bans = this.faceItClient.extractBansForMap(
                historyPayload,
                this.seriesData?.faceIt?.raw?.voting?.heroes?.entities ?? [],
                mapNumber,
            )
            if (bans) {
                this.seriesData.standings[`match${mapNumber}`] = {
                    ...this.seriesData.standings[`match${mapNumber}`],
                    bans
                }
            }
            next()
        } catch (error) {
            this.logger.error({msg: 'Error fetching faceit match details (bans)', error: error.message})
            next()
        }
    }

    fetchFaceItMatchUpdates = (mapNumber: number): Promise<void> => {
        return new Promise<void>((resolve) => {
            try {
                if (this.seriesData?.faceIt?.matchId.length > 0) {
                    this.updatedLobbyDataFromFaceItMatchId(this.seriesData?.faceIt?.matchId, mapNumber, resolve)
                } else {
                    this.logger.info({msg: 'No faceIt matchId present.'})
                    resolve()
                }
            } catch (error) {
                this.logger.error({msg: 'Error fetching faceIt match updates', error: error.message})
                resolve()
            }
        })
    }

    teamUpdateBan(teamName: string, banName: string) {
        if (teamName === 'team1') {
            return this.team1UpdateBan(banName)
        }
        return this.team2UpdateBan(banName)
    }

    team1UpdateBan(bannedHeroName: string) {
        const roundStandings = this.seriesData.standings[`match${this.seriesData.display.mapCount}`]
        if (!roundStandings) {
            this.seriesData.standings[`match${this.seriesData.display.mapCount}`] = {
                bans: {
                    team1: {},
                    team2: {}
                }
            }
        }
        this.seriesData.standings[`match${this.seriesData.display.mapCount}`].bans.team1.heroImage = bannedHeroName
        if (this.debug) {
            this.logger.info({msg: 'team1UpdateBan', bannedHeroName})
        }
    }

    team2UpdateBan(bannedHeroName: string) {
        const roundStandings = this.seriesData.standings[`match${this.seriesData.display.mapCount}`]
        if (!roundStandings) {
            this.seriesData.standings[`match${this.seriesData.display.mapCount}`] = {
                bans: {
                    team1: {},
                    team2: {}
                }
            }
        }
        this.seriesData.standings[`match${this.seriesData.display.mapCount}`].bans.team2.heroImage = bannedHeroName
        if (this.debug) {
            this.logger.info({msg: 'team2UpdateBan', bannedHeroName})
        }
    }

    getSeriesData(): SeriesData {
        return this.seriesData
    }

    /**
     * Direct setter for the current map number. Unlike
     * {@link updateMapCountAndRefreshFaceItDataIfNeeded}, this primitive
     * does NOT trigger a FaceIt refresh: it is meant for cases where the
     * caller already knows the exact target value (operator UI input,
     * catchup from a reconnecting front-end) and either does not want or
     * does not need a network round-trip as a side effect.
     *
     * The value is sanitized to an integer >= 1. Non-numeric or
     * out-of-range payloads are ignored so a malformed client message
     * cannot wedge the state.
     */
    setMapCount = (rawValue: any) => {
        const parsed = typeof rawValue === 'number' ? rawValue : Number(rawValue)
        if (!Number.isFinite(parsed)) {
            // this.broadcastState()
            return
        }
        const sanitized = Math.max(1, Math.floor(parsed))
        if (sanitized === this.seriesData.display.mapCount) {
            // this.broadcastState()
            return
        }
        this.seriesData.display.mapCount = sanitized
        if (this.debug) {
            this.logger.info({msg: 'setMapCount', mapCount: sanitized})
        }
        // this.broadcastState()
    }

    /**
     * Re-assert a client's last-known intent after a reconnect.
     *
     * Called when the front-end's WebSocket reopens after a transient
     * disconnect (typically caused by the Electron back-end fork being
     * restarted, e.g. when the user saves a new FaceIt API key from the
     * Settings dialog). The front-end sends the values it had cached at
     * the moment of the disconnect; this method decides on a per-field
     * basis whether to apply them, then performs a single broadcast.
     *
     * Field application policy:
     *
     * - `faceItMatchId`, `tournamentLogo`, `mapCount`: applied if the
     *   field is present in the payload AND differs from the current
     *   server state. The operator-driven configuration center is the
     *   sole source of truth for these.
     *
     * - `team1.score` / `team2.score`: applied only if the back's current
     *   value is at its default (`0`). This prevents the front-end cache
     *   from clobbering concurrent mutations made via other channels
     *   (notably the Stream Deck plugin, which pushes score increments
     *   straight to the HTTP API). FaceIt does not provide scores so
     *   this gate is the sole arbiter.
     *
     * - `team1.name` / `team2.name` / `team1.logo` / `team2.logo`:
     *   normally applied with the same "back-at-default" gate. BUT when
     *   `faceItMatchId` is being asserted (i.e. a FaceIt lookup has just
     *   been triggered), these fields are skipped entirely. The FaceIt
     *   API response is the authoritative source for team names/logos and
     *   will overwrite them shortly; eagerly applying the front-cached
     *   values here would race against the fetch and produce a brief
     *   flicker before being clobbered.
     *
     * If `faceItMatchId` differs and gets applied, the existing FaceIt
     * lookup pipeline is triggered (it broadcasts on its own), and we
     * skip the trailing local broadcast to avoid an extra message.
     *
     * Malformed payloads (non-object root, unexpected types) are tolerated
     * silently: every field is gated independently, and a single
     * broadcast still goes out so the front-end can settle on the current
     * server state.
     */
    catchup = async (intent: any) => {
        const applied: string[] = []
        const skipped: string[] = []
        let matchIdTriggeredFetch = false

        if (intent !== null && typeof intent === 'object' && !Array.isArray(intent)) {
            // --- faceItMatchId ---------------------------------------------
            if (typeof intent.faceItMatchId === 'string') {
                if (intent.faceItMatchId !== this.seriesData.faceIt.matchId) {
                    if (intent.faceItMatchId.length > 0) {
                        // Defer broadcast: initialMatchDataFromFaceItMatchId
                        // broadcasts on completion.
                        this.seriesData.faceIt.matchId = intent.faceItMatchId
                        await this.initialMatchDataFromFaceItMatchId(intent.faceItMatchId)
                        matchIdTriggeredFetch = true
                    } else {
                        this.seriesData.faceIt.matchId = ''
                    }
                    applied.push('faceItMatchId')
                } else {
                    skipped.push('faceItMatchId(same)')
                }
            }

            // --- tournamentLogo --------------------------------------------
            if (typeof intent.tournamentLogo === 'string') {
                if (intent.tournamentLogo !== this.seriesData.display.tournamentLogo) {
                    this.seriesData.display.tournamentLogo = intent.tournamentLogo
                    applied.push('tournamentLogo')
                } else {
                    skipped.push('tournamentLogo(same)')
                }
            }

            // --- mapCount --------------------------------------------------
            if (intent.mapCount !== undefined) {
                const parsed = typeof intent.mapCount === 'number' ? intent.mapCount : Number(intent.mapCount)
                if (Number.isFinite(parsed)) {
                    const sanitized = Math.max(1, Math.floor(parsed))
                    if (sanitized !== this.seriesData.display.mapCount) {
                        this.seriesData.display.mapCount = sanitized
                        applied.push('mapCount')
                    } else {
                        skipped.push('mapCount(same)')
                    }
                }
            }

            // --- team1 / team2: only apply on top of defaults --------------
            // The `skip` parameter short-circuits the field entirely; it
            // exists so that fields the FaceIt lookup is about to overwrite
            // (names and logos when matchId triggered a fetch) don't race
            // against the async API response.
            const applyTeamField = (
                teamKey: 'team1' | 'team2',
                fieldKey: 'name' | 'score' | 'logo',
                defaultValue: string | number,
                meaningful: (v: any) => boolean,
                skip: boolean = false,
            ) => {
                if (skip) {
                    skipped.push(`${teamKey}.${fieldKey}(faceit-will-overwrite)`)
                    return
                }
                const teamPayload = intent[teamKey]
                if (!teamPayload || typeof teamPayload !== 'object') return
                const candidate = teamPayload[fieldKey]
                if (!meaningful(candidate)) return
                if (this.seriesData[teamKey][fieldKey] !== defaultValue) {
                    skipped.push(`${teamKey}.${fieldKey}(non-default-on-back)`)
                    return
                }
                this.seriesData[teamKey][fieldKey] = candidate as never
                applied.push(`${teamKey}.${fieldKey}`)
            }

            const isMeaningfulString = (v: any) => typeof v === 'string' && v.length > 0
            const isMeaningfulScore = (v: any) => typeof v === 'number' && Number.isFinite(v) && v > 0
            // FaceIt's /v4/matches/{id} response overwrites names and logos
            // but never touches scores, so only the former two are skipped
            // when matchIdTriggeredFetch is true.
            applyTeamField('team1', 'name', '', isMeaningfulString, matchIdTriggeredFetch)
            applyTeamField('team2', 'name', '', isMeaningfulString, matchIdTriggeredFetch)
            applyTeamField('team1', 'logo', '', isMeaningfulString, matchIdTriggeredFetch)
            applyTeamField('team2', 'logo', '', isMeaningfulString, matchIdTriggeredFetch)
            applyTeamField('team1', 'score', 0, isMeaningfulScore)
            applyTeamField('team2', 'score', 0, isMeaningfulScore)
        }

        this.logger.info({msg: 'catchup', applied, skipped})

        // this.broadcastState()
        // initialMatchDataFromFaceItMatchId triggers its own async broadcast
        // once the FaceIt fetch settles. If we also broadcast synchronously
        // here, the front would see the partially-updated state first and
        // the post-fetch state second; that's fine on the wire but noisy.
        // We still broadcast once if no fetch was triggered so the scenes
        // see all the other applied fields immediately.
        return this.seriesData
    }
}
