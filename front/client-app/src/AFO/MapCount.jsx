import './mapCount.css'
import {DEFAULT_LOGO} from "../config.js";

export function MapCount(props) {
    const logo =  props.tournamentLogo || DEFAULT_LOGO
    const {mapCount, mapFormat} = props
    return <div className="middle" >
        <div className="map-count-block">
            <img className="tournament-logo" src={logo}/>
            <div className="middle-text">Map {mapCount} - {mapFormat}</div>
        </div>
    </div>
}
