import { useState } from 'react'
import './GameScene.css'
import LeftBar from "./LeftBar.jsx";
import RightBar from "./RightBar.jsx";
import { MapCount } from "./MapCount.jsx";
import {DEFAULT_STATE, WEBSOCKET_URL} from "../config.js";


const socket = new WebSocket(WEBSOCKET_URL)

socket.addEventListener('open', event => {
    socket.send(JSON.stringify({ init: 1}) )
})

let setTeamsDataWS = () => {}
socket.addEventListener('message', event => {
    setTeamsDataWS(JSON.parse(event.data))
})

function GameScene() {
    const [teamsData, setTeamsData] = useState(DEFAULT_STATE)
    setTeamsDataWS = setTeamsData
    const { score: team1Score, name: team1Name, logo: team1Logo } = teamsData.team1
    const { score: team2Score, name: team2Name, logo: team2Logo } = teamsData.team2
    const { right, mapCount, mapFormat, tournamentLogo } = teamsData.display

    const originalOrder = right === 'team1'
    return (
        <div className="fullscreen">
          { originalOrder ? <>
              <div className="header">
                  <LeftBar teamName={team1Name} teamLogo={team1Logo} teamScore={team1Score}/>
                  <RightBar teamName={team2Name} teamLogo={team2Logo} teamScore={team2Score}/>
              </div>
          </> :
          <>
              <div className="header">
                  <LeftBar teamName={team2Name} teamLogo={team2Logo} teamScore={team2Score}/>
                  <RightBar teamName={team1Name} teamLogo={team1Logo} teamScore={team1Score}/>
              </div>
          </> }
        <div className="footer">
          <MapCount mapCount={mapCount} mapFormat={mapFormat} tournamentLogo={tournamentLogo}></MapCount>
        </div>
      </div>
    )
}

export default GameScene;
