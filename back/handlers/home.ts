import * as fs from "fs"
import { Response} from "express"

let seriesData = {
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
    standings: {
    }
}

export class MichelBackService {
    private connectionPool: any
    private debug: boolean
    constructor(connectionPool, debug: boolean) {
        this.connectionPool = connectionPool
        this.debug = debug
        try{
            const configFile = fs.readFileSync('./back/config.json')
            console.log('Config file present ... updating seriesData!')
            const jsonSeriesConfigurationFromFile = JSON.parse(configFile.toString('utf8')).seriesData

            if(jsonSeriesConfigurationFromFile?.faceIt?.matchId?.length > 0) {
                console.log(`FaceIt matchID present in config file! Building series data with it! ${jsonSeriesConfigurationFromFile.faceIt.matchId}`)
                this.initialMatchDataFromFaceItMatchId(null, jsonSeriesConfigurationFromFile.faceIt.matchId)
            } else {
                seriesData = jsonSeriesConfigurationFromFile
            }
        } catch (error){
            console.warn('No config file found! Initializing seriesData with default values.')
            console.warn(error.message)
        }
    }
    
    updateConnectionPool(socket) {
        this.connectionPool.push(socket)
    }
    
    handleCommand(payloadAsBuffer: Buffer) {
        const payload = JSON.parse(payloadAsBuffer.toString('utf8'))
        if(this.debug){
            console.log('[DEBUG] Incoming command: ', payload)
        }
        switch(payload.command){
            case 'increaseTeam1Score': this.team1IncreaseScore(null);break;
            case 'increaseTeam2Score': this.team2IncreaseScore(null);break;
            case 'decreaseTeam1Score': this.team1DecreaseScore(null);break;
            case 'decreaseTeam2Score': this.team2DecreaseScore(null);break;
            case 'updateTeam1Name': this.team1UpdateName(null, payload.value);break;
            case 'updateTeam2Name': this.team2UpdateName(null, payload.value);break;
            case 'swapTeams': this.swapTeams(null);break;
            case 'increaseMapCount': this.increaseMapCount(null);break;
            case 'decreaseMapCount': this.decreaseMapCount(null);break;
            case 'updateMapFormat': this.updateMapFormat(null, payload.value);break;
            case 'updateTeam1Logo': this.updateTeam1Logo(null, payload.value);break;
            case 'updateTeam2Logo': this.updateTeam2Logo(null, payload.value);break;
            case 'updateTournamentLogo' : this.updateTournamentLogo(null, payload.value);break;
            case 'toggleOptionalLogoDisplay' : this.toggleOptionalLogoDisplay(null);break;
            case 'updateFromMatchId': this.initialMatchDataFromFaceItMatchId(null, payload.value);break;
            case 'fetchFaceItMatchUpdates': this.fetchFaceItMatchUpdates(null, payload.value); break;
            case 'increaseCustomCounter': this.increaseCustomCounter(null); break;
            case 'decreaseCustomCounter': this.decreaseCustomCounter(null); break;
            default: this.home(null)
        }
    }
    
    home(res: Response) {
        this.sendUpdatedStateToCaller(res)
    }
    
    sendUpdatedStateToCaller(res: Response) {
        if (res && !res.headersSent) {
            res.json(seriesData)
        }
        if (this.connectionPool) {
            this.connectionPool.forEach(socket => {
                socket.send(JSON.stringify(seriesData))
            })
        }
    }

    swapTeams = (res: Response) => {
        const rightTeam = seriesData.display.right
        const leftTeam = seriesData.display.left
        seriesData.display.right = leftTeam
        seriesData.display.left = rightTeam
        if(this.debug){
            console.log('swapTeams')
        }

        this.sendUpdatedStateToCaller(res)
        // this.sendUpdatedStateToCaller(res)
    }

    team1IncreaseScore = (res: Response) => {
        seriesData.team1.score++
        if(this.debug){
            console.log('team1IncreaseScore')
        }

        this.sendUpdatedStateToCaller(res)
    }

    team2IncreaseScore = (res: Response) => {
        seriesData.team2.score++
        if(this.debug){
            console.log('team2IncreaseScore')
        }

        this.sendUpdatedStateToCaller(res)
    }


    team1DecreaseScore = (res: Response) => {
        if(seriesData.team1.score>0){
            seriesData.team1.score--
        }
        if(this.debug){
            console.log('team1DecreaseScore')
        }

        this.sendUpdatedStateToCaller(res)
    }

    team2DecreaseScore = (res: Response) => {
        if(seriesData.team2.score>0) {
            seriesData.team2.score--
        }
        if(this.debug){
            console.log('team2DecreaseScore')
        }

        this.sendUpdatedStateToCaller(res)
    }

    team1UpdateName = (res: Response, newName: string) => {
        seriesData.team1.name = newName
        if(this.debug){
            console.log('team1UpdateName')
        }

        this.sendUpdatedStateToCaller(res)
    }

    team2UpdateName = (res: Response, newName: string) => {
        seriesData.team2.name = newName
        if(this.debug){
            console.log('team2UpdateName')
        }

        this.sendUpdatedStateToCaller(res)
    }

    updateMapFormat = (res: Response, newFormat: string) => {
        seriesData.display.mapFormat = newFormat
        if(this.debug){
            console.log('updateMapFormat')
        }

        this.sendUpdatedStateToCaller(res)
    }

    updateTeam1Logo = (res: Response, newLogo: string) => {
        seriesData.team1.logo = newLogo
        if(this.debug){
            console.log('updateTeam1Logo')
        }

        this.sendUpdatedStateToCaller(res)
    }

    updateTournamentLogo = (res: Response, newLogo: string) => {
        seriesData.display.tournamentLogo = newLogo
        if(this.debug){
            console.log('updateTournamentLogo')
        }

        this.sendUpdatedStateToCaller(res)
    }

    updateTeam2Logo = (res: Response, newLogo: string) => {
        seriesData.team2.logo = newLogo
        if(this.debug){
            console.log('updateTeam2Logo')
        }

        this.sendUpdatedStateToCaller(res)
    }

    toggleOptionalLogoDisplay = (res: Response) => {
        seriesData.display.optionalLogoDisplay = !seriesData.display.optionalLogoDisplay
        if(this.debug){
            console.log('toggleOptionalLogoDisplay')
        }

        this.sendUpdatedStateToCaller(res)
    }

    increaseMapCount = (res: Response) => {
        seriesData.display.mapCount++
        if(this.debug){
            console.log('increaseMapCount')
        }
        if(!seriesData.faceIt[`match${seriesData.display.mapCount}`]) {
            this.fetchFaceItMatchUpdates(res, seriesData.display.mapCount)
        } else {
            this.sendUpdatedStateToCaller(res)
        }
    }

    decreaseMapCount = (res: Response) => {
        if(seriesData.display.mapCount>1){
            seriesData.display.mapCount--
        }
        if(this.debug){
            console.log('decreaseMapCount')
        }
        if(!seriesData.faceIt[`match${seriesData.display.mapCount}`]) {
            this.fetchFaceItMatchUpdates(res, seriesData.display.mapCount)
        } else {
            this.sendUpdatedStateToCaller(res)
        }
    }

    initialMatchDataFromFaceItMatchId = (res: Response, matchId: string) => {
        if(! matchId){
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
                if(response.status !== 200) {
                    return
                }
                response.json().then(jsonData => {
                    if(jsonData?.payload?.teams) {
                        const { faction1, faction2 } = jsonData.payload.teams

                        seriesData.team1.name = faction1.name
                        seriesData.team2.name = faction2.name

                        seriesData.team1.logo = faction1.avatar
                        seriesData.team2.logo = faction2.avatar

                        seriesData.faceIt.matchId = matchId
                    }

                    this.sendUpdatedStateToCaller(res)
                    return seriesData
                })

            })
            .catch(error => seriesData)
            .finally(() => seriesData)
        if(this.debug) {
            console.log(`updateFromMatchId ${matchId}`)
        }
        return seriesData
    }

    increaseCustomCounter = (res: Response) => {
        seriesData.display.customCounter++
        if(this.debug){
            console.log('increaseCustomCount')
        }
        this.sendUpdatedStateToCaller(res)
    }

    decreaseCustomCounter = (res: Response) => {
        seriesData.display.customCounter--
        if(this.debug){
            console.log('decreaseCustomCount')
        }
        this.sendUpdatedStateToCaller(res)
    }

    updatedLobbyDataFromFaceItMatchId = async (matchId: string, mapNumber: number, next: () => void) => {
        if(!matchId){
            return
        }
        // console.log('updatedLobbyDataFromFaceItMatchId', matchId, mapNumber)
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
                if(response.status !== 200) {
                    throw new Error(`Response status not 200 : ${response.status}`)
                }
                response.json().then(jsonData => {
                    if(jsonData?.payload && jsonData.payload.tickets && jsonData.payload.tickets.length >0) {
                        const availableMaps = jsonData.payload.tickets.filter(ticket => ticket.entity_type === 'map')
                        const attackingFirst = jsonData.payload.tickets.filter(ticket => ticket.entity_type === 'attacking_first')
                        const heroes = jsonData.payload.tickets.filter(ticket => ticket.entity_type === 'heroes')
                        for(let i = 0; i < mapNumber*3;i+=3){
                            const availableMap = availableMaps[mapNumber-1]
                            if(availableMap){
                                const pickedMap = availableMap.entities.filter(entity => entity.status === 'pick')[0]
                                if(pickedMap){
                                    const map = {
                                        selectedBy: pickedMap.selected_by,
                                        image: pickedMap.properties.image_lg,
                                        name: pickedMap.properties.class_name,
                                    }
                                    const attackerItem = attackingFirst[mapNumber-1].entities.filter(entity => entity.status === 'pick')[0]
                                    const attacker = {
                                        selectedBy: attackerItem.selected_by,
                                        attackingFirst: attackerItem.properties.game_attacking_first_id,
                                    }
                                    const bans = heroes[mapNumber-1].entities.filter(entity => entity.status === 'drop').map(drop => ({
                                        selectingTeam: drop.selected_by,
                                        heroName: drop.properties.name,
                                        heroImage: drop.properties.image_lg,
                                    }))
                                    //console.log(`Picks / bans round #${mapNumber}`, map, attacker, bans)
                                    seriesData.standings[`match${mapNumber}`] = {
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
            if(seriesData?.faceIt?.matchId.length > 0) {
                this.updatedLobbyDataFromFaceItMatchId(seriesData?.faceIt?.matchId, mapNumber, () => {
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
    
}
