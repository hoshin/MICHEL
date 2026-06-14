import "./GameScene.css";
import LeftBar from "./LeftBar.jsx";
import RightBar from "./RightBar.jsx";
import { MapCount } from "./MapCount.jsx";
import { useTeamsData } from "./teamsDataSocket.ts";

function GameScene() {
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
  const { right, mapCount, mapFormat, tournamentLogo } = teamsData.display;
  const { standings } = teamsData;
  const bansToShow = !!standings[`match${mapCount}`];

  if (bansToShow) {
    console.log(mapCount, standings);
  }

  const originalOrder = right === "team1";
  return (
    <div className="fullscreen">
      {originalOrder ? (
        <>
          <div className="header">
            <LeftBar
              teamName={team1Name}
              teamLogo={team1Logo}
              teamScore={team1Score}
              teamBan={bansToShow && standings[`match${mapCount}`].bans.team1}
            />
            <RightBar
              teamName={team2Name}
              teamLogo={team2Logo}
              teamScore={team2Score}
              teamBan={bansToShow && standings[`match${mapCount}`].bans.team2}
            />
          </div>
        </>
      ) : (
        <>
          <div className="header">
            <LeftBar
              teamName={team2Name}
              teamLogo={team2Logo}
              teamScore={team2Score}
              teamBan={bansToShow && standings[`match${mapCount}`].bans.team2}
            />
            <RightBar
              teamName={team1Name}
              teamLogo={team1Logo}
              teamScore={team1Score}
              teamBan={bansToShow && standings[`match${mapCount}`].bans.team1}
            />
          </div>
        </>
      )}
      <div className="footer">
        <MapCount
          mapCount={mapCount}
          mapFormat={mapFormat}
          tournamentLogo={tournamentLogo}
        ></MapCount>
      </div>
    </div>
  );
}

export default GameScene;
