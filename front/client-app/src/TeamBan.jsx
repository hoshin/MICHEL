import {portraits} from "./TeamBanInput.jsx";
import WSWrapper from "./WSWrapper.jsx";

const render = (teamsData, socket, props) => {
    const matchIndex = `match${teamsData.display.mapCount}`
    const currentRound = teamsData.standings[matchIndex]
    const currentRoundBanForTeam = currentRound.bans[`team${props.team}`]
    return (
        <img src={portraits[currentRoundBanForTeam.heroImage]}/>
    )
}

function TeamBan(props){
    return (<WSWrapper renderFunction={render} componentProps={props}/>)
}

export default TeamBan;