import WSWrapper from "./WSWrapper.jsx";

const render = (teamsData) => <span>{teamsData.display.mapCount}</span>

function CurrentMap() {
    return <WSWrapper renderFunction={render}/>
}

export default CurrentMap;