import WSWrapper from "./WSWrapper.jsx";

const render = (teamsData, socket, ownProps) => {
    return <span>{teamsData[`team${ownProps.team}`].score}</span>
}

function TeamScore(props) {
    return <WSWrapper renderFunction={render} componentProps={props}/>
}

export default TeamScore;