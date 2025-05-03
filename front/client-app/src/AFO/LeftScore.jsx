import './LeftScore.css'
function LeftScore({teamName, teamLogo, teamScore}) {

    return <div className="left-cast-bar">
        <p className="left-cast-name">{teamName}</p>


        {/*<svg viewBox="0 0 90 20" className={"team-name-svg"}>*/}
        {/*    <text x="0" y="15">{teamName}</text>*/}
        {/*</svg>*/}

        <img src={teamLogo} className="left-cast-logo"/>
        <div className="left-cast-score">{teamScore}</div>
    </div>
}

export default LeftScore;