const express = require('express')
const ws = require('ws')
const app = express()
const port = 3000

const { home, swapTeams, team1IncreaseScore, team1DecreaseScore, team2IncreaseScore, team2DecreaseScore,
    team1UpdateName, team2UpdateName, decreaseMapCount, increaseMapCount, updateMapFormat,
    updateTeam1Logo, updateTeam2Logo, updateTournamentLogo, toggleOptionalLogoDisplay, updateFromMatchId
} = require('./handlers/home')
const {initData} = require("./handlers/home.js");

let serverSocket = null

const connectionPool = []
app.use(express.json())

app.get('/', (req, res) => home(req, res, connectionPool))

app.post('/team1-increase-score', (req, res) => team1IncreaseScore(req, res, connectionPool))
app.post('/team1-decrease-score', (req, res) => team1DecreaseScore(req, res, connectionPool))
app.post('/team2-increase-score', (req, res) => team2IncreaseScore(req, res, connectionPool))
app.post('/team2-decrease-score', (req, res) => team2DecreaseScore(req, res, connectionPool))
app.post('/increase-map-count', (req, res) => increaseMapCount(req, res, connectionPool))
app.post('/decrease-map-count', (req, res) => decreaseMapCount(req, res, connectionPool))
app.post('/swap-teams', (req, res) => swapTeams(req, res, connectionPool))

const server = app.listen(port, () => {
    initData(connectionPool)
    console.log(`M.I.C.H.E.L. listening on port : ${port}`)
    // Management Interface for Casting Hosts Enjoying Lightness
})

server.on('upgrade', (req, socket, head) => {
    wsServer.handleUpgrade(req, socket, head, socket => {
        serverSocket = socket
        wsServer.emit('connection', socket, req)
    })
})
const wsServer = new ws.WebSocketServer({ noServer: true })
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
            case 'updateFromMatchId': updateFromMatchId(null, null, connectionPool, command.value);break;
            default: home(null, null, connectionPool)
        }
    })
})