import { useState } from "react";
import "./ScoreScene.css";
import RightScore from "./RightScore.jsx";
import LeftScore from "./LeftScore.jsx";
import {
  DEFAULT_LOGO,
  DEFAULT_STATE,
  FACEIT_LOGO,
  WEBSOCKET_URL,
} from "./config.js";

const socket = new WebSocket(WEBSOCKET_URL);

socket.addEventListener("open", (event) => {
  socket.send(JSON.stringify({ init: 1 }));
});

let setTeamsDataWS = () => {};
socket.addEventListener("message", (event) => {
  setTeamsDataWS(JSON.parse(event.data));
});

function ScoreScene() {
  const [teamsData, setTeamsData] = useState(DEFAULT_STATE);
  setTeamsDataWS = setTeamsData;
  const {
    score: team1Score,
    name: team1Name,
    logo: team1Logo,
  } = teamsData.team1;
  const {
    score: team2Score,
    name: team2Name,
    logo: team2Logo,
  } = teamsData.team2;
  const { right, mapCount, mapFormat, tournamentLogo, optionalLogoDisplay } =
    teamsData.display;
  const logo = tournamentLogo.startsWith("faceit")
    ? FACEIT_LOGO
    : (tournamentLogo ?? DEFAULT_LOGO);
  console.log(logo, optionalLogoDisplay, tournamentLogo);
  const originalOrder = right === "team1";
  return (
    <div style={{ padding: "10em" }}>
      {originalOrder ? (
        <>
          <div className="header cast-score">
            <LeftScore
              teamName={team1Name}
              teamLogo={team1Logo}
              teamScore={team1Score}
            />
            <div className="score-tournament-logo-container">
              <img
                className="score-tournament-logo"
                src={optionalLogoDisplay ? logo : ""}
              />
            </div>
            <RightScore
              teamName={team2Name}
              teamLogo={team2Logo}
              teamScore={team2Score}
            />
          </div>
        </>
      ) : (
        <>
          <div className="header cast-score">
            <LeftScore
              teamName={team2Name}
              teamLogo={team2Logo}
              teamScore={team2Score}
            />
            <div className="score-tournament-logo-container">
              <img
                className="score-tournament-logo"
                src={optionalLogoDisplay ? logo : ""}
              />
            </div>
            <RightScore
              teamName={team1Name}
              teamLogo={team1Logo}
              teamScore={team1Score}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default ScoreScene;
