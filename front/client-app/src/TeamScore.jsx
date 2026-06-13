import { useTeamsData } from "./teamsDataSocket.ts";

function TeamScore(props) {
  const { teamsData } = useTeamsData();

  return <span>{teamsData[`team${props.team}`].score}</span>;
}

export default TeamScore;
