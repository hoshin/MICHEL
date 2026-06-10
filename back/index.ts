import express, { Request, Response } from 'express'
import { WebSocketServer } from 'ws'
const app = express()
const port = 3000

import {
    MichelBackService,
    SeriesData
} from './handlers/home.js'

let serverSocket = null
const connectionPool = []
let michelBackService: MichelBackService = new MichelBackService(connectionPool, process.env.DEBUG === 'true')

app.use(express.json())

/**
 * Wraps a synchronous service call: executes it, sends the resulting
 * SeriesData as a JSON response, and broadcasts the updated state to all
 * connected WebSocket clients.
 */
const updateSeriesStateAndReturnItAsJSON = (fn: () => SeriesData) => (_: Request, res: Response) => {
    res.json(fn())
    michelBackService.broadcastState()
}

app.get('/', updateSeriesStateAndReturnItAsJSON(() => michelBackService.home()))
app.post('/team1-increase-score', updateSeriesStateAndReturnItAsJSON(() => michelBackService.teamIncrementScore('team1', 1)))
app.post('/team1-decrease-score', updateSeriesStateAndReturnItAsJSON(() => michelBackService.teamIncrementScore('team1', -1)))
app.post('/team2-increase-score', updateSeriesStateAndReturnItAsJSON(() => michelBackService.teamIncrementScore('team2', 1)))
app.post('/team2-decrease-score', updateSeriesStateAndReturnItAsJSON(() => michelBackService.teamIncrementScore('team2', -1)))
app.post('/custom-counter-increase', updateSeriesStateAndReturnItAsJSON(() => michelBackService.increaseCustomCounter()))
app.post('/custom-counter-decrease', updateSeriesStateAndReturnItAsJSON(() => michelBackService.decreaseCustomCounter()))
app.post('/increase-map-count', updateSeriesStateAndReturnItAsJSON(() => michelBackService.updateMapCountAndRefreshFaceItDataIfNeeded(1)))
app.post('/decrease-map-count', updateSeriesStateAndReturnItAsJSON(() => michelBackService.updateMapCountAndRefreshFaceItDataIfNeeded(-1)))
app.post('/swap-teams', updateSeriesStateAndReturnItAsJSON(() => michelBackService.swapTeams()))

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
    michelBackService.updateConnectionPool(socket)
    socket.on('message', buffer => {
        michelBackService.handleCommand(buffer)
    })
})