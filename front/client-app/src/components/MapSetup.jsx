import './MapSetup.css'

function MapSetup({increaseMapCount, decreaseMapCount, updateMapFormat, mapFormat, mapCount}) {
    return <div className={'map-setup'}>
        <div className="line">
            <div>Format</div><input type="text" onChange={updateMapFormat} defaultValue={mapFormat}/>
        </div>
        <div className={'map-setup-buttons line'}>
            <button className="button" onClick={increaseMapCount}>+</button>
            <span>Current map : {mapCount}</span>
            <button className="button" onClick={decreaseMapCount}>-</button>
        </div>
    </div>
}

export default MapSetup;