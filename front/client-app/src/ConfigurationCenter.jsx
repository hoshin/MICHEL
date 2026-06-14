import "./components/TeamForm.jsx";
import { TeamForm } from "./components/TeamForm.jsx";
import MapSetup from "./components/MapSetup.jsx";

import "./ConfigurationCenter.css";
import { DEFAULT_LOGO, FACEIT_LOGO } from "./config.js";
import { portraits } from "./TeamBanInput.jsx";
import { Card, Flex, Table } from "antd";
import { useTeamsData } from "./teamsDataSocket.ts";
import ConnectionBadge from "./components/ConnectionBadge.jsx";

function copyURI(evt) {
  evt.preventDefault();
  navigator.clipboard
    .writeText(`http://localhost:5173${evt.target.getAttribute("href")}`)
    .then(
      () => {
        /* clipboard successfully set */
      },
      () => {
        /* clipboard write failed */
      },
    );
}

function portraitFromFaceItHeroName(heroName) {
  const lowercaseHeroName = heroName.toLowerCase();
  if (lowercaseHeroName.startsWith("junker")) {
    return portraits.junkerQueen;
  }
  if (lowercaseHeroName.startsWith("soldier")) {
    return portraits.soldier76;
  }
  if (lowercaseHeroName.startsWith("wreck")) {
    return portraits.wreckingBall;
  }
  if (lowercaseHeroName.startsWith("jetpack")) {
    return portraits.jetpackCat;
  }

  return portraits[lowercaseHeroName];
}

export function srcFromTeamBanName(source) {
  if (source && source.heroImage) {
    if (source.heroImage.match(/^http[s]?.*/)) {
      return portraitFromFaceItHeroName(source.heroName);
    }
    return portraits[source.heroImage];
  }
  return null;
}

const columns = [
  {
    title: "App URLs (click to copy)",
    dataIndex: "name",
    key: "name",
    render: (text, { url }) => (
      <a target="_blank" href={url} onClick={copyURI}>
        {text}
      </a>
    ),
  },
  {
    title: "Profile",
    dataIndex: "profile",
    key: "profile",
    render: (text) => <span>{text}</span>,
  },
];

const data = [
  {
    key: "1",
    name: "Configuration Center",
    url: "/configuration-center",
    profile: "General, Input",
  },
  {
    key: "2",
    name: "Game Scene",
    url: "/game-scene",
    profile: "Display, Match production",
  },
  {
    key: "3",
    name: "Mini Score Scene",
    url: "/score-scene",
    profile: "Display, Match production",
  },
  {
    key: "4",
    name: "Team 1 score",
    url: "/team-1-score",
    profile: "Display, Match production",
  },
  {
    key: "5",
    name: "Team 2 score",
    url: "/team-2-score",
    profile: "Display, Match production",
  },
  {
    key: "6",
    name: "Map #",
    url: "/current-map",
    profile: "Display, Match production",
  },
  {
    key: "7",
    name: "Team 1 Ban",
    url: "/team-1-ban",
    profile: "Display, Match production",
  },
  {
    key: "8",
    name: "Team 2 Ban",
    url: "/team-2-ban",
    profile: "Display, Match production",
  },
  {
    key: "9",
    name: "Solo Stream Score Scene",
    url: "/solo-score-scene",
    profile: "Display, Solo PoV cast",
  },
  {
    key: "10",
    name: "Casters Scene",
    url: "/casters-scene",
    profile: "Display, Sample",
  },
  {
    key: "11",
    name: "Team 1 Ban (input)",
    url: "/team-1-ban-input",
    profile: "Input",
  },
  {
    key: "12",
    name: "Team 2 Ban (input)",
    url: "/team-2-ban-input",
    profile: "Input",
  },
  {
    key: "13",
    name: "Tournament Logo",
    url: "/tournament-logo",
    profile: "Display, Match production",
  },
];

function ConfigurationCenter() {
  const { teamsData, send } = useTeamsData();

  const sendCommandHandler = (command) => (event) => {
    event.preventDefault();
    send({ command, value: event.target.value });
  };

  const noEventSendCommandHandler = () => (payload) => {
    send(payload);
  };

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
  const { mapFormat, mapCount, tournamentLogo, optionalLogoDisplay } =
    teamsData.display;
  const { faceIt } = teamsData;

  const { standings } = teamsData;
  const logo = tournamentLogo?.startsWith("faceit")
    ? FACEIT_LOGO
    : tournamentLogo || DEFAULT_LOGO;
  const bansToShow = !!standings?.[`match${mapCount}`];
  let team1BanForCurrentMap = undefined;
  let team2BanForCurrentMap = undefined;
  if (bansToShow) {
    team1BanForCurrentMap = srcFromTeamBanName(
      standings[`match${mapCount}`]?.bans?.team1,
    );
    team2BanForCurrentMap = srcFromTeamBanName(
      standings[`match${mapCount}`]?.bans?.team2,
    );
  }

  return (
    <Flex vertical>
      <Flex justify={"center"} align={"center"}>
        <div className="app-name">M.I.C.H.E.L.</div>
        <ConnectionBadge/>
      </Flex>
      <Flex justify={"space-between"} align={"center"}>
        <TeamForm
          teamUpdateName={sendCommandHandler("updateTeam1Name")}
          teamIncreaseScore={sendCommandHandler("increaseTeam1Score")}
          teamDecreaseScore={sendCommandHandler("decreaseTeam1Score")}
          teamName={team1Name}
          teamScore={team1Score}
          teamLogo={team1Logo}
          teamBanLogo={team1BanForCurrentMap}
          updateTeamLogo={sendCommandHandler("updateTeam1Logo")}
          teamUpdateBan={noEventSendCommandHandler("team1UpdateBan")}
          side={"team1"}
        />
        <TeamForm
          teamUpdateName={sendCommandHandler("updateTeam2Name")}
          teamIncreaseScore={sendCommandHandler("increaseTeam2Score")}
          teamDecreaseScore={sendCommandHandler("decreaseTeam2Score")}
          teamName={team2Name}
          teamScore={team2Score}
          teamLogo={team2Logo}
          teamBanLogo={team2BanForCurrentMap}
          updateTeamLogo={sendCommandHandler("updateTeam2Logo")}
          teamUpdateBan={noEventSendCommandHandler("team2UpdateBan")}
          side={"team2"}
        />
      </Flex>
      <Flex justify={"space-between"} align={"center"}>
        <Card
          size={"small"}
          title={""}
          style={{ backgroundColor: "#a1a1a1", width: "50%" }}
        >
          <MapSetup
            increaseMapCount={sendCommandHandler("increaseMapCount")}
            decreaseMapCount={sendCommandHandler("decreaseMapCount")}
            updateMapFormat={sendCommandHandler("updateMapFormat")}
            mapFormat={mapFormat}
            mapCount={mapCount}
          />
        </Card>
        <Card
          size={"small"}
          title=""
          style={{ backgroundColor: "#a1a1a1", width: "50%" }}
        >
          <button
            style={{
              width: "100%",
              height: "100%",
              fontWeight: 800,
              padding: "1em",
            }}
            onClick={sendCommandHandler("swapTeams")}
          >
            Swap Teams
          </button>
        </Card>
      </Flex>
      <Flex>
        <Card
          size={"small"}
          title="Tournament / Broadcaster Logo"
          style={{ width: "100%", backgroundColor: "#a1a1a1" }}
        >
          <Flex justify={"space-between"} align={"center"}>
            <input
              width={"50%"}
              type="text"
              onChange={sendCommandHandler("updateTournamentLogo")}
              defaultValue={logo}
            />
            <div className="logo-preview">
              {!!logo ? <img height="60px" src={logo}></img> : null}
              <div>Show in mini-score</div>
              <input
                type="checkbox"
                onChange={sendCommandHandler("toggleOptionalLogoDisplay")}
                checked={optionalLogoDisplay}
              />
            </div>
          </Flex>
        </Card>
      </Flex>
      <Flex justify={"space-between"} align={"center"}>
        <Card
          size={"small"}
          title={"FaceIt Configuration"}
          style={{ width: "100%", backgroundColor: "#a1a1a1" }}
        >
          <Flex justify={"space-between"} align={"center"}>
            <Flex vertical style={{ width: "70%" }}>
              <div>FaceIt match ID</div>
              <input
                type="text"
                onChange={sendCommandHandler("updateFromMatchId")}
                defaultValue={faceIt?.matchId}
              />
            </Flex>
            <button
              style={{
                width: "50%",
                height: "100%",
                fontWeight: 800,
                padding: "1em",
              }}
              value={mapCount}
              onClick={sendCommandHandler("fetchFaceItMatchUpdates")}
            >
              Refresh room data
            </button>
          </Flex>
        </Card>
      </Flex>

      <Flex>
        <Card
          size={"small"}
          title={""}
          style={{ width: "100%", backgroundColor: "#a1a1a1" }}
        >
          <Table
            style={{ width: "100%" }}
            columns={columns}
            dataSource={data}
            pagination={false}
          />
        </Card>
      </Flex>
    </Flex>
  );
}

export default ConfigurationCenter;
