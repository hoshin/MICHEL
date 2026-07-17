import * as fs from "fs"
import * as https from "https"
import {Response} from "express"

import pino from 'pino'
import type { Logger } from "pino"

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
    countdown: number,
    countdownRunning: boolean,
    // CSS color string used by the <CountdownTimer /> component. Empty
    // string means "fall back to the component's CSS default".
    countdownColor: string
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

let apiKey = process.env.FACEIT_KEY

const FACEIT_BROWSER_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'

// Client-side idle timeout for FaceIt lookups. Without it, a FaceIt server
// that accepts the connection but never responds (or stalls mid-body) would
// leave the awaited request hanging indefinitely. 15s is generous for a
// metadata lookup while still failing fast enough to fall through to the
// authenticated fallback or give up.
const FACEIT_HTTP_TIMEOUT_MS = 15000

// since one could explicitly provide an empty key through env variables, the test to `undefined` was not accurate.
// this is a laxer approach that will treat empty keys as falsy values and go to the fallback config file value in such a case
const effectiveFaceItApiKey = () => process.env.FACEIT_KEY ? process.env.FACEIT_KEY : apiKey

process.env.MICH_LOG_PATH='./'

export class MichelBackService {
    private connectionPool: any
    private debug: boolean
    private seriesData: SeriesData
    private logger: Logger
    // Server-owned 1 s tick for the countdown. We hold a reference here so
    // that pause / reset / a new start can replace any running interval
    // without leaking timers. Reset to null whenever the countdown stops.
    private countdownTimer: ReturnType<typeof setInterval> | null = null

    constructor(connectionPool, debug: boolean, seriesData?: SeriesData, logger?: Logger) {
        this.connectionPool = connectionPool
        this.seriesData = seriesData ?? structuredClone(DEFAULT_SERIES_DATA)
        this.debug = debug

        const fileTransport = pino.transport({
            target: 'pino/file',
            options: { destination: `${process.env.MICH_LOG_PATH}/app.log` },
        })

        this.logger = pino(
            {
                level: process.env.PINO_LOG_LEVEL || 'info',
                formatters: {
                    level: (label) => {
                        return { level: label.toUpperCase() }
                    },
                },
                timestamp: pino.stdTimeFunctions.isoTime,
            },
            fileTransport
        )

        try {
            const configFile = fs.readFileSync('./back/config.json')
            this.logger.info('Config file present ... updating seriesData!')
            const jsonSeriesConfigurationFromFile = JSON.parse(configFile.toString('utf8')).seriesData
            if(!apiKey){
                apiKey = jsonSeriesConfigurationFromFile.faceIt.apiKey
            }
            // this.logger.info(`API key? ${apiKey}`)
            if (jsonSeriesConfigurationFromFile?.faceIt?.matchId?.length > 0) {
                this.logger.info(`FaceIt matchID present in config file! Building series data with it! ${jsonSeriesConfigurationFromFile.faceIt.matchId}`)
                this.initialMatchDataFromFaceItMatchId(null, jsonSeriesConfigurationFromFile.faceIt.matchId)
            } else {
                this.seriesData = jsonSeriesConfigurationFromFile
            }
        } catch (error) {
            this.logger.warn({ msg: 'No config file found! Initializing seriesData with default values.', error: error.message})
        }
    }

    updateConnectionPool(socket) {
        this.connectionPool.push(socket)
    }

    handleCommand(payloadAsBuffer: Buffer) {
        const payload = JSON.parse(payloadAsBuffer.toString('utf8'))
        if (this.debug) {
            this.logger.info({ msg: '[DEBUG] Incoming command: ', payload})
        }
        switch (payload.command) {
            case 'increaseTeam1Score':
                this.teamIncrementScore(null, 'team1', 1);
                break;
            case 'increaseTeam2Score':
                this.teamIncrementScore(null, 'team2', 1);
                break;
            case 'decreaseTeam1Score':
                this.teamIncrementScore(null, 'team1', -1);
                break;
            case 'decreaseTeam2Score':
                this.teamIncrementScore(null, 'team2', -1);
                break;
            case 'updateTeam1Name':
                this.teamUpdateName(null, 'team1', payload.value);
                break;
            case 'updateTeam2Name':
                this.teamUpdateName(null, 'team2', payload.value);
                break;
            case 'swapTeams':
                this.swapTeams(null);
                break;
            case 'increaseMapCount':
                this.updateMapCountAndRefreshFaceItDataIfNeeded(null, 1);
                break;
            case 'decreaseMapCount':
                this.updateMapCountAndRefreshFaceItDataIfNeeded(null, -1);
                break;
            case 'updateMapFormat':
                this.updateMapFormat(null, payload.value);
                break;
            case 'updateTeam1Logo':
                this.updateTeamLogo(null, 'team1', payload.value);
                break;
            case 'updateTeam2Logo':
                this.updateTeamLogo(null, 'team2', payload.value);
                break;
            case 'updateTournamentLogo' :
                this.updateTournamentLogo(null, payload.value);
                break;
            case 'toggleOptionalLogoDisplay' :
                this.toggleOptionalLogoDisplay(null);
                break;
            case 'updateFromMatchId':
                this.initialMatchDataFromFaceItMatchId(null, payload.value);
                break;
            case 'fetchFaceItMatchUpdates':
                this.fetchFaceItMatchUpdates(null, payload.value);
                break;
            case 'increaseCustomCounter':
                this.increaseCustomCounter(null);
                break;
            case 'decreaseCustomCounter':
                this.decreaseCustomCounter(null);
                break;
            case 'team1UpdateBan':
                this.teamUpdateBan(null, 'team1', payload.value);
                break;
            case 'team2UpdateBan':
                this.teamUpdateBan(null, 'team2', payload.value);
                break;
            case 'setMapCount':
                this.setMapCount(null, payload.value);
                break;
            case 'catchup':
                this.catchup(null, payload.value);
                break;
            case 'countdownSet':
                // Update the displayed value without running the timer
                // (e.g. user dragged the slider while the timer was idle).
                this.countdownSet(null, payload.value);
                break;
            case 'countdownStart':
                this.countdownStart(null, payload.value);
                break;
            case 'countdownPause':
                this.countdownPause(null);
                break;
            case 'countdownResume':
                this.countdownResume(null);
                break;
            case 'countdownReset':
                this.countdownReset(null, payload.value);
                break;
            case 'countdownSetColor':
                this.countdownSetColor(null, payload.value);
                break;
            default:
                this.home(null)
        }
    }

    home(res: Response) {
        this.sendUpdatedStateToCaller(res)
    }

    sendUpdatedStateToCaller(res: Response) {
        if (res && !res.headersSent) {
            res.json(this.seriesData)
        }
        if (this.connectionPool) {
            const connectionPoolWithonlyUnclosedSockets = this.connectionPool.filter(socket => !socket._closeFrameReceived)
            if (this.connectionPool.length !== connectionPoolWithonlyUnclosedSockets.length) {
                this.logger.info({ msg: `Connection pool cleanup (remove closing / closed sockets): Base - ${this.connectionPool.length} => New - ${connectionPoolWithonlyUnclosedSockets.length}`})
                this.connectionPool = connectionPoolWithonlyUnclosedSockets
            }

            this.connectionPool.forEach(socket => {
                socket.send(JSON.stringify(this.seriesData))
            })
        }
    }

    swapTeams = (res: Response) => {
        const rightTeam = this.seriesData.display.right
        const leftTeam = this.seriesData.display.left
        this.seriesData.display.right = leftTeam
        this.seriesData.display.left = rightTeam
        if (this.debug) {
            this.logger.info('swapTeams')
        }

        this.sendUpdatedStateToCaller(res)
    }

    teamIncrementScore(res: Response, teamName: string, increment: number = 1) {
        const candidateScore = this.seriesData[teamName].score + increment
        this.seriesData[teamName].score = candidateScore >= 0 ? candidateScore : 0
        if (this.debug) {
            this.logger.info(`${teamName} increment score by ${increment}`)
        }
        this.sendUpdatedStateToCaller(res)
    }

    teamUpdateName(res: Response, team: string = 'team1', newName: string) {
        if (team === 'team1' || team === 'team2') {
            this.seriesData[team].name = newName
            if (this.debug) {
                this.logger.info(`${team} update name to ${newName}`)
            }
        }
        this.sendUpdatedStateToCaller(res)
    }

    updateMapFormat = (res: Response, newFormat: MapFormat) => {
        this.seriesData.display.mapFormat = newFormat
        if (this.debug) {
            this.logger.info('updateMapFormat')
        }

        this.sendUpdatedStateToCaller(res)
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
    countdownSet = (res: Response, value: number) => {
        this.clearCountdownTimer()
        this.seriesData.display.countdown = this.normalizeCountdownSeconds(value)
        this.seriesData.display.countdownRunning = false
        if (this.debug) {
            this.logger.info(`countdownSet to ${this.seriesData.display.countdown}`)
        }
        this.sendUpdatedStateToCaller(res)
    }

    /**
     * Start (or restart) the countdown from the given number of seconds.
     * Replaces any previously-running interval so re-pressing Start while
     * the timer is already running simply resets it to the new value.
     */
    countdownStart = (res: Response, value: number) => {
        this.clearCountdownTimer()
        this.seriesData.display.countdown = this.normalizeCountdownSeconds(value)
        this.seriesData.display.countdownRunning = this.seriesData.display.countdown > 0
        if (this.debug) {
            this.logger.info(`countdownStart from ${this.seriesData.display.countdown}`)
        }
        if (this.seriesData.display.countdownRunning) {
            this.countdownTimer = setInterval(this.tickCountdown, 1000)
        }
        this.sendUpdatedStateToCaller(res)
    }

    /**
     * Pause the running countdown, keeping the current value visible.
     */
    countdownPause = (res: Response) => {
        this.clearCountdownTimer()
        this.seriesData.display.countdownRunning = false
        if (this.debug) {
            this.logger.info(`countdownPause at ${this.seriesData.display.countdown}`)
        }
        this.sendUpdatedStateToCaller(res)
    }

    /**
     * Resume a paused countdown. No-op if the current value is 0 (we
     * would simply tick to 0 immediately).
     */
    countdownResume = (res: Response) => {
        this.clearCountdownTimer()
        if (this.seriesData.display.countdown > 0) {
            this.seriesData.display.countdownRunning = true
            this.countdownTimer = setInterval(this.tickCountdown, 1000)
            if (this.debug) {
                this.logger.info(`countdownResume from ${this.seriesData.display.countdown}`)
            }
        }
        this.sendUpdatedStateToCaller(res)
    }

    /**
     * Update the CSS color used by the <CountdownTimer /> component. Empty
     * string clears the override and lets the component fall back to its
     * default CSS color.
     */
    countdownSetColor = (res: Response, value: string) => {
        const color = typeof value === 'string' ? value : ''
        this.seriesData.display.countdownColor = color
        if (this.debug) {
            this.logger.info(`countdownSetColor to "${color}"`)
        }
        this.sendUpdatedStateToCaller(res)
    }

    /**
     * Reset the countdown to a given value (or to 0 if none is provided)
     * and stop the timer.
     */
    countdownReset = (res: Response, value?: number) => {
        this.clearCountdownTimer()
        this.seriesData.display.countdown = this.normalizeCountdownSeconds(value)
        this.seriesData.display.countdownRunning = false
        if (this.debug) {
            this.logger.info(`countdownReset to ${this.seriesData.display.countdown}`)
        }
        this.sendUpdatedStateToCaller(res)
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
        this.sendUpdatedStateToCaller(null)
    }

    updateTournamentLogo = (res: Response, newLogo: string) => {
        this.seriesData.display.tournamentLogo = newLogo
        if (this.debug) {
            this.logger.info('updateTournamentLogo')
        }

        this.sendUpdatedStateToCaller(res)
    }

    updateTeamLogo = (res: Response, team: string, newLogo: string) => {
        if (team === 'team1' || team === 'team2') {
            this.seriesData[team].logo = newLogo
            if (this.debug) {
                this.logger.info('updateTeam1Logo')
            }
        }

        this.sendUpdatedStateToCaller(res)
    }

    toggleOptionalLogoDisplay = (res: Response) => {
        this.seriesData.display.optionalLogoDisplay = !this.seriesData.display.optionalLogoDisplay
        if (this.debug) {
            this.logger.info('toggleOptionalLogoDisplay')
        }

        this.sendUpdatedStateToCaller(res)
    }

    updateMapCountAndRefreshFaceItDataIfNeeded = (res: Response, increment: number = 1) => {
        const candidate = this.seriesData.display.mapCount + increment
        this.logger.info({msg: '[MBA] updateMapCountAndRefreshFaceItDataIfNeeded', mapCount: this.seriesData.display.mapCount})
        if (candidate === this.seriesData.display.mapCount) {
            this.sendUpdatedStateToCaller(res)
        } else {
            this.seriesData.display.mapCount = candidate > 0 ? candidate : 1
            if (this.debug) {
                this.logger.info(`increase map count by ${increment}`)
            }
            // mapCount [1, +Infinity[
            if (!this.seriesData.standings[`match${this.seriesData.display.mapCount}`]) {
                this.fetchFaceItMatchUpdates(res, this.seriesData.display.mapCount)
                this.sendUpdatedStateToCaller(res)
            } else {
                this.sendUpdatedStateToCaller(res)
            }
        }
    }

    private getJsonUsingNodeHttps = (url: string): Promise<any> => new Promise((resolve, reject) => {
        const request = https.get(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': FACEIT_BROWSER_USER_AGENT,
            },
        }, response => {
            let responseBody = ''

            response.on('data', chunk => {
                responseBody += chunk
            })

            response.on('end', () => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Response status not 200 : ${response.statusCode}`))
                    return
                }

                try {
                    resolve(JSON.parse(responseBody))
                } catch (error) {
                    reject(error)
                }
            })
        })

        // Node imposes no default socket timeout, so a FaceIt server that
        // accepts the connection but never responds would leave this promise
        // pending forever. Arm an idle timeout and destroy the request when it
        // fires; destroy(err) re-emits 'error', which the handler below turns
        // into the single rejection path.
        request.setTimeout(FACEIT_HTTP_TIMEOUT_MS)
        request.on('timeout', () => {
            request.destroy(new Error(`FaceIt public request timed out after ${FACEIT_HTTP_TIMEOUT_MS} ms`))
        })

        request.on('error', reject)
    })

    private getAuthenticatedFaceItMatchData = async (matchId: string): Promise<any> => {
        const key = effectiveFaceItApiKey()
        if (!key) {
            throw new Error('No FaceIt API key available for authenticated fallback')
        }

        const response = await fetch(`https://open.faceit.com/data/v4/matches/${matchId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Accept': 'application/json',
            },
            // Same rationale as the public request: bound the wait so a stalled
            // authenticated endpoint cannot hang the fallback indefinitely.
            signal: AbortSignal.timeout(FACEIT_HTTP_TIMEOUT_MS),
        })

        if (response.status !== 200) {
            throw new Error(`Response status not 200 : ${response.status}`)
        }

        return response.json()
    }

    private normalizedPublicFaceItMatchData = (jsonData: any) => {
        const matchData = jsonData?.payload
        const faction1 = matchData?.teams?.faction1
        const faction2 = matchData?.teams?.faction2
        if (!faction1 || !faction2) {
            throw new Error('Public FaceIt match data does not contain both teams')
        }

        const heroEntities = matchData?.matchCustom?.tree?.heroes?.values?.value ?? []
        return {
            raw: {
                ...matchData,
                voting: {
                    ...matchData.voting,
                    heroes: {
                        ...matchData.voting?.heroes,
                        entities: heroEntities,
                    },
                },
            },
            team1: faction1,
            team2: faction2,
        }
    }

    private normalizedAuthenticatedFaceItMatchData = (jsonData: any) => {
        const faction1 = jsonData?.teams?.faction1
        const faction2 = jsonData?.teams?.faction2
        if (!faction1 || !faction2) {
            throw new Error('Authenticated FaceIt match data does not contain both teams')
        }

        return {
            raw: jsonData,
            team1: faction1,
            team2: faction2,
        }
    }

    private getNormalizedFaceItMatchData = async (matchId: string) => {
        try {
            const publicJsonData = await this.getJsonUsingNodeHttps(`https://www.faceit.com/api/match/v2/match/${matchId}`)
            return this.normalizedPublicFaceItMatchData(publicJsonData)
        } catch (publicError) {
            this.logger.info({msg:'[MBA] Public FaceIt match data query failed', error: publicError})
            const authenticatedJsonData = await this.getAuthenticatedFaceItMatchData(matchId)
            return this.normalizedAuthenticatedFaceItMatchData(authenticatedJsonData)
        }
    }

    initialMatchDataFromFaceItMatchId = async (res: Response, matchId: string) => {
        if (!matchId) {
            return
        }
        try {
            const faceItMatchData = await this.getNormalizedFaceItMatchData(matchId)
            this.logger.info({
                msg: 'FaceIt match data querying',
                faceItMatchData
            })

            this.seriesData.team1.name = faceItMatchData.team1.name
            this.seriesData.team1.logo = faceItMatchData.team1.avatar
            this.seriesData.team2.name = faceItMatchData.team2.name
            this.seriesData.team2.logo = faceItMatchData.team2.avatar

            this.seriesData.faceIt.matchId = matchId
            this.seriesData.faceIt.raw = faceItMatchData.raw
            this.logger.info({
                msg: '1st FaceIt match data querying (teams)',
                length: this.seriesData?.faceIt?.raw?.voting?.heroes?.entities?.length,
                entities: this.seriesData?.faceIt?.raw?.voting?.heroes?.entities,
                heroes: this.seriesData?.faceIt?.raw?.voting?.heroes,
                voting: this.seriesData?.faceIt?.raw?.voting,
                raw: this.seriesData?.faceIt?.raw
            })

            if (this.debug) {
                this.logger.info(`updateFromMatchId ${matchId}`)
            }
            this.sendUpdatedStateToCaller(res)
            return this.seriesData
        } catch (error) {
            this.logger.info({msg:'[MBA] FaceIt match data query failed', error})
            return this.seriesData
        }
    }

    increaseCustomCounter = (res: Response) => {
        this.seriesData.display.customCounter++
        if (this.debug) {
            this.logger.info('increaseCustomCount')
        }
        this.sendUpdatedStateToCaller(res)
    }

    decreaseCustomCounter = (res: Response) => {
        this.seriesData.display.customCounter--
        if (this.debug) {
            this.logger.info('decreaseCustomCount')
        }
        this.sendUpdatedStateToCaller(res)
    }

    updatedLobbyDataFromFaceItMatchId = async (matchId: string, mapNumber: number, next: () => void) => {
        if (!matchId) {
            return
        }
        return fetch(`https://www.faceit.com/api/democracy/v1/match/${matchId}/history`, {
            method: 'GET',
            headers: {
                //'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
            }
        })
        .then(response => {
            if (response.status !== 200) {
                throw new Error(`Response status not 200 : ${response.status}`)
            }
            response.json().then(jsonData => {

                const heroVotingPerMap = jsonData?.payload?.tickets.filter(ticket => ticket.entity_type === 'heroes')
                this.logger.info({
                    msg: 'UpdateLobbyDataFromFaceItMatchId',
                    jsonData: JSON.stringify(jsonData),
                    map: mapNumber-1,
                    heroVotingPerMapLength: heroVotingPerMap.length,
                    heroVotingForCurrentMap: heroVotingPerMap?.[mapNumber -1]
                })
                // mapNumber => [1, +Infinity[
                const votesForMap = heroVotingPerMap?.[mapNumber - 1]
                const votesForMapHasEntities = votesForMap?.entities && votesForMap.entities.length > 0
                if (votesForMap !== undefined && !votesForMapHasEntities) {
                    this.logger.info({ msg: 'votesForMap has no entities'})
                }
                if (votesForMapHasEntities) {
                    const bannedHeroes = votesForMap.entities.filter((voteEntity) => voteEntity.status === 'drop').map((bannedPick) => ({
                        guid: bannedPick.guid,
                        selected_by: bannedPick.selected_by,
                        round: bannedPick.round,
                    }))
                    this.logger.info({
                        msg: 'list of banned heroes',
                        bannedHeroes: bannedHeroes,
                    })
                    // this.logger.info(`[MBA] bannedHeroes ${mapNumber}`, JSON.stringify(this.seriesData.faceIt.raw.voting.heroes.entities, null, 2))
                    const heroesGuidsToLookup = bannedHeroes.map(heroBan => heroBan.guid)
                    this.logger.info({
                        msg: 'list of guids to lookup',
                        heroesGuidsToLookup: heroesGuidsToLookup,
                    })
                    // this.logger.info('[MBA] bannedHeroes data', JSON.stringify(this.seriesData.faceIt.raw.voting.heroes.entities.filter(entity => heroesGuidsToLookup.includes(entity.guid)), null, 2))
                    let filteredHeroDataForMap
                    try{
                        if(!this.seriesData?.faceIt?.raw?.voting?.heroes?.entities?.length) {
                            // force lookup
                            this.logger.info({
                                msg: 'Not all required data for votes is present => requerying',
                                    length: this.seriesData?.faceIt?.raw?.voting?.heroes?.entities?.length,
                                    entities: this.seriesData?.faceIt?.raw?.voting?.heroes?.entities,
                                    heroes: this.seriesData?.faceIt?.raw?.voting?.heroes,
                                    voting: this.seriesData?.faceIt?.raw?.voting,
                                    raw: this.seriesData?.faceIt?.raw
                            })

                            // control flow issue => should be fast enough but no guarantee
                            this.initialMatchDataFromFaceItMatchId(null, matchId)
                        }
                        if(this.seriesData?.faceIt?.raw?.voting?.heroes?.entities?.length > 0) {
                            filteredHeroDataForMap = this.seriesData.faceIt.raw.voting.heroes.entities.filter(entity => heroesGuidsToLookup.includes(entity.guid))
                            this.logger.info({msg:'have a list of heroes we can filter for target map',
                                filteredHeroes: filteredHeroDataForMap,
                            })
                        }
                        this.logger.info({msg:'filteredHeroDataForMap END, hopefully we hit an update branch before'})
                    } catch (error){
                        this.logger.error({msg:'Attempted to get filteredHeroDataForMap and crashed', error: error.message})
                        next()
                    }
                    const team1Ban = bannedHeroes.filter(ban => ban.selected_by === 'faction1')[0]
                    const team2Ban = bannedHeroes.filter(ban => ban.selected_by === 'faction2')[0]

                    // this.logger.info('[MBA] filteredHeroDataForMap', JSON.stringify(filteredHeroDataForMap, null, 2))
                    const heroDataForTeam1Ban = filteredHeroDataForMap.filter(ban => team1Ban.guid === ban.guid)[0]
                    const heroDataForTeam2Ban = filteredHeroDataForMap.filter(ban => team2Ban.guid === ban.guid)[0]
                    if (heroDataForTeam1Ban && heroDataForTeam2Ban) {
                        this.seriesData.standings[`match${mapNumber}`] = {
                            bans: {
                                team1: {
                                    heroImage: heroDataForTeam1Ban.image_lg,
                                    heroName: heroDataForTeam1Ban.name
                                },
                                team2: {
                                    heroImage: heroDataForTeam2Ban.image_lg,
                                    heroName: heroDataForTeam2Ban.name
                                }
                            }
                        }
                    }
                }
                next()
            })
                .catch(error => {
                    this.logger.error({ msg: 'Error fetching faceit match details (bans)', error: error.message})
                    next()
                })
        })
        .catch(error => {
            this.logger.error({ msg:`Could not update lobby data using FaceIt match id ${matchId}`, error: error.message})
            next()
        })
    }

    fetchFaceItMatchUpdates = (res: Response, mapNumber: number) => {
        try {
            if (this.seriesData?.faceIt?.matchId.length > 0) {
                this.updatedLobbyDataFromFaceItMatchId(this.seriesData?.faceIt?.matchId, mapNumber, () => {
                    this.sendUpdatedStateToCaller(res)
                })
            } else {
                this.logger.info('No faceIt matchId present.')
                this.sendUpdatedStateToCaller(res)
            }
        } catch (error) {
            this.logger.error( {msg:'Error fetching faceIt match updates:', error: error.message})
            this.sendUpdatedStateToCaller(res)
        }
    }

    teamUpdateBan(res: Response, teamName: string, banName: string) {
        if (teamName === 'team1') {
            return this.team1UpdateBan(res, banName)
        }
        return this.team2UpdateBan(res, banName)
    }

    team1UpdateBan(res: Response, bannedHeroName: string) {
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
            this.logger.info({ msg: 'team1UpdateBan', bannedHeroName})
        }
        this.sendUpdatedStateToCaller(res)
    }

    team2UpdateBan(res: Response, bannedHeroName: string) {
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
            this.logger.info({ msg: 'team1UpdateBan', bannedHeroName})
        }
        this.sendUpdatedStateToCaller(res)
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
    setMapCount = (res: Response, rawValue: any) => {
        const parsed = typeof rawValue === 'number' ? rawValue : Number(rawValue)
        if (!Number.isFinite(parsed)) {
            this.sendUpdatedStateToCaller(res)
            return
        }
        const sanitized = Math.max(1, Math.floor(parsed))
        if (sanitized === this.seriesData.display.mapCount) {
            this.sendUpdatedStateToCaller(res)
            return
        }
        this.seriesData.display.mapCount = sanitized
        if (this.debug) {
            this.logger.info({ msg: 'setMapCount', mapCount: sanitized })
        }
        this.sendUpdatedStateToCaller(res)
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
    catchup = (res: Response, intent: any) => {
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
                        this.initialMatchDataFromFaceItMatchId(null, intent.faceItMatchId)
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

        this.logger.info({ msg: 'catchup', applied, skipped })

        // initialMatchDataFromFaceItMatchId triggers its own async broadcast
        // once the FaceIt fetch settles. If we also broadcast synchronously
        // here, the front would see the partially-updated state first and
        // the post-fetch state second; that's fine on the wire but noisy.
        // We still broadcast once if no fetch was triggered so the scenes
        // see all the other applied fields immediately.
        if (!matchIdTriggeredFetch) {
            this.sendUpdatedStateToCaller(res)
        } else if (res && !res.headersSent) {
            // Echo current state back to the HTTP caller (if any) without
            // re-broadcasting to the WS pool — the FaceIt fetch will do that.
            res.json(this.seriesData)
        }
    }
}
