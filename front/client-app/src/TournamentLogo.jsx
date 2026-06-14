import { DEFAULT_LOGO, FACEIT_LOGO } from "./config.js";
import { useTeamsData } from "./teamsDataSocket.ts";

function TournamentLogo() {
  const { teamsData } = useTeamsData();
  // Pull the configured logo through optional chaining + a string default
  // so a missing or malformed `display.tournamentLogo` can never blow up
  // the `.startsWith` call below. The `|| DEFAULT_LOGO` fallback then
  // catches the case where the configured value is the empty string,
  // matching the previous intent of the `?? DEFAULT_LOGO` branch.
  const configuredLogo = teamsData?.display?.tournamentLogo ?? "";
  const tournamentLogo = configuredLogo.startsWith("faceit")
    ? FACEIT_LOGO
    : configuredLogo || DEFAULT_LOGO;

  return <img style={{ maxHeight: "200px" }} src={tournamentLogo} />;
}

export default TournamentLogo;
