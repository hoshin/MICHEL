import * as fs from "fs"
import {Response} from "express"

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

export class MichelBackService {
    private connectionPool: any
    private debug: boolean
    private seriesData: SeriesData

    constructor(connectionPool, debug: boolean, seriesData?: SeriesData) {
        this.connectionPool = connectionPool
        this.seriesData = seriesData ?? structuredClone(DEFAULT_SERIES_DATA)
        this.debug = debug
        try {
            const configFile = fs.readFileSync('./back/config.json')
            console.log('Config file present ... updating seriesData!')
            const jsonSeriesConfigurationFromFile = JSON.parse(configFile.toString('utf8')).seriesData

            if (jsonSeriesConfigurationFromFile?.faceIt?.matchId?.length > 0) {
                console.log(`FaceIt matchID present in config file! Building series data with it! ${jsonSeriesConfigurationFromFile.faceIt.matchId}`)
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
            console.log('[DEBUG] Incoming command: ', payload)
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
            if(this.connectionPool.length !== connectionPoolWithonlyUnclosedSockets.length) {
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
            console.log('swapTeams')
        }

        this.sendUpdatedStateToCaller(res)
    }

    teamIncrementScore(res: Response, teamName: string, increment: number = 1) {
        const candidateScore = this.seriesData[teamName].score + increment
        this.seriesData[teamName].score = candidateScore >= 0 ? candidateScore : 0
        if (this.debug) {
            console.log(`${teamName} increment score by ${increment}`)
        }
        this.sendUpdatedStateToCaller(res)
    }

    teamUpdateName(res: Response, team: string = 'team1', newName: string) {
        if (team === 'team1' || team === 'team2') {
            this.seriesData[team].name = newName
            if (this.debug) {
                console.log(`${team} update name to ${newName}`)
            }
        }
        this.sendUpdatedStateToCaller(res)
    }

    updateMapFormat = (res: Response, newFormat: MapFormat) => {
        this.seriesData.display.mapFormat = newFormat
        if (this.debug) {
            console.log('updateMapFormat')
        }

        this.sendUpdatedStateToCaller(res)
    }

    updateTournamentLogo = (res: Response, newLogo: string) => {
        this.seriesData.display.tournamentLogo = newLogo
        if (this.debug) {
            console.log('updateTournamentLogo')
        }

        this.sendUpdatedStateToCaller(res)
    }

    updateTeamLogo = (res: Response, team: string, newLogo: string) => {
        if (team === 'team1' || team === 'team2') {
            this.seriesData[team].logo = newLogo
            if (this.debug) {
                console.log('updateTeam1Logo')
            }
        }

        this.sendUpdatedStateToCaller(res)
    }

    toggleOptionalLogoDisplay = (res: Response) => {
        this.seriesData.display.optionalLogoDisplay = !this.seriesData.display.optionalLogoDisplay
        if (this.debug) {
            console.log('toggleOptionalLogoDisplay')
        }

        this.sendUpdatedStateToCaller(res)
    }

    updateMapCountAndRefreshFaceItDataIfNeeded = (res: Response, increment: number = 1) => {
        const candidate = this.seriesData.display.mapCount + increment
        if (candidate === this.seriesData.display.mapCount) {
            this.sendUpdatedStateToCaller(res)
        } else {
            this.seriesData.display.mapCount = candidate > 0 ? candidate : 1
            if (this.debug) {
                console.log(`increase map count by ${increment}`)
            }
            if (!this.seriesData.standings[`match${this.seriesData.display.mapCount}`]) {
                this.fetchFaceItMatchUpdates(res, this.seriesData.display.mapCount)
            } else {
                this.sendUpdatedStateToCaller(res)
            }
        }
    }

    initialMatchDataFromFaceItMatchId = (res: Response, matchId: string) => {
        if (!matchId) {
            return
        }
        fetch(`https://www.faceit.com/api/match/v2/match/${matchId}`, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0',
                Accept: 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                Referer: `https://www.faceit.com/en/ow2/room/${matchId}`,
                'faceit-referer': 'web-next',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                Connection: 'keep-alive',
                'Alt-Used': 'www.faceit.com',
                DNT: '1',
                'Sec-GPC': '1',
                Pragma: 'no-cache',
                'Cache-Control': 'no-cache'
            }
        })
            .then(response => {
                if (response.status !== 200) {
                    return
                }
                response.json().then(jsonData => {
                    if (jsonData?.payload?.teams) {
                        const {faction1, faction2} = jsonData.payload.teams

                        this.seriesData.team1.name = faction1.name
                        this.seriesData.team2.name = faction2.name

                        this.seriesData.team1.logo = faction1.avatar
                        this.seriesData.team2.logo = faction2.avatar

                        this.seriesData.faceIt.matchId = matchId
                    }

                    this.sendUpdatedStateToCaller(res)
                    return this.seriesData
                })

            })
            .catch(error => this.seriesData)
            .finally(() => this.seriesData)
        if (this.debug) {
            console.log(`updateFromMatchId ${matchId}`)
        }
        return this.seriesData
    }

    increaseCustomCounter = (res: Response) => {
        this.seriesData.display.customCounter++
        if (this.debug) {
            console.log('increaseCustomCount')
        }
        this.sendUpdatedStateToCaller(res)
    }

    decreaseCustomCounter = (res: Response) => {
        this.seriesData.display.customCounter--
        if (this.debug) {
            console.log('decreaseCustomCount')
        }
        this.sendUpdatedStateToCaller(res)
    }

    updatedLobbyDataFromFaceItMatchId = async (matchId: string, mapNumber: number, next: () => void) => {
        if (!matchId) {
            return
        }
        return fetch(`https://www.faceit.com/api/democracy/v1/match/${matchId}`, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0',
                Accept: 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                Referer: `https://www.faceit.com/en/ow2/room/${matchId}`,
                'faceit-referer': 'web-next',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                Connection: 'keep-alive',
                'Alt-Used': 'www.faceit.com',
                DNT: '1',
                'Sec-GPC': '1',
                Pragma: 'no-cache',
                'Cache-Control': 'no-cache',
                Priority: 'u=4'
            }
        })
            .then(response => {
                if (response.status !== 200) {
                    throw new Error(`Response status not 200 : ${response.status}`)
                }
                response.json().then(jsonData => {
                    if (jsonData?.payload && jsonData.payload.tickets && jsonData.payload.tickets.length > 0) {
                        const availableMaps = jsonData.payload.tickets.filter(ticket => ticket.entity_type === 'map')
                        const attackingFirst = jsonData.payload.tickets.filter(ticket => ticket.entity_type === 'attacking_first')
                        const heroes = jsonData.payload.tickets.filter(ticket => ticket.entity_type === 'heroes')
                        for (let i = 0; i < mapNumber * 3; i += 3) {
                            const availableMap = availableMaps[mapNumber - 1]
                            if (availableMap) {
                                const pickedMap = availableMap.entities.filter(entity => entity.status === 'pick')[0]
                                if (pickedMap) {
                                    const map = {
                                        selectedBy: pickedMap.selected_by,
                                        image: pickedMap.properties.image_lg,
                                        name: pickedMap.properties.class_name,
                                    }
                                    const attackerItem = attackingFirst[mapNumber - 1].entities.filter(entity => entity.status === 'pick')[0]
                                    const attacker = {
                                        selectedBy: attackerItem.selected_by,
                                        attackingFirst: attackerItem.properties.game_attacking_first_id,
                                    }
                                    const bans = heroes[mapNumber - 1].entities.filter(entity => entity.status === 'drop').map(drop => ({
                                        selectingTeam: drop.selected_by,
                                        heroName: drop.properties.name,
                                        heroImage: drop.properties.image_lg,
                                    }))
                                    this.seriesData.standings[`match${mapNumber}`] = {
                                        map,
                                        attacker,
                                        bans: {
                                            team1: bans.filter(ban => ban.selectingTeam === 'faction1')[0],
                                            team2: bans.filter(ban => ban.selectingTeam === 'faction2')[0],
                                        }
                                    }
                                }
                            }
                        }
                    }
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
                    this.sendUpdatedStateToCaller(res)
                })
            } else {
                console.log('No faceIt matchId present.')
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
            console.log('team1UpdateBan', bannedHeroName)
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
            console.log('team1UpdateBan', bannedHeroName)
        }
        this.sendUpdatedStateToCaller(res)
    }

    getSeriesData(): SeriesData {
        return this.seriesData
    }
}
