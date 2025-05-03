import './TeamForm.css'

export function TeamForm(props) {
    return (
        <div className={`${props.side}-form .team-layout`}>
            <div className="line"><img height="40px" src={props.teamLogo}></img> <span className="score">- {props.teamScore}</span></div>
            <div className="line"><input width={'80%'} type="text" onChange={props.teamUpdateName} defaultValue={props.teamName}/></div>
            <div className="line">
                <span>Score : </span>
                <div>
                    <button className="line" onClick={props.teamIncreaseScore}>+</button>
                    <button className="line" onClick={props.teamDecreaseScore}>-</button>
                </div>
            </div>
            <div className="line"><span>Logo : </span><input width={'50%'} type="text" onChange={props.updateTeamLogo} defaultValue={props.teamLogo}/></div>
        </div>
    )
}