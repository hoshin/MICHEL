import './TeamForm.css'

export function TeamForm(props) {
    return (
        <div className={`${props.side}-form team-layout`}>
            <div className="line header"><img src={props.teamLogo}></img> <span className="score"> {props.teamScore}</span></div>
            <div className="line"><div className="section-name">Name</div><input width={'80%'} type="text" onChange={props.teamUpdateName} defaultValue={props.teamName}/></div>
            <div className="line">
                <div className="section-name">Score</div>
                <div className="sub-line">
                    <button className="button" onClick={props.teamIncreaseScore}>+</button>
                    <button className="button" onClick={props.teamDecreaseScore}>-</button>
                </div>
            </div>
            <div className="line"><div className="section-name">Logo</div><input width={'50%'} type="text" onChange={props.updateTeamLogo} defaultValue={props.teamLogo}/></div>
        </div>
    )
}