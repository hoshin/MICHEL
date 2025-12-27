import { useState } from 'react'
import './components/TeamForm.jsx'
import {TeamForm} from "./components/TeamForm.jsx";
import MapSetup from "./components/MapSetup.jsx";

import './ConfigurationCenter.css'
import {DEFAULT_LOGO, DEFAULT_STATE, WEBSOCKET_URL} from "./config.js";

const socket = new WebSocket(WEBSOCKET_URL)

socket.addEventListener('open', event => {
    socket.send(JSON.stringify({ init: 1}) )
})

let setTeamsDataWS = () => {}
socket.addEventListener('message', event => {
    setTeamsDataWS(JSON.parse(event.data))
})

function ConfigurationCenter() {
    const [teamsData, setTeamsData] = useState(DEFAULT_STATE)

    setTeamsDataWS = setTeamsData

    const sendCommandHandler = (command) => (event) => {
        event.preventDefault()
        socket.send(JSON.stringify({ command, value: event.target.value }) )
    }

    const { score: team1Score, name: team1Name, logo: team1Logo } = teamsData.team1
    const { score: team2Score, name: team2Name, logo: team2Logo } = teamsData.team2
    const { mapFormat, mapCount, tournamentLogo, optionalLogoDisplay } = teamsData.display
    const { faceIt } = teamsData

    const { standings } = teamsData
    const logo = tournamentLogo || DEFAULT_LOGO
    const bansToShow = !!standings[`match${mapCount}`]
    if(bansToShow){
        console.log(mapCount, standings)
    }
  return (
    <div className="configuration-center-app">
        <section>
            <div className="app-name">M.I.C.H.E.L.</div>
        </section>
        <section className="main-interface">
            <TeamForm
                teamUpdateName={sendCommandHandler('updateTeam1Name')}
                teamIncreaseScore={sendCommandHandler('increaseTeam1Score')}
                teamDecreaseScore={sendCommandHandler('decreaseTeam1Score')}
                teamName={team1Name}
                teamScore={team1Score}
                teamLogo={team1Logo}
                teamBanLogo={bansToShow && standings[`match${mapCount}`].bans.team1.heroImage}
                updateTeamLogo={sendCommandHandler('updateTeam1Logo')}
                side={'team1'}
            />
            <TeamForm
                teamUpdateName={sendCommandHandler('updateTeam2Name')}
                teamIncreaseScore={sendCommandHandler('increaseTeam2Score')}
                teamDecreaseScore={sendCommandHandler('decreaseTeam2Score')}
                teamName={team2Name}
                teamScore={team2Score}
                teamLogo={team2Logo}
                teamBanLogo={bansToShow && standings[`match${mapCount}`].bans.team2.heroImage}
                updateTeamLogo={sendCommandHandler('updateTeam2Logo')}
                side={'team2'}
            />
        </section>
        <section className="secondary-setup">
            <MapSetup increaseMapCount={sendCommandHandler('increaseMapCount')} decreaseMapCount={sendCommandHandler('decreaseMapCount')} updateMapFormat={sendCommandHandler('updateMapFormat')} mapFormat={mapFormat} mapCount={mapCount} />

            <button className="big-button" onClick={sendCommandHandler('swapTeams')}>
                Swap Teams
            </button>
        </section>

        <section className="secondary-setup configuration-footer">
            <div className="line"><div>Logo</div><input width={'50%'} type="text" onChange={sendCommandHandler('updateTournamentLogo')} defaultValue={tournamentLogo}/></div>
            <div className="line logo-preview"><img height="60px" src={logo}></img>
            <div>Show in mini-score</div><input type="checkbox" onChange={sendCommandHandler('toggleOptionalLogoDisplay')} checked={optionalLogoDisplay}/></div>
        </section>

        <section className="secondary-setup configuration-footer">
            <div className="line"><div>FaceIt match ID</div><input width={'50%'} type="text" onChange={sendCommandHandler('updateFromMatchId')} defaultValue={faceIt?.matchId}/></div>
            <button className="big-button" value={mapCount} onClick={sendCommandHandler('fetchFaceItMatchUpdates')}>
                Update room data
            </button>
        </section>

    </div>
  )
}

export default ConfigurationCenter
