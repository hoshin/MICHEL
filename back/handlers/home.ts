import * as fs from "fs"
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
    optionalLogoDisplay: boolean
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
        optionalLogoDisplay: true
    },
    faceIt: {
        matchId: '',
    },
    standings: {}
}

let apiKey = process.env.FACEIT_KEY

process.env.MICH_LOG_PATH='./'

export class MichelBackService {
    private connectionPool: any
    private debug: boolean
    private seriesData: SeriesData
    private logger: Logger

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
            console.warn('No config file found! Initializing seriesData with default values.')
            console.warn(error.message)
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
                console.info(`Connection pool cleanup (remove closing / closed sockets): Base - ${this.connectionPool.length} => New - ${connectionPoolWithonlyUnclosedSockets.length}`)
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

    initialMatchDataFromFaceItMatchId = (res: Response, matchId: string) => {
        // this.logger.info('[MBA] initialMatchDataFromFaceItMatchId', matchId)
        if (!matchId) {
            return
        }
        return fetch(`https://open.faceit.com/data/v4/matches/${matchId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
            }
        })
            .then(response => {
                if (response.status !== 200) {
                    this.logger.info({msg:'[MBA] FaceIt status', status: response.status, json: JSON.stringify(response, null, 2)})
                    return
                }
                response.json().then(jsonData => {
                    // this.logger.info('[MBA] initialMatchDataFromFaceItMatchId', JSON.stringify(jsonData, null, 2))
                    this.logger.info({
                        msg: 'FaceIt match data querying',
                        jsonData
                    })
                    if (jsonData?.teams) {
                        const faction1 = jsonData.teams.faction1
                        const faction2 = jsonData.teams.faction2

                        this.seriesData.team1.name = faction1.name
                        this.seriesData.team2.name = faction2.name

                        this.seriesData.team1.logo = faction1.avatar
                        this.seriesData.team2.logo = faction2.avatar

                        this.seriesData.faceIt.matchId = matchId
                        this.seriesData.faceIt.raw = jsonData
                        this.logger.info({
                            msg: '1st FaceIt match data querying (teams)',
                            length: this.seriesData?.faceIt?.raw?.voting?.heroes?.entities?.length,
                            entities: this.seriesData?.faceIt?.raw?.voting?.heroes?.entities,
                            heroes: this.seriesData?.faceIt?.raw?.voting?.heroes,
                            voting: this.seriesData?.faceIt?.raw?.voting,
                            raw: this.seriesData?.faceIt?.raw
                        })
                    }

                    this.sendUpdatedStateToCaller(res)
                    return this.seriesData
                })
                if (this.debug) {
                    this.logger.info(`updateFromMatchId ${matchId}`)
                }
                return this.seriesData
            })
            .catch(error => this.seriesData)
            .finally(() => this.seriesData)
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
                if (heroVotingPerMap?.[mapNumber - 1] !== undefined) {
                    const votesForMap = heroVotingPerMap[mapNumber - 1]
                    // ?
                    console.log('votesForMap', {
                        votesForMap,
                    })
                    if (!votesForMap.entities || votesForMap.entities.length <= 0) {
                        console.log('votesForMap has no entities')
                        return
                    }
                    const bannedHeroes = votesForMap.entities.filter((voteEntity) => voteEntity.status === 'drop').map((bannedPick) => ({
                        guid: bannedPick.guid,
                        selected_by: bannedPick.selected_by,
                        round: bannedPick.round,
                    }))
                    console.log({
                        msg: 'list of banned heroes',
                        bannedHeroes: bannedHeroes,
                    })
                    // this.logger.info(`[MBA] bannedHeroes ${mapNumber}`, JSON.stringify(this.seriesData.faceIt.raw.voting.heroes.entities, null, 2))
                    const heroesGuidsToLookup = bannedHeroes.map(heroBan => heroBan.guid)
                    console.log({
                        msg: 'list of guids to lookup',
                        bannedHeroes: bannedHeroes,
                    })
                    // this.logger.info('[MBA] bannedHeroes data', JSON.stringify(this.seriesData.faceIt.raw.voting.heroes.entities.filter(entity => heroesGuidsToLookup.includes(entity.guid)), null, 2))
                    let filteredHeroDataForMap
                    try{
                        if(!this.seriesData?.faceIt?.raw?.voting?.heroes?.entities?.length) {
                            // force lookup
                            console.log({
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
                            console.log('have a list of heroes we can filter for target map', {
                                filteredHeroes: filteredHeroDataForMap,
                            })
                        }
                        console.log('filteredHeroDataForMap END, hopefully we hit an update branch before')
                    } catch (error){
                        console.error({msg:'Attempted to get filteredHeroDataForMap and crashed', error})
                        next()
                    }
                    const team1Ban = bannedHeroes.filter(ban => ban.selected_by === 'faction1')[0]
                    const team2Ban = bannedHeroes.filter(ban => ban.selected_by === 'faction2')[0]

                    // this.logger.info('[MBA] filteredHeroDataForMap', JSON.stringify(filteredHeroDataForMap, null, 2))
                    const heroDataForTeam1Ban = filteredHeroDataForMap.filter(ban => team1Ban.guid === ban.guid)[0]
                    const heroDataForTeam2Ban = filteredHeroDataForMap.filter(ban => team2Ban.guid === ban.guid)[0]
                    console.log('BANS?', {
                        jsonData:
                        bannedHeroes,
                        filteredHeroDataForMap,
                        team1Ban,
                        team2Ban,
                        heroDataForTeam1Ban,
                        heroDataForTeam2Ban
                    })
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
                    console.error('Error fetching faceit match details (bans)')
                    console.error(error)
                    next()
                })
        })
        .catch(error => {
            console.error(`Could not update lobby data using FaceIt match id ${matchId}`, error)
            next()
        })
    }

    fetchFaceItMatchUpdates = (res: Response, mapNumber: number) => {
        try {
            if (this.seriesData?.faceIt?.matchId.length > 0) {
                this.updatedLobbyDataFromFaceItMatchId(this.seriesData?.faceIt?.matchId, mapNumber, () => {
                    // console.log('next called')
                    this.sendUpdatedStateToCaller(res)
                })
            } else {
                this.logger.info('No faceIt matchId present.')
                this.sendUpdatedStateToCaller(res)
            }
        } catch (error) {
            console.error('Error fetching faceIt match updates:', error.message)
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
}
