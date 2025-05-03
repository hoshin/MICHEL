function RightScore({teamName, teamLogo, teamScore}) {

    return <div className="right-cast-bar">
        <div className="right-cast-score">{teamScore}</div>
        <img src={teamLogo} className="right-cast-logo"/>
        <div className="right-cast-name">{teamName}</div>
    </div>
}

export default RightScore;