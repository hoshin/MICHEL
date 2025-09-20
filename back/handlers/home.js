import * as fs from "node:fs";

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

function sendUpdatedStateToCaller(res, connectionPool) {
    if (res && !res.headersSent) {
        res.json(seriesData)
    }
    if (connectionPool) {
        connectionPool.forEach(socket => {
            socket.send(JSON.stringify(seriesData))
        })
    }
}

export const home = (req, res, connectionPool) => {
    sendUpdatedStateToCaller(res, connectionPool)
}

export const swapTeams = (req, res, connectionPool, debug = false) => {
    const rightTeam = seriesData.display.right
    const leftTeam = seriesData.display.left
    seriesData.display.right = leftTeam
    seriesData.display.left = rightTeam
    if(debug){
        console.log('swapTeams')
    }

    sendUpdatedStateToCaller(res, connectionPool)
    sendUpdatedStateToCaller(res, connectionPool)
}

export const team1IncreaseScore = (req, res, connectionPool, debug = false) => {
    seriesData.team1.score++
    if(debug){
        console.log('team1IncreaseScore')
    }

    sendUpdatedStateToCaller(res, connectionPool)
}

export const team2IncreaseScore = (req, res, connectionPool, debug = false) => {
    seriesData.team2.score++
    if(debug){
        console.log('team2IncreaseScore')
    }

    sendUpdatedStateToCaller(res, connectionPool)
}


export const team1DecreaseScore = (req, res, connectionPool, debug = false) => {
    if(seriesData.team1.score>0){
        seriesData.team1.score--
    }
    if(debug){
        console.log('team1DecreaseScore')
    }

    sendUpdatedStateToCaller(res, connectionPool)
}

export const team2DecreaseScore = (req, res, connectionPool, debug = false) => {
    if(seriesData.team2.score>0) {
        seriesData.team2.score--
    }
    if(debug){
        console.log('team2DecreaseScore')
    }

    sendUpdatedStateToCaller(res, connectionPool)
}

export const team1UpdateName = (req, res, connectionPool, newName, debug = false) => {
    seriesData.team1.name = newName
    if(debug){
        console.log('team1UpdateName')
    }

    sendUpdatedStateToCaller(res, connectionPool)
}

export const team2UpdateName = (req, res, connectionPool, newName, debug = false) => {
    seriesData.team2.name = newName
    if(debug){
        console.log('team2UpdateName')
    }

    sendUpdatedStateToCaller(res, connectionPool)
}

export const updateMapFormat = (req, res, connectionPool, newFormat, debug = false) => {
    seriesData.display.mapFormat = newFormat
    if(debug){
        console.log('updateMapFormat')
    }

    sendUpdatedStateToCaller(res, connectionPool)
}

export const updateTeam1Logo = (req, res, connectionPool, newLogo, debug = false) => {
    seriesData.team1.logo = newLogo
    if(debug){
        console.log('updateTeam1Logo')
    }

    sendUpdatedStateToCaller(res, connectionPool)
}

export const updateTournamentLogo = (req, res, connectionPool, newLogo, debug = false) => {
    seriesData.display.tournamentLogo = newLogo
    if(debug){
        console.log('updateTournamentLogo')
    }

    sendUpdatedStateToCaller(res, connectionPool)
}

export const updateTeam2Logo = (req, res, connectionPool, newLogo, debug = false) => {
    seriesData.team2.logo = newLogo
    if(debug){
        console.log('updateTeam2Logo')
    }

    sendUpdatedStateToCaller(res, connectionPool)
}

export const toggleOptionalLogoDisplay = (req, res, connectionPool, debug = false) => {
    seriesData.display.optionalLogoDisplay = !seriesData.display.optionalLogoDisplay
    if(debug){
        console.log('toggleOptionalLogoDisplay')
    }

    sendUpdatedStateToCaller(res, connectionPool)
}

export const increaseMapCount = (req, res, connectionPool, debug = false) => {
    seriesData.display.mapCount++
    if(debug){
        console.log('increaseMapCount')
    }
    if(!seriesData.faceIt[`match${seriesData.display.mapCount}`]) {
        fetchFaceItMatchUpdates(req, res, connectionPool, seriesData.display.mapCount, debug)
    } else {
        sendUpdatedStateToCaller(res, connectionPool)
    }
}

export const decreaseMapCount = (req, res, connectionPool, debug = false) => {
    if(seriesData.display.mapCount>1){
        seriesData.display.mapCount--
    }
    if(debug){
        console.log('decreaseMapCount')
    }
    if(!seriesData.faceIt[`match${seriesData.display.mapCount}`]) {
        fetchFaceItMatchUpdates(req, res, connectionPool, seriesData.display.mapCount, debug)
    } else {
        sendUpdatedStateToCaller(res, connectionPool)
    }
}

export const initialMatchDataFromFaceItMatchId = (req, res, connectionPool, matchId, debug = false) => {
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

                sendUpdatedStateToCaller(res, connectionPool)
                return seriesData
            })

        })
        .catch(error => seriesData)
        .finally(() => seriesData)
    if(debug) {
        console.log(`updateFromMatchId ${matchId}`)
    }
    return seriesData
}

export const initData = (connectionPool) => {
    try{
        const configFile = fs.readFileSync('./back/config.json')
        console.log('Config file present ... updating seriesData!')
        const jsonSeriesConfigurationFromFile = JSON.parse(configFile.toString('utf8')).seriesData

        if(jsonSeriesConfigurationFromFile?.faceIt?.matchId?.length > 0) {
            console.log(`FaceIt matchID present in config file! Building series data with it! ${jsonSeriesConfigurationFromFile.faceIt.matchId}`)
            initialMatchDataFromFaceItMatchId(null, null, connectionPool, jsonSeriesConfigurationFromFile.faceIt.matchId)
        } else {
            seriesData = jsonSeriesConfigurationFromFile
        }
    } catch (error){
        console.warn('No config file found! Initializing seriesData with default values.')
        console.warn(error.message)
    }
}

export const updatedLobbyDataFromFaceItMatchId = async (matchId, mapNumber, next) => {
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

export const fetchFaceItMatchUpdates = (req, res, connectionPool, mapNumber, debug = false) => {
    try {
        if(seriesData?.faceIt?.matchId.length > 0) {
            updatedLobbyDataFromFaceItMatchId(seriesData?.faceIt?.matchId, mapNumber, () => {
                sendUpdatedStateToCaller(res, connectionPool)
            })
        } else {
            console.log('No faceIt matchId present.')
            sendUpdatedStateToCaller(res, connectionPool)
        }
    } catch (error) {
        console.error('Error fetching faceIt match updates:', error.message)
        sendUpdatedStateToCaller(res, connectionPool)
    }
}