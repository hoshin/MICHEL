import './ScoreScene.css'
import './RightScore.css'

function RightScore({teamName, teamLogo, teamScore}) {
    let fontClass = 'regular-font';
    if(teamName.length > 19) {
        fontClass = 'small-font'
    }
    if(teamName.length > 25) {
        fontClass = 'smallest-font'
    }

    return <div className="right-cast-bar">
        <div className="cast-team-score right-cast-score">{teamScore}</div>
        <img src={teamLogo} className="cast-team-logo right-cast-logo"/>
        <p className={`cast-team-name ${fontClass}`}>{teamName}</p>
    </div>
}

export default RightScore;