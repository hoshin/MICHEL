import { useTeamsData } from "./teamsDataSocket.ts";

function CurrentMap() {
  const { teamsData } = useTeamsData();

  return <span>{teamsData.display.mapCount}</span>;
}

export default CurrentMap;
