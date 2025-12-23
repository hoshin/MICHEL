import express from "express";
import {
    decreaseMapCount, fetchFaceItMatchUpdates,
    home,
    increaseMapCount,
    initData, initialMatchDataFromFaceItMatchId,
    swapTeams,
    team1DecreaseScore,
    team1IncreaseScore,
    team1UpdateName,
    team2DecreaseScore,
    team2IncreaseScore,
    team2UpdateName,
    toggleOptionalLogoDisplay,
    updateMapFormat,
    updateTeam1Logo,
    updateTeam2Logo,
    updateTournamentLogo
} from "./handlers/home";
import {WebSocketServer} from "ws"

let serverSocket = null

const appPort = 3000
const connectionPool = []
const app = express()
const server = app.listen(appPort, () => {
    initData(connectionPool)
    console.log(`M.I.C.H.E.L. listening on port : ${appPort}`)
    // Management Interface for Casting Hosts Enjoying Lightness
})
app.use(express.json())

app.get('/', (req, res) => home(req, res, connectionPool))

app.post('/team1-increase-score', (req, res) => team1IncreaseScore(req, res, connectionPool))
app.post('/team1-decrease-score', (req, res) => team1DecreaseScore(req, res, connectionPool))
app.post('/team2-increase-score', (req, res) => team2IncreaseScore(req, res, connectionPool))
app.post('/team2-decrease-score', (req, res) => team2DecreaseScore(req, res, connectionPool))
app.post('/increase-map-count', (req, res) => increaseMapCount(req, res, connectionPool))
app.post('/decrease-map-count', (req, res) => decreaseMapCount(req, res, connectionPool))
app.post('/swap-teams', (req, res) => swapTeams(req, res, connectionPool))
server.on('upgrade', (req, socket, head) => {
    wsServer.handleUpgrade(req, socket, head, socket => {
        serverSocket = socket
        wsServer.emit('connection', socket, req)
    })
})
const wsServer = new WebSocketServer({ noServer: true })
wsServer.on('connection', socket => {
    connectionPool.push(socket)
    socket.on('message', buffer => {
        const command = JSON.parse(buffer.toString('utf8'))
        if(process.env.DEBUG){
            console.log('[DEBUG] Incoming command: ', command)
        }
        switch(command.command){
            case 'increaseTeam1Score': team1IncreaseScore(null, null, connectionPool);break;
            case 'increaseTeam2Score': team2IncreaseScore(null, null, connectionPool);break;
            case 'decreaseTeam1Score': team1DecreaseScore(null, null, connectionPool);break;
            case 'decreaseTeam2Score': team2DecreaseScore(null, null, connectionPool);break;
            case 'updateTeam1Name': team1UpdateName(null, null, connectionPool, command.value);break;
            case 'updateTeam2Name': team2UpdateName(null, null, connectionPool, command.value);break;
            case 'swapTeams': swapTeams(null, null, connectionPool);break;
            case 'increaseMapCount': increaseMapCount(null, null, connectionPool);break;
            case 'decreaseMapCount': decreaseMapCount(null, null, connectionPool);break;
            case 'updateMapFormat': updateMapFormat(null, null, connectionPool, command.value);break;
            case 'updateTeam1Logo': updateTeam1Logo(null, null, connectionPool, command.value);break;
            case 'updateTeam2Logo': updateTeam2Logo(null, null, connectionPool, command.value);break;
            case 'updateTournamentLogo' : updateTournamentLogo(null, null, connectionPool, command.value);break;
            case 'toggleOptionalLogoDisplay' : toggleOptionalLogoDisplay(null, null, connectionPool);break;
            case 'updateFromMatchId': initialMatchDataFromFaceItMatchId(null, null, connectionPool, command.value);break;
            case 'fetchFaceItMatchUpdates': fetchFaceItMatchUpdates(null, null, connectionPool, command.value); break
            default: home(null, null, connectionPool)
        }
    })
})

export default { server }