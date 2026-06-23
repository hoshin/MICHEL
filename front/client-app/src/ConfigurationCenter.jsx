import "./components/TeamForm.jsx";
import { TeamForm } from "./components/TeamForm.jsx";
import MapSetup from "./components/MapSetup.jsx";
import CountdownTimer from "./components/CountdownTimer.jsx";

import "./ConfigurationCenter.css";
import { DEFAULT_LOGO, FACEIT_LOGO } from "./config.js";
import { portraits } from "./TeamBanInput.jsx";
import {
  Button,
  Card,
  Collapse,
  ConfigProvider,
  Flex,
  Input,
  InputNumber,
  notification,
  Switch,
  Table,
  theme,
} from "antd";
import { useEffect, useRef, useState } from "react";
import { useTeamsData } from "./teamsDataSocket.ts";
import { useFaceItMode } from "./faceItMode.js";
import { useDarkMode } from "./darkMode.js";
import ConnectionBadge from "./components/ConnectionBadge.jsx";
import { PlayCircleOutlined, PauseCircleOutlined } from "@ant-design/icons";

export function copyURI(evt) {
  evt.preventDefault();
  return navigator.clipboard
    .writeText(`http://localhost:5173${evt.target.getAttribute("href")}`)
    .then(
      () => {
        notification.open({
          message: "Copied to clipboard",
          description:
            "The link to the scene was copied to your clipboard. You can now paste it into your browser's address bar to open the scene, or use it to set an OBS browser source up.",
        });
      },
      (err) => {
        notification.open({
          message: "Could not copy to clipboard",
          description: `/o\\ there was an error copying the link to the clipboard (${err.message}).`,
        });
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
    name: "Team 1 Ban (input)",
    url: "/team-1-ban-input",
    profile: "Input",
  },
  {
    key: "11",
    name: "Team 2 Ban (input)",
    url: "/team-2-ban-input",
    profile: "Input",
  },
  {
    key: "12",
    name: "Tournament Logo",
    url: "/tournament-logo",
    profile: "Display, Match production",
  },
  {
    key: "13",
    name: "Countdown Timer",
    url: "/countdown",
    profile: "Display",
  },
];

// Build the catchup payload from the snapshot we captured before the last
// disconnect. We only forward fields that are *meaningful* (non-empty
// strings, scores > 0, mapCount >= 1); the back applies a second layer of
// gating (only overwrite team names/scores when at defaults), so this is a
// belt-and-braces filter that keeps the wire payload small and the log
// noise low.
function buildCatchupIntent(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const intent = {};
  const matchId = snapshot.faceIt?.matchId;
  if (typeof matchId === "string") intent.faceItMatchId = matchId;
  const tournamentLogo = snapshot.display?.tournamentLogo;
  if (typeof tournamentLogo === "string")
    intent.tournamentLogo = tournamentLogo;
  const mapCount = snapshot.display?.mapCount;
  if (
    typeof mapCount === "number" &&
    Number.isFinite(mapCount) &&
    mapCount >= 1
  )
    intent.mapCount = mapCount;
  // Team logos are included alongside names/scores. The back applies the
  // same skip-on-matchId rule to logos as to names: when a FaceIt fetch
  // is being triggered the API response is treated as authoritative for
  // both, and the front-cached values are dropped to avoid a flicker.
  const team1Name = snapshot.team1?.name;
  const team1Score = snapshot.team1?.score;
  const team1Logo = snapshot.team1?.logo;
  if (
    (typeof team1Name === "string" && team1Name.length > 0) ||
    (typeof team1Score === "number" && team1Score > 0) ||
    (typeof team1Logo === "string" && team1Logo.length > 0)
  ) {
    intent.team1 = {};
    if (typeof team1Name === "string" && team1Name.length > 0)
      intent.team1.name = team1Name;
    if (typeof team1Score === "number" && team1Score > 0)
      intent.team1.score = team1Score;
    if (typeof team1Logo === "string" && team1Logo.length > 0)
      intent.team1.logo = team1Logo;
  }
  const team2Name = snapshot.team2?.name;
  const team2Score = snapshot.team2?.score;
  const team2Logo = snapshot.team2?.logo;
  if (
    (typeof team2Name === "string" && team2Name.length > 0) ||
    (typeof team2Score === "number" && team2Score > 0) ||
    (typeof team2Logo === "string" && team2Logo.length > 0)
  ) {
    intent.team2 = {};
    if (typeof team2Name === "string" && team2Name.length > 0)
      intent.team2.name = team2Name;
    if (typeof team2Score === "number" && team2Score > 0)
      intent.team2.score = team2Score;
    if (typeof team2Logo === "string" && team2Logo.length > 0)
      intent.team2.logo = team2Logo;
  }
  return Object.keys(intent).length > 0 ? intent : null;
}

// How long the "Resynchronized" notice stays on screen after a successful
// catchup. Short enough that the operator does not have to dismiss it, long
// enough to actually catch the eye.
const RESYNC_NOTICE_DURATION_MS = 3000;

function ConfigurationCenter() {
  const { teamsData, status, send, consumeCatchupIntent } = useTeamsData();
  const [resyncNotice, setResyncNotice] = useState(null);
  const [timerValue, setTimerValue] = useState(60);
  // Track the previous status so we can detect the transition into `open`
  // that follows a disconnect (i.e. a reconnect) and fire a catchup. We
  // use a ref rather than state because we don't want this transition
  // tracking to itself trigger a re-render.
  const previousStatusRef = useRef(status);

  useEffect(() => {
    const previous = previousStatusRef.current;
    previousStatusRef.current = status;
    // A reconnect is "we just transitioned into `open`, and we were not
    // `open` before". The very first open after page load is also caught
    // by this — that's fine, because `consumeCatchupIntent` returns null
    // when no pre-disconnect snapshot was captured, which is the case for
    // the initial connection. `send` and `consumeCatchupIntent` are stable
    // identities thanks to useTeamsData's useCallback wrapping, so this
    // effect only re-runs on genuine status transitions.
    if (status !== "open" || previous === "open") return;
    const snapshot = consumeCatchupIntent();
    const intent = buildCatchupIntent(snapshot);
    if (!intent) return;
    send({ command: "catchup", value: intent });
    setResyncNotice("Resynchronized with the back-end after reconnect.");
  }, [status, send, consumeCatchupIntent]);

  // Auto-dismiss the resync notice on its own clock, independently from the
  // catchup effect. Driving the timer here means it survives unrelated
  // re-renders (every server broadcast triggers one) — the previous version
  // collocated the timer with the catchup effect and saw it cleared on
  // every render, so the notice stayed up forever.
  useEffect(() => {
    if (!resyncNotice) return;
    const timer = setTimeout(
      () => setResyncNotice(null),
      RESYNC_NOTICE_DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [resyncNotice]);

  // Countdown lives on the back-end now, so we just read its current
  // running state and forward user actions as commands. This keeps every
  // open overlay (including OBS browser sources) perfectly in sync, and
  // lets the timer survive a Config Center reload.
  const running = !!teamsData?.display?.countdownRunning;
  const currentValue = teamsData?.display?.countdown ?? 0;

  const startStopCountdown = () => {
    if (running) {
      send({ command: "countdownPause" });
    } else if (currentValue > 0) {
      // Currently paused — resume from where we left off.
      send({ command: "countdownResume" });
    } else {
      // Idle — start fresh from the configured value.
      send({ command: "countdownStart", value: timerValue });
    }
  };

  const resetCountdown = () => {
    send({ command: "countdownReset", value: timerValue });
  };
  // Native <input type="color"> always returns a `#rrggbb` string and
  // cannot represent "no color" — so we keep the picker showing the
  // currently broadcast color (or black as a neutral default) and provide
  // a separate Reset button to clear the override.
  const countdownColor = teamsData?.display?.countdownColor ?? "";
  const updateCountdownColor = (event) => {
    send({ command: "countdownSetColor", value: event.target.value });
  };
  const resetCountdownColor = () => {
    send({ command: "countdownSetColor", value: "" });
  };
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
  const [faceItModeEnabled, setFaceItMode] = useFaceItMode(faceIt);
  const [darkModeEnabled, setDarkMode] = useDarkMode();

  // Drive the page-level background/text off a body class so the dark theme
  // covers the full viewport, not just the antd-styled cards. Cleaned up on
  // unmount so other routes (the OBS overlays) are never left dark.
  useEffect(() => {
    const body = document.body;
    body.classList.toggle("michel-dark", darkModeEnabled);
    return () => body.classList.remove("michel-dark");
  }, [darkModeEnabled]);

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
    <ConfigProvider
      theme={{
        algorithm: [
          darkModeEnabled ? theme.darkAlgorithm : theme.defaultAlgorithm,
          theme.compactAlgorithm,
        ],
        token: { borderRadius: 6 },
        components: {
          Card: { paddingSM: 10 },
        },
      }}
    >
      <div
        className={`config-dashboard${darkModeEnabled ? " config-dashboard--dark" : ""}`}
      >
        <Flex
          className="dark-mode-toggle"
          justify={"flex-end"}
          align={"center"}
          gap={"small"}
        >
          <span>Dark mode</span>
          <Switch
            size={"small"}
            aria-label={"Dark mode"}
            checked={darkModeEnabled}
            onChange={setDarkMode}
          />
        </Flex>
        <Flex
          className="config-header"
          justify={"space-between"}
          align={"center"}
          gap={"small"}
        >
          <Flex>
            <div className="app-name">M.I.C.H.E.L.</div>
            <ConnectionBadge inline />
          </Flex>
          <Flex align={"center"} gap={"middle"}>
            <label className="faceit-mode-toggle">
              <span>FaceIt mode</span>
              <Switch
                size={"small"}
                aria-label={"FaceIt mode"}
                checked={faceItModeEnabled}
                onChange={setFaceItMode}
              />
            </label>
          </Flex>
        </Flex>

        {resyncNotice ? (
          <div role="status" aria-live="polite" className="resync-notice">
            {resyncNotice}
          </div>
        ) : null}

        <Flex gap={"small"} align={"stretch"} className="teams-row">
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

        <Flex gap={"small"} align={"stretch"} className="match-row">
          <Card size={"small"} title={"Maps"} style={{ flex: 1 }}>
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
            style={{ flex: 1 }}
            styles={{
              body: { height: "100%", padding: 0, display: "flex" },
            }}
          >
            <Button
              block
              style={{ height: "100%", fontWeight: 800, margin: 0 }}
              onClick={sendCommandHandler("swapTeams")}
            >
              Swap Teams (scenes)
            </Button>
          </Card>
        </Flex>

        <Card size={"small"} title="Tournament / Broadcaster Logo">
          <Flex justify={"space-between"} align={"center"} gap={"small"}>
            <Input
              size={"small"}
              style={{ flex: 1 }}
              onChange={sendCommandHandler("updateTournamentLogo")}
              defaultValue={logo}
            />
            <div className="logo-preview">
              {logo ? <img height="40px" src={logo}></img> : null}
              <label>
                <span>Mini-score</span>
                <input
                  type="checkbox"
                  onChange={sendCommandHandler("toggleOptionalLogoDisplay")}
                  checked={optionalLogoDisplay}
                />
              </label>
            </div>
          </Flex>
        </Card>

        {faceItModeEnabled ? (
          <Card size={"small"} title={"FaceIt Configuration"}>
            <Flex justify={"space-between"} align={"flex-end"} gap={"small"}>
              <Flex vertical style={{ flex: 1 }}>
                <div>FaceIt match ID</div>
                <Input
                  size={"small"}
                  onChange={sendCommandHandler("updateFromMatchId")}
                  defaultValue={faceIt?.matchId}
                />
              </Flex>
              <Button
                type={"primary"}
                value={mapCount}
                onClick={sendCommandHandler("fetchFaceItMatchUpdates")}
              >
                Refresh room data
              </Button>
            </Flex>
          </Card>
        ) : null}

        <Card size={"small"} title={"Timer"}>
          <Flex vertical gap={"small"}>
            <Flex justify={"space-between"} align={"center"} gap={"small"}>
              <Flex vertical style={{ flexShrink: 0 }}>
                <div>Duration (s)</div>
                <InputNumber
                  size={"small"}
                  min={1}
                  value={timerValue}
                  onChange={(value) =>
                    setTimerValue(Math.max(1, parseInt(value, 10) || 1))
                  }
                  style={{ width: "80px" }}
                />
              </Flex>
              <Flex gap={"small"} wrap={"wrap"}>
                <Button
                  type={"primary"}
                  icon={
                    running ? <PauseCircleOutlined /> : <PlayCircleOutlined />
                  }
                  onClick={startStopCountdown}
                >
                  {running ? "Pause" : "Start"}
                </Button>
                <Button onClick={resetCountdown}>Reset</Button>
              </Flex>
              <div className="timer-readout">
                <CountdownTimer fontSize={"1em"} />
              </div>
            </Flex>
            <Flex align={"center"} gap={"small"} wrap={"wrap"}>
              <label htmlFor="countdown-color-picker">Color</label>
              <input
                id="countdown-color-picker"
                type="color"
                value={countdownColor || "#000000"}
                onChange={updateCountdownColor}
                title={
                  countdownColor
                    ? `Currently using ${countdownColor}`
                    : "Using the default color"
                }
                style={{
                  width: "40px",
                  height: "28px",
                  padding: 0,
                  border: "1px solid #555",
                  background: "transparent",
                  cursor: "pointer",
                }}
              />
              <Button
                size={"small"}
                onClick={resetCountdownColor}
                disabled={!countdownColor}
                title={"Clear the color override and use the default"}
              >
                Reset color
              </Button>
              {countdownColor ? (
                <span className="timer-color-note">
                  Active: <code>{countdownColor}</code>
                </span>
              ) : (
                <span className="timer-color-note timer-color-note--default">
                  Using default
                </span>
              )}
            </Flex>
          </Flex>
        </Card>

        <Collapse
          size={"small"}
          items={[
            {
              key: "scene-links",
              label: "Scene links",
              children: (
                <Table
                  size={"small"}
                  style={{ width: "100%" }}
                  columns={columns}
                  dataSource={data}
                  pagination={false}
                />
              ),
            },
          ]}
        />
      </div>
    </ConfigProvider>
  );
}

export default ConfigurationCenter;
