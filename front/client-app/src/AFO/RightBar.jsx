import './RightBar.css'
function RightBar({teamName, teamLogo, teamScore}) {

    return <div className="right-bar">
        <div className="right-score">{teamScore}</div>
        <img src={teamLogo} className="right-logo"/>
        <div className="right-name">{teamName}</div>
    </div>
}

export default RightBar;