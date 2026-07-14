import "./ScoreScene.css";
import RightScore from "./RightScore.jsx";
import LeftScore from "./LeftScore.jsx";
import { DEFAULT_LOGO, FACEIT_LOGO } from "./config.js";
import { useTeamsData } from "./teamsDataSocket.ts";

function ScoreScene() {
  const { teamsData } = useTeamsData();
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
  const { right, tournamentLogo, optionalLogoDisplay } = teamsData.display;
  const logo = tournamentLogo.startsWith("faceit")
    ? FACEIT_LOGO
    : (tournamentLogo ?? DEFAULT_LOGO);
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
