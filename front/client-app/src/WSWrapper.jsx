import {DEFAULT_STATE, WEBSOCKET_URL} from "./config.js";
import {useEffect, useState} from "react";

/**
 *
 * @param props.renderFunction : rendering function for target component. will be called with 2 parameters
 *                                -> teamsData - to display information (complete match standings)
 *                                -> socket - to call the API
 *                                -> ownProps - calling component's properties, passed to the wrapper to be handed to the rendering function
 * @returns {JSX.Element}
 * @constructor
 */
function WSWrapper(props) {
    const [socket, setSocket] = useState(null)
    const [teamsData, setTeamsData] = useState(DEFAULT_STATE)

    useEffect(() => {
        const socket = new WebSocket(WEBSOCKET_URL)

        setSocket(socket)

        socket.onmessage = (event) => {
            const parsedEvent = JSON.parse(event.data)
            setTeamsData(parsedEvent)
        }
        socket.addEventListener('open', event => {
            socket.send(JSON.stringify({ init: 1 }) )
        })
        return () => {
            socket.close(undefined, 'pwet')
        }
    }, [])

    return (
        <>{props.renderFunction(teamsData, socket, props.componentProps)}</>
    )
}

export default WSWrapper;