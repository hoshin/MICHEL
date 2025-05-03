import './MapSetup.css'

function MapSetup({increaseMapCount, decreaseMapCount, updateMapFormat, mapFormat, mapCount}) {
    return <div className={'map-setup'}>
        Format : <input type="text" onChange={updateMapFormat} defaultValue={mapFormat}/>
        <div className={'map-setup-buttons'}>
            <button onClick={increaseMapCount}>+</button>
            <span>Current map : {mapCount}</span>
            <button onClick={decreaseMapCount}>-</button>
        </div>
    </div>
}

export default MapSetup;