import {DEFAULT_STATE, WEBSOCKET_URL} from "./config.js";
import {useState} from "react";
import {portraits} from "./TeamBanInput.jsx";

const socket = new WebSocket(WEBSOCKET_URL)

socket.addEventListener('open', event => {
    socket.send(JSON.stringify({ init: 1}) )
})

let setTeamsDataWS = () => {}
socket.addEventListener('message', event => {
    console.log('Data from back', event.data)
    setTimeout(setTeamsDataWS(JSON.parse(event.data)), 1500)
})

function TeamBan(props) {
    const [teamsData, setTeamsData] = useState(DEFAULT_STATE)
    setTeamsDataWS = setTeamsData
    const matchIndex = `match${teamsData.display.mapCount}`
    const currentRound = teamsData.standings[matchIndex]
    const currentRoundBanForTeam = currentRound.bans[`team${props.team}`]
    return (
        <img src={portraits[currentRoundBanForTeam.heroImage]}/>
    )
}

export default TeamBan;