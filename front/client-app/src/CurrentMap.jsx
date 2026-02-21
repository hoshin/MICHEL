import {DEFAULT_STATE, WEBSOCKET_URL} from "./config.js";
import {useState} from "react";

const socket = new WebSocket(WEBSOCKET_URL)

socket.addEventListener('open', event => {
    socket.send(JSON.stringify({ init: 1}) )
})

let setTeamsDataWS = () => {}
socket.addEventListener('message', event => {
    setTeamsDataWS(JSON.parse(event.data))
})

function CurrentMap() {
    const [teamsData, setTeamsData] = useState(DEFAULT_STATE)
    setTeamsDataWS = setTeamsData

    return (
        <span>{teamsData.display.mapCount}</span>
    )
}

export default CurrentMap;