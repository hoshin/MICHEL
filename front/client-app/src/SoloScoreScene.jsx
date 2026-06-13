import "./SoloScoreScene.css";

import { DEFAULT_LOGO } from "./config.js";
import { useTeamsData } from "./teamsDataSocket.ts";

function SoloScoreScene() {
  const { teamsData } = useTeamsData();
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
