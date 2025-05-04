import './LeftBar.css'
function LeftBar({teamName, teamLogo, teamScore}) {
    let fontClass = 'regular-font-game';
    if(teamName.length > 19) {
        fontClass = 'small-font-game'
    }
    if(teamName.length > 25) {
        fontClass = 'smallest-font-game'
    }

    return <div className="left-bar">
        <p className={`left-name ${fontClass}`}>{teamName}</p>
        <img src={teamLogo} className="left-logo"/>
        <div className="left-score">{teamScore}</div>
    </div>
}

export default LeftBar;