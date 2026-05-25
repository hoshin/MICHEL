import { useState } from "react";
import "./SoloScoreScene.css";

import { DEFAULT_LOGO, DEFAULT_STATE, WEBSOCKET_URL } from "./config.js";

const socket = new WebSocket(WEBSOCKET_URL);

socket.addEventListener("open", (event) => {
  socket.send(JSON.stringify({ init: 1 }));
});

let setTeamsDataWS = () => {};
socket.addEventListener("message", (event) => {
  setTeamsDataWS(JSON.parse(event.data));
});

function SoloScoreScene() {
  const [teamsData, setTeamsData] = useState(DEFAULT_STATE);
  setTeamsDataWS = setTeamsData;
  const { score: team1Score } = teamsData.team1;
  const { score: team2Score } = teamsData.team2;
  const { customCounter, tournamentLogo, optionalLogoDisplay } =
    teamsData.display;
  const logo = tournamentLogo || DEFAULT_LOGO;
  console.log(logo, optionalLogoDisplay, tournamentLogo);
  return (
    <div className="header solo-score">
      <div className="left-solo-score">
        <span>Wins : {team1Score} |</span>
      </div>
      <div className="draws-panel">
        &nbsp;<span>Draws : {customCounter}</span>&nbsp;
      </div>
      <div className="right-solo-score">
        <span>| Losses : {team2Score}</span>
      </div>
    </div>
  );
}

export default SoloScoreScene;
