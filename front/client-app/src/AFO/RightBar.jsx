import './RightBar.css'
function RightBar({teamName, teamLogo, teamScore, teamBan}) {
    let fontClass = 'regular-font-game';
    if(teamName.length > 19) {
        fontClass = 'small-font-game'
    }
    if(teamName.length > 25) {
        fontClass = 'smallest-font-game'
    }
    return <div className="right-bar">
        <div className="right-score">{teamScore}</div>
        <img src={teamLogo} className="right-logo"/>
        { teamBan && <div><img src={teamBan} className='right-ban-logo'></img><div className='right-ban-text'>BAN</div></div> }
        <p className={`right-name ${fontClass}`}>{teamName}</p>
    </div>
}

export default RightBar;