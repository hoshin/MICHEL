import { DEFAULT_LOGO, FACEIT_LOGO } from "./config.js";
import { useTeamsData } from "./teamsDataSocket.ts";

function TournamentLogo() {
  const { teamsData } = useTeamsData();
  const tournamentLogo = teamsData.display.tournamentLogo.startsWith("faceit")
    ? FACEIT_LOGO
    : (teamsData.display.tournamentLogo ?? DEFAULT_LOGO);

  return <img style={{ maxHeight: "200px" }} src={tournamentLogo} />;
}

export default TournamentLogo;
