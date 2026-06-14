import { portraits } from "./TeamBanInput.jsx";
import { useTeamsData } from "./teamsDataSocket.ts";

function TeamBan(props) {
  const { teamsData } = useTeamsData();
  const matchIndex = `match${teamsData.display.mapCount}`;
  const currentRound = teamsData.standings[matchIndex];
  const currentRoundBanForTeam = currentRound.bans[`team${props.team}`];
  return <img src={portraits[currentRoundBanForTeam.heroImage]} />;
}

export default TeamBan;
