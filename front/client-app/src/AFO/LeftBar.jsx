function LeftBar({teamName, teamLogo, teamScore}) {

    return <div className="left-bar">
        <p className="left-name">{teamName}</p>
        <img src={teamLogo} className="left-logo"/>
        <div className="left-score">{teamScore}</div>
    </div>
}

export default LeftBar;