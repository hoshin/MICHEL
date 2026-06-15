import defaultLogo from "./assets/misc_logos/logo_112.png";
import faceitLogo from "./assets/misc_logos/faceit.png";
export const DEFAULT_STATE = {
  team1: {
    name: "",
    score: 0,
    logo: "",
    ban: "",
  },
  team2: {
    name: "",
    score: 0,
    logo: "",
    ban: "",
  },
  display: {
    right: "team1",
    left: "team2",
    mapCount: 1,
    customCounter: 0,
    mapFormat: "FT3",
    tournamentLogo: "",
    optionalLogoDisplay: true,
    countdown: 0,
    countdownRunning: false,
    countdownColor: "",
  },
  standings: {
    match1: {
      bans: {
        team1: {},
        team2: {},
      },
    },
  },
  faceIt: {
    matchId: "",
  },
};

export const DEFAULT_LOGO = defaultLogo;
export const FACEIT_LOGO = faceitLogo;
export const WEBSOCKET_URL = "ws://localhost:3000";
