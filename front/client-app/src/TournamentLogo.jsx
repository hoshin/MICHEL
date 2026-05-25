import {
  DEFAULT_LOGO,
  DEFAULT_STATE,
  FACEIT_LOGO,
  WEBSOCKET_URL,
} from "./config.js";
import { useState } from "react";
import { portraits } from "./TeamBanInput.jsx";
import { Flex } from "antd";

const socket = new WebSocket(WEBSOCKET_URL);

socket.addEventListener("open", (event) => {
  socket.send(JSON.stringify({ init: 1 }));
});

let setTeamsDataWS = () => {};
socket.addEventListener("message", (event) => {
  setTimeout(setTeamsDataWS(JSON.parse(event.data)), 1500);
});

function TournamentLogo() {
  const [teamsData, setTeamsData] = useState(DEFAULT_STATE);
  setTeamsDataWS = setTeamsData;
  const tournamentLogo = teamsData.display.tournamentLogo.startsWith("faceit")
    ? FACEIT_LOGO
    : (teamsData.display.tournamentLogo ?? DEFAULT_LOGO);

  return <img style={{ maxHeight: "200px" }} src={tournamentLogo} />;
}

export default TournamentLogo;
