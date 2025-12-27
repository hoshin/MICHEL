import express from 'express'
import { WebSocketServer } from 'ws'
const app = express()
const port = 3000

import {
    MichelBackService
} from './handlers/home.js'

let serverSocket = null
const connectionPool = []
let michelBackService: MichelBackService = new MichelBackService(connectionPool, process.env.DEBUG === 'true')

app.use(express.json())

app.get('/', (_, res) => michelBackService.home(res))
app.post('/team1-increase-score', (_, res) => michelBackService.team1IncreaseScore(res))
app.post('/team1-decrease-score', (_, res) => michelBackService.team1DecreaseScore(res))
app.post('/team2-increase-score', (_, res) => michelBackService.team2IncreaseScore(res))
app.post('/team2-decrease-score', (_, res) => michelBackService.team2DecreaseScore(res))
app.post('/custom-counter-increase', (_, res) => michelBackService.increaseCustomCounter(res))
app.post('/custom-counter-decrease', (_, res) => michelBackService.decreaseCustomCounter(res))
app.post('/increase-map-count', (_, res) => michelBackService.increaseMapCount(res))
app.post('/decrease-map-count', (_, res) => michelBackService.decreaseMapCount(res))
app.post('/swap-teams', (_, res) => michelBackService.swapTeams(res))

const server = app.listen(port, () => {
    console.log(`M.I.C.H.E.L. backend service listening on port : ${port}`)
})

server.on('upgrade', (req, socket, head) => {
    wsServer.handleUpgrade(req, socket, head, socket => {
        serverSocket = socket
        wsServer.emit('connection', socket, req)
    })
})
const wsServer = new WebSocketServer({ noServer: true })
wsServer.on('connection', socket => {
    console.info(`New connection from ${socket.host}`)
    michelBackService.updateConnectionPool(socket)
    socket.on('message', buffer => {
        michelBackService.handleCommand(buffer)
    })
})