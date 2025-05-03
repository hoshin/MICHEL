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
    }
}

function sendUpdatedStateToCaller(res, connectionPool) {
    if (res) {
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

// export const generalDataWS = (connectionPool) => {
//     connectionPool.forEach(socket => {
//         socket.send(JSON.stringify(seriesData))
//     })
// }


// export const update = (req, res, socket) => {
//     seriesData = req.body.payload
//     res.json(seriesData)
// }

export const swapTeams = (req, res, connectionPool) => {
    const rightTeam = seriesData.display.right
    const leftTeam = seriesData.display.left
    seriesData.display.right = leftTeam
    seriesData.display.left = rightTeam
    console.log('swapTeams')

    sendUpdatedStateToCaller(res, connectionPool)
}

export const team1IncreaseScore = (req, res, connectionPool) => {
    seriesData.team1.score++
    console.log('team1IncreaseScore')

    sendUpdatedStateToCaller(res, connectionPool)
}

export const team2IncreaseScore = (req, res, connectionPool) => {
    seriesData.team2.score++
    console.log('team2IncreaseScore')

    sendUpdatedStateToCaller(res, connectionPool)
}


export const team1DecreaseScore = (req, res, connectionPool) => {
    if(seriesData.team1.score>0){
        seriesData.team1.score--
    }
    console.log('team1DecreaseScore')

    sendUpdatedStateToCaller(res, connectionPool)
}

export const team2DecreaseScore = (req, res, connectionPool) => {
    if(seriesData.team2.score>0) {
        seriesData.team2.score--
    }
    console.log('team2DecreaseScore')

    sendUpdatedStateToCaller(res, connectionPool)
}

export const team1UpdateName = (req, res, connectionPool, newName) => {
    seriesData.team1.name = newName
    console.log('team1UpdateName')

    sendUpdatedStateToCaller(res, connectionPool)
}

export const team2UpdateName = (req, res, connectionPool, newName) => {
    seriesData.team2.name = newName
    console.log('team2UpdateName')

    sendUpdatedStateToCaller(res, connectionPool)
}

export const updateMapFormat = (req, res, connectionPool, newFormat) => {
    seriesData.display.mapFormat = newFormat
    console.log('updateMapFormat')

    sendUpdatedStateToCaller(res, connectionPool)
}

export const updateTeam1Logo = (req, res, connectionPool, newLogo) => {
    seriesData.team1.logo = newLogo
    console.log('updateTeam1Logo')

    sendUpdatedStateToCaller(res, connectionPool)
}

export const updateTournamentLogo = (req, res, connectionPool, newLogo) => {
    seriesData.display.tournamentLogo = newLogo
    console.log('updateTournamentLogo')

    sendUpdatedStateToCaller(res, connectionPool)
}

export const updateTeam2Logo = (req, res, connectionPool, newLogo) => {
    seriesData.team2.logo = newLogo
    console.log('updateTeam2Logo')

    sendUpdatedStateToCaller(res, connectionPool)
}

export const toggleOptionalLogoDisplay = (req, res, connectionPool, newLogo) => {
    seriesData.display.optionalLogoDisplay = !seriesData.display.optionalLogoDisplay
    console.log('updateOptionalLogoDisplay')

    sendUpdatedStateToCaller(res, connectionPool)
}

export const increaseMapCount = (req, res, connectionPool) => {
    seriesData.display.mapCount++
    console.log('increaseMapCount')

    sendUpdatedStateToCaller(res, connectionPool)
}

export const decreaseMapCount = (req, res, connectionPool) => {
    if(seriesData.display.mapCount>1){
        seriesData.display.mapCount--
    }
    console.log('decreaseMapCount')
    sendUpdatedStateToCaller(res, connectionPool)
}